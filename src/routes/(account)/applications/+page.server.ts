import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import {
	AppError,
	clientErrorMessage,
	describeClient,
	registrationBody,
	type Client
} from '$lib/server/apps';
import { requireUser } from '$lib/server/guard';
import { MEMBER_CLIENT_SCOPES, SCOPE_DESCRIPTIONS } from '$lib/server/scopes';
import { previewTokens } from '$lib/server/claims';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	const clients = (await auth.api.getOAuthClients({
		headers: event.request.headers
	})) as unknown as Client[];
	const { baseURL: issuer } = await auth.$context;

	return {
		discovery: `${event.url.origin}/api/auth/.well-known/openid-configuration`,
		scopes: MEMBER_CLIENT_SCOPES.map((scope) => ({
			scope,
			description: SCOPE_DESCRIPTIONS[scope]
		})),
		applications: clients.map((client) => {
			const app = describeClient(client);
			return {
				...app,
				preview: previewTokens(
					user,
					{ clientId: client.client_id, enableEndSession: !!client.enable_end_session },
					app.scopes,
					issuer
				)
			};
		})
	};
};

export const actions: Actions = {
	create: async (event) => {
		requireUser(event);
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const redirectRaw = formData.get('redirectUris')?.toString() ?? '';
		const confidential = formData.get('type') === 'confidential';
		const device = formData.has('device');
		const requested = formData.getAll('scope').map(String);
		const values = { name, redirectUris: redirectRaw, confidential, device, scopes: requested };

		let body;
		try {
			body = registrationBody({
				name,
				redirectUris: redirectRaw.split(/\s+/).filter(Boolean),
				confidential,
				device,
				scopes: requested
			});
		} catch (error) {
			if (error instanceof AppError) return fail(400, { ...values, message: error.message });
			throw error;
		}

		let created: { client_id: string; client_secret?: string };
		try {
			created = (await auth.api.createOAuthClient({
				body,
				headers: event.request.headers
			})) as { client_id: string; client_secret?: string };
		} catch (error) {
			return fail(400, { ...values, message: clientErrorMessage(error, 'Could not create it.') });
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
			return fail(400, { message: clientErrorMessage(error, 'Could not rotate the secret.') });
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
			return fail(400, { message: clientErrorMessage(error, 'Could not delete it.') });
		}

		return { deleted: true };
	}
};
