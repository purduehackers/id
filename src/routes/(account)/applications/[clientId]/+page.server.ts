import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { db } from '$lib/server/db';
import { oauthClient, webhookDelivery, webhookEndpoint } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/guard';
import { uuidv7 } from '$lib/server/uuid';
import { readList } from '$lib/server/db/json';
import { DirectoryError, accessFor, decide, requestAccess } from '$lib/server/directory';
import { DIRECTORY_RESOURCE, DIRECTORY_SCOPES, SCOPE_DESCRIPTIONS } from '$lib/server/scopes';
import {
	WEBHOOK_EVENTS,
	availableEvents,
	deliverDue,
	enqueueTest,
	newSecret,
	recentDeliveries,
	resend,
	sealSecret,
	urlProblem
} from '$lib/server/webhooks';

async function ownApp(event: RequestEvent) {
	const user = requireUser(event);
	const [client] = await db
		.select({
			clientId: oauthClient.clientId,
			name: oauthClient.name,
			scopes: oauthClient.scopes,
			authMethod: oauthClient.tokenEndpointAuthMethod
		})
		.from(oauthClient)
		.where(and(eq(oauthClient.clientId, event.params.clientId), eq(oauthClient.userId, user.id)))
		.limit(1);
	if (!client) error(404, 'Not Found');

	const [endpoint] = await db
		.select()
		.from(webhookEndpoint)
		.where(eq(webhookEndpoint.clientId, client.clientId))
		.limit(1);
	const access = await accessFor(client.clientId);
	const scopes = [...readList(client.scopes), ...(access?.grantedScopes ?? [])];
	return { client, endpoint, access, scopes };
}

export const load: PageServerLoad = async (event) => {
	const { client, endpoint, access, scopes } = await ownApp(event);

	return {
		app: {
			clientId: client.clientId,
			name: client.name ?? client.clientId,
			confidential: client.authMethod !== 'none'
		},
		directory: {
			resource: DIRECTORY_RESOURCE,
			tokenUrl: `${event.url.origin}/api/auth/oauth2/token`,
			apiUrl: `${event.url.origin}/api/directory/users`,
			scopes: DIRECTORY_SCOPES.map((scope) => ({
				scope,
				description: SCOPE_DESCRIPTIONS[scope]
			})),
			requested: access?.requestedScopes ?? [],
			granted: access?.grantedScopes ?? [],
			decided: !!access?.decidedAt
		},
		events: availableEvents(scopes).map((type) => ({
			type,
			description: WEBHOOK_EVENTS[type].description
		})),
		webhook: endpoint ? { url: endpoint.url, events: endpoint.events } : null,
		deliveries: endpoint
			? (await recentDeliveries(endpoint.id)).map((d) => ({
					id: d.id,
					type: d.type,
					payload: d.payload,
					attempts: d.attempts,
					createdAt: d.createdAt,
					deliveredAt: d.deliveredAt,
					failedAt: d.failedAt,
					nextAttemptAt: d.nextAttemptAt,
					lastError: d.lastError
				}))
			: []
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { client, endpoint, scopes } = await ownApp(event);
		const formData = await event.request.formData();
		const url = formData.get('url')?.toString().trim() ?? '';
		const allowed: string[] = availableEvents(scopes);
		const events = formData
			.getAll('event')
			.map(String)
			.filter((type) => allowed.includes(type));
		const values = { url, events };

		const problem = await urlProblem(url);
		if (problem) return fail(400, { ...values, message: problem });
		if (events.length === 0) return fail(400, { ...values, message: 'Pick at least one event.' });

		if (endpoint) {
			await db
				.update(webhookEndpoint)
				.set({ url, events })
				.where(eq(webhookEndpoint.id, endpoint.id));
			return { notice: 'Saved.' };
		}

		const secret = newSecret();
		await db.insert(webhookEndpoint).values({
			id: uuidv7(),
			clientId: client.clientId,
			url,
			events,
			secret: await sealSecret(secret)
		});
		return { secret };
	},

	rotate: async (event) => {
		const { endpoint } = await ownApp(event);
		if (!endpoint) return fail(400, { message: 'There is no webhook yet.' });

		const secret = newSecret();
		await db
			.update(webhookEndpoint)
			.set({ secret: await sealSecret(secret) })
			.where(eq(webhookEndpoint.id, endpoint.id));
		return { secret };
	},

	remove: async (event) => {
		const { endpoint } = await ownApp(event);
		if (endpoint) await db.delete(webhookEndpoint).where(eq(webhookEndpoint.id, endpoint.id));
		return { notice: 'Webhook removed.' };
	},

	test: async (event) => {
		const { client, endpoint } = await ownApp(event);
		if (!endpoint) return fail(400, { message: 'There is no webhook yet.' });

		const id = await enqueueTest(endpoint.id, client.clientId);
		await deliverDue({ endpointId: endpoint.id });
		const [sent] = await db
			.select({ deliveredAt: webhookDelivery.deliveredAt, lastError: webhookDelivery.lastError })
			.from(webhookDelivery)
			.where(eq(webhookDelivery.id, id));

		return sent?.deliveredAt
			? { notice: 'Test event delivered.' }
			: fail(400, {
					message: `Test event failed: ${sent?.lastError ?? 'unknown error'}. Will retry.`
				});
	},

	resend: async (event) => {
		const { endpoint } = await ownApp(event);
		const deliveryId = (await event.request.formData()).get('deliveryId')?.toString();
		if (!endpoint || !deliveryId) return fail(400, { message: 'Nothing to resend.' });

		await resend(deliveryId, endpoint.id);
		return { notice: 'Sent again.' };
	},

	requestAccess: async (event) => {
		const user = requireUser(event);
		const scopes = (await event.request.formData()).getAll('scope').map(String);
		try {
			await requestAccess(user.id, event.params.clientId, scopes);
			if (user.role === 'admin') {
				await decide({ id: user.id, username: user.username! }, event.params.clientId, scopes);
			}
		} catch (error) {
			if (error instanceof DirectoryError) return fail(400, { message: error.message });
			throw error;
		}
		return { notice: 'Asked an admin for directory access.' };
	}
};
