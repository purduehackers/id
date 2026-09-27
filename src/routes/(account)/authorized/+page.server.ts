import { fail } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import {
	oauthAccessToken,
	oauthClient,
	oauthConsent,
	oauthRefreshToken
} from '$lib/server/db/schema';
import { requireUser } from '$lib/server/guard';
import { SCOPE_DESCRIPTIONS } from '$lib/server/scopes';
import { APIError } from 'better-auth/api';

type Consent = {
	id: string;
	clientId: string;
	scopes: string[];
	createdAt: string | Date;
};

export const load: PageServerLoad = async (event) => {
	requireUser(event);

	const consents = (await auth.api.getOAuthConsents({
		headers: event.request.headers
	})) as unknown as Consent[];

	const clientIds = [...new Set(consents.map((consent) => consent.clientId))];
	const clients = clientIds.length
		? await db
				.select({ clientId: oauthClient.clientId, name: oauthClient.name })
				.from(oauthClient)
				.where(inArray(oauthClient.clientId, clientIds))
		: [];
	const nameFor = new Map(clients.map((client) => [client.clientId, client.name]));

	return {
		apps: consents.map((consent) => ({
			id: consent.id,
			name: nameFor.get(consent.clientId) ?? consent.clientId,
			grantedAt: consent.createdAt,
			scopes: consent.scopes.map((scope) => SCOPE_DESCRIPTIONS[scope] ?? scope)
		}))
	};
};

export const actions: Actions = {
	revoke: async (event) => {
		const user = requireUser(event);
		const formData = await event.request.formData();
		const id = formData.get('id')?.toString();
		if (!id) return fail(400, { message: 'Nothing to revoke.' });

		const [consent] = await db
			.select({ clientId: oauthConsent.clientId })
			.from(oauthConsent)
			.where(and(eq(oauthConsent.id, id), eq(oauthConsent.userId, user.id)))
			.limit(1);

		if (!consent) return fail(404, { message: 'That app is not on your list.' });

		try {
			await auth.api.deleteOAuthConsent({ body: { id }, headers: event.request.headers });
		} catch (error) {
			const message = error instanceof APIError ? error.message : '';
			return fail(400, { message: message || 'Could not revoke that app.' });
		}

		await db
			.delete(oauthAccessToken)
			.where(
				and(eq(oauthAccessToken.userId, user.id), eq(oauthAccessToken.clientId, consent.clientId))
			);
		await db
			.delete(oauthRefreshToken)
			.where(
				and(eq(oauthRefreshToken.userId, user.id), eq(oauthRefreshToken.clientId, consent.clientId))
			);

		return { message: 'Access revoked.' };
	}
};
