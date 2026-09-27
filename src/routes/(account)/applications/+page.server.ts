import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { requireUser } from '$lib/server/guard';
import { MEMBER_CLIENT_SCOPES, SCOPE_DESCRIPTIONS } from '$lib/server/scopes';

type Client = {
	client_id: string;
	client_name?: string;
	redirect_uris: string[];
	scope?: string;
	token_endpoint_auth_method?: string;
	client_id_issued_at?: number;
};

export const load: PageServerLoad = async (event) => {
	requireUser(event);

	const clients = (await auth.api.getOAuthClients({
		headers: event.request.headers
	})) as unknown as Client[];

	return {
		discovery: `${event.url.origin}/api/auth/.well-known/openid-configuration`,
		scopes: MEMBER_CLIENT_SCOPES.map((scope) => ({
			scope,
			description: SCOPE_DESCRIPTIONS[scope]
		})),
		applications: clients.map((client) => ({
			clientId: client.client_id,
			name: client.client_name ?? client.client_id,
			redirectUris: client.redirect_uris,
			scopes: client.scope?.split(' ').filter(Boolean) ?? [],
			confidential: client.token_endpoint_auth_method !== 'none',
			createdAt: client.client_id_issued_at ? client.client_id_issued_at * 1000 : null
		}))
	};
};

function messageFrom(error: unknown, fallback: string) {
	if (!(error instanceof Error)) return fallback;
	const body = (error as { body?: { error_description?: string } }).body;
	const message = body?.error_description || error.message;
	return message ? message.replace(/^\[[^\]]+\]\s*/, '') : fallback;
}

function parseRedirectUris(raw: string): string[] | string {
	const uris = raw
		.split(/\s+/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (uris.length === 0) return 'Add at least one redirect URL.';
	for (const uri of uris) {
		try {
			new URL(uri);
		} catch {
			return `Not a valid URL: ${uri}`;
		}
	}
	return uris;
}

export const actions: Actions = {
	create: async (event) => {
		requireUser(event);
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const redirectRaw = formData.get('redirectUris')?.toString() ?? '';
		const confidential = formData.get('type') === 'confidential';
		const requested = formData.getAll('scope').map(String);
		const values = { name, redirectUris: redirectRaw, confidential, scopes: requested };

		if (!name) return fail(400, { ...values, message: 'Give the application a name.' });

		const redirectUris = parseRedirectUris(redirectRaw);
		if (typeof redirectUris === 'string') return fail(400, { ...values, message: redirectUris });

		const scopes = requested.filter((s) => (MEMBER_CLIENT_SCOPES as string[]).includes(s));
		if (scopes.length === 0) return fail(400, { ...values, message: 'Pick at least one scope.' });

		const native = redirectUris.some((uri) => {
			const { protocol, hostname } = new URL(uri);
			return !/^https?:$/.test(protocol) || ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
		});

		let created: { client_id: string; client_secret?: string };
		try {
			created = (await auth.api.createOAuthClient({
				body: {
					client_name: name,
					redirect_uris: redirectUris,
					scope: scopes.join(' '),
					token_endpoint_auth_method: confidential ? 'client_secret_basic' : 'none',
					application_type: native ? 'native' : 'web',
					grant_types: scopes.includes('offline_access')
						? ['authorization_code', 'refresh_token']
						: ['authorization_code'],
					response_types: ['code']
				},
				headers: event.request.headers
			})) as { client_id: string; client_secret?: string };
		} catch (error) {
			return fail(400, { ...values, message: messageFrom(error, 'Could not create it.') });
		}

		return { created: { name, clientId: created.client_id, clientSecret: created.client_secret } };
	},

	rotate: async (event) => {
		requireUser(event);
		const clientId = (await event.request.formData()).get('clientId')?.toString();
		if (!clientId) return fail(400, { message: 'Nothing to rotate.' });

		try {
			const rotated = (await auth.api.rotateClientSecret({
				body: { client_id: clientId },
				headers: event.request.headers
			})) as { client_secret?: string };
			return { rotated: { clientId, clientSecret: rotated.client_secret } };
		} catch (error) {
			return fail(400, { message: messageFrom(error, 'Could not rotate the secret.') });
		}
	},

	delete: async (event) => {
		requireUser(event);
		const clientId = (await event.request.formData()).get('clientId')?.toString();
		if (!clientId) return fail(400, { message: 'Nothing to delete.' });

		try {
			await auth.api.deleteOAuthClient({
				body: { client_id: clientId },
				headers: event.request.headers
			});
		} catch (error) {
			return fail(400, { message: messageFrom(error, 'Could not delete it.') });
		}

		return { deleted: true };
	}
};
