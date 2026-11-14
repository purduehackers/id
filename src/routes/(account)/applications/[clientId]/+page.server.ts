import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { auth } from '$lib/server/auth';
import {
	AppError,
	clientErrorMessage,
	describeClient,
	ownApp,
	removeWebhook,
	rotateWebhookSecret,
	saveWebhook,
	testWebhook,
	updateBody,
	type Client
} from '$lib/server/apps';
import { requireUser } from '$lib/server/guard';
import { DirectoryError, decide, requestAccess } from '$lib/server/directory';
import { hasRole } from '$lib/roles';
import {
	DIRECTORY_RESOURCE,
	DIRECTORY_SCOPES,
	MEMBER_CLIENT_SCOPES,
	SCOPE_DESCRIPTIONS
} from '$lib/server/scopes';
import { WEBHOOK_EVENTS, availableEvents, recentDeliveries, resend } from '$lib/server/webhooks';

function clientOf(event: RequestEvent) {
	return auth.api.getOAuthClient({
		query: { client_id: event.params.clientId },
		headers: event.request.headers
	}) as unknown as Promise<Client>;
}

async function ownedApp(event: RequestEvent) {
	const user = requireUser(event);
	const app = await ownApp(user.id, event.params.clientId);
	if (!app) error(404, 'Not Found');
	return app;
}

export const load: PageServerLoad = async (event) => {
	const [owned, oauth] = await Promise.allSettled([ownedApp(event), clientOf(event)]);
	if (owned.status === 'rejected') throw owned.reason;
	if (oauth.status === 'rejected') throw oauth.reason;
	const { client, endpoint, access, scopes } = owned.value;
	const settings = describeClient(oauth.value);
	const deliveries = endpoint ? await recentDeliveries(endpoint.id) : [];

	return {
		app: {
			clientId: client.clientId,
			name: client.name ?? client.clientId,
			confidential: client.authMethod !== 'none'
		},
		settings: {
			name: settings.name,
			redirectUris: settings.redirectUris.join('\n'),
			device: settings.device,
			scopes: settings.scopes
		},
		scopeOptions: MEMBER_CLIENT_SCOPES.map((scope) => ({
			scope,
			description: SCOPE_DESCRIPTIONS[scope]
		})),
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
		deliveries: deliveries.map((d) => ({
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
	};
};

export const actions: Actions = {
	update: async (event) => {
		await ownedApp(event);
		const formData = await event.request.formData();
		const settings = {
			name: formData.get('name')?.toString().trim() ?? '',
			redirectUris: formData.get('redirectUris')?.toString() ?? '',
			device: formData.has('device'),
			scopes: formData.getAll('scope').map(String)
		};

		try {
			const update = updateBody(await clientOf(event), {
				...settings,
				redirectUris: settings.redirectUris.split(/\s+/).filter(Boolean)
			});
			await auth.api.updateOAuthClient({
				body: { client_id: event.params.clientId, update },
				headers: event.request.headers
			});
		} catch (error) {
			const message =
				error instanceof AppError ? error.message : clientErrorMessage(error, 'Could not save it.');
			return fail(400, { settings, message });
		}
		return { notice: 'Settings saved.' };
	},

	save: async (event) => {
		const app = await ownedApp(event);
		const formData = await event.request.formData();
		const url = formData.get('url')?.toString().trim() ?? '';
		const events = formData.getAll('event').map(String);
		try {
			const { secret } = await saveWebhook(app, url, events);
			return secret ? { secret } : { notice: 'Saved.' };
		} catch (error) {
			if (error instanceof AppError) return fail(400, { url, events, message: error.message });
			throw error;
		}
	},

	rotate: async (event) => {
		const app = await ownedApp(event);
		try {
			return { secret: await rotateWebhookSecret(app) };
		} catch (error) {
			if (error instanceof AppError) return fail(400, { message: error.message });
			throw error;
		}
	},

	remove: async (event) => {
		await removeWebhook(await ownedApp(event));
		return { notice: 'Webhook removed.' };
	},

	test: async (event) => {
		const app = await ownedApp(event);
		try {
			const problem = await testWebhook(app);
			return problem
				? fail(400, { message: `Test event failed: ${problem}. Will retry.` })
				: { notice: 'Test event delivered.' };
		} catch (error) {
			if (error instanceof AppError) return fail(400, { message: error.message });
			throw error;
		}
	},

	resend: async (event) => {
		const { endpoint } = await ownedApp(event);
		const deliveryId = (await event.request.formData()).get('deliveryId')?.toString();
		if (!endpoint || !deliveryId) return fail(400, { message: 'Nothing to resend.' });

		if (!(await resend(deliveryId, endpoint.id))) {
			return fail(404, { message: 'That delivery is gone.' });
		}
		return { notice: 'Sent again.' };
	},

	requestAccess: async (event) => {
		const user = requireUser(event);
		const scopes = (await event.request.formData()).getAll('scope').map(String);
		try {
			await requestAccess(user.id, event.params.clientId, scopes);
			if (hasRole(user.role, 'admin')) {
				await decide({ id: user.id, username: user.username! }, event.params.clientId, scopes);
			}
		} catch (error) {
			if (error instanceof DirectoryError) return fail(400, { message: error.message });
			throw error;
		}
		return { notice: 'Asked an admin for directory access.' };
	}
};
