import { DEVICE_CODE_GRANT_TYPE } from '@better-auth/oauth-provider';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { readList } from '$lib/server/db/json';
import { oauthClient, webhookDelivery, webhookEndpoint } from '$lib/server/db/schema';
import { accessFor } from '$lib/server/directory';
import { MEMBER_CLIENT_SCOPES } from '$lib/server/scopes';
import { uuidv7 } from '$lib/server/uuid';
import {
	availableEvents,
	deliverDue,
	enqueueTest,
	newSecret,
	sealSecret,
	urlProblem
} from '$lib/server/webhooks';

export class AppError extends Error {}

export type Client = {
	client_id: string;
	client_name?: string;
	redirect_uris: string[];
	scope?: string;
	token_endpoint_auth_method?: string;
	grant_types?: string[];
	client_id_issued_at?: number;
	enable_end_session?: boolean;
};

export function describeClient(client: Client) {
	return {
		clientId: client.client_id,
		name: client.client_name ?? client.client_id,
		redirectUris: client.redirect_uris ?? [],
		scopes: client.scope?.split(' ').filter(Boolean) ?? [],
		confidential: client.token_endpoint_auth_method !== 'none',
		device: !!client.grant_types?.includes(DEVICE_CODE_GRANT_TYPE),
		createdAt: client.client_id_issued_at ? client.client_id_issued_at * 1000 : null
	};
}

export function clientErrorMessage(error: unknown, fallback: string) {
	if (!(error instanceof Error)) return fallback;
	const body = (error as { body?: { error_description?: string } }).body;
	const message = body?.error_description || error.message;
	return message ? message.replace(/^\[[^\]]+\]\s*/, '') : fallback;
}

export type AppInput = {
	name: string;
	redirectUris: string[];
	confidential: boolean;
	device: boolean;
	scopes: string[];
};

function appSettings(input: AppInput) {
	const name = input.name.trim();
	if (!name) throw new AppError('Give the application a name.');

	for (const uri of input.redirectUris) {
		if (!URL.canParse(uri)) throw new AppError(`Not a valid URL: ${uri}`);
	}

	const signIn = input.redirectUris.length > 0;
	if (!signIn && !input.device && !input.confidential) {
		throw new AppError(
			'An application without redirect URLs or device sign-in has to be confidential.'
		);
	}

	const scopes = input.scopes.filter((s) => (MEMBER_CLIENT_SCOPES as string[]).includes(s));
	if (scopes.length === 0) throw new AppError('Pick at least one scope.');

	const native =
		(input.device && !signIn) ||
		input.redirectUris.some((uri) => {
			const { protocol, hostname } = new URL(uri);
			return !/^https?:$/.test(protocol) || ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
		});

	const grantTypes = [
		...(signIn ? ['authorization_code'] : []),
		...(input.device ? [DEVICE_CODE_GRANT_TYPE] : []),
		...((signIn || input.device) && scopes.includes('offline_access') ? ['refresh_token'] : [])
	];

	return {
		client_name: name,
		scope: scopes.join(' '),
		application_type: native ? ('native' as const) : ('web' as const),
		...(signIn ? { redirect_uris: input.redirectUris, response_types: ['code' as const] } : {}),
		grant_types: grantTypes
	};
}

export function registrationBody(input: AppInput) {
	const settings = appSettings(input);
	return {
		...settings,
		token_endpoint_auth_method: input.confidential ? 'client_secret_basic' : 'none',
		grant_types: settings.grant_types.length > 0 ? settings.grant_types : ['client_credentials']
	};
}

export type AppChanges = Omit<AppInput, 'confidential'>;

export function updateBody(client: Client, changes: AppChanges) {
	if (changes.redirectUris.length === 0 && (client.redirect_uris ?? []).length > 0) {
		throw new AppError('You must keep at least one redirect URL.');
	}
	const settings = appSettings({ ...changes, confidential: describeClient(client).confidential });
	const directory = client.grant_types?.includes('client_credentials')
		? ['client_credentials']
		: [];
	const grantTypes = [...settings.grant_types, ...directory];
	return {
		...settings,
		grant_types: grantTypes.length > 0 ? grantTypes : ['client_credentials']
	};
}

export async function ownApp(userId: string, clientId: string) {
	const [client] = await db
		.select({
			clientId: oauthClient.clientId,
			name: oauthClient.name,
			scopes: oauthClient.scopes,
			authMethod: oauthClient.tokenEndpointAuthMethod
		})
		.from(oauthClient)
		.where(and(eq(oauthClient.clientId, clientId), eq(oauthClient.userId, userId)))
		.limit(1);
	if (!client) return null;

	const [[endpoint], access] = await Promise.all([
		db.select().from(webhookEndpoint).where(eq(webhookEndpoint.clientId, client.clientId)).limit(1),
		accessFor(client.clientId)
	]);
	const scopes = [...readList(client.scopes), ...(access?.grantedScopes ?? [])];
	return { client, endpoint, access, scopes };
}

export type OwnedApp = NonNullable<Awaited<ReturnType<typeof ownApp>>>;

export async function saveWebhook(app: OwnedApp, url: string, wanted: string[]) {
	const allowed: string[] = availableEvents(app.scopes);
	const events = wanted.filter((type) => allowed.includes(type));

	const problem = await urlProblem(url);
	if (problem) throw new AppError(problem);
	if (events.length === 0) throw new AppError('Pick at least one event.');

	if (app.endpoint) {
		await db
			.update(webhookEndpoint)
			.set({ url, events })
			.where(eq(webhookEndpoint.id, app.endpoint.id));
		return { events, secret: null };
	}

	const secret = newSecret();
	await db.insert(webhookEndpoint).values({
		id: uuidv7(),
		clientId: app.client.clientId,
		url,
		events,
		secret: await sealSecret(secret)
	});
	return { events, secret };
}

export async function rotateWebhookSecret(app: OwnedApp) {
	if (!app.endpoint) throw new AppError('There is no webhook yet.');
	const secret = newSecret();
	await db
		.update(webhookEndpoint)
		.set({ secret: await sealSecret(secret) })
		.where(eq(webhookEndpoint.id, app.endpoint.id));
	return secret;
}

export async function removeWebhook(app: OwnedApp) {
	if (app.endpoint) await db.delete(webhookEndpoint).where(eq(webhookEndpoint.id, app.endpoint.id));
}

export async function testWebhook(app: OwnedApp) {
	if (!app.endpoint) throw new AppError('There is no webhook yet.');
	const id = await enqueueTest(app.endpoint.id, app.client.clientId);
	await deliverDue({ endpointId: app.endpoint.id });
	const [sent] = await db
		.select({ deliveredAt: webhookDelivery.deliveredAt, lastError: webhookDelivery.lastError })
		.from(webhookDelivery)
		.where(eq(webhookDelivery.id, id));
	return sent?.deliveredAt ? null : (sent?.lastError ?? 'unknown error');
}
