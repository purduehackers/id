import { fail, redirect } from '@sveltejs/kit';
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

const PROVIDERS = [
	{ id: 'discord', label: 'Discord' },
	{ id: 'github', label: 'GitHub' }
] as const;

type Provider = (typeof PROVIDERS)[number]['id'];

type Consent = {
	id: string;
	clientId: string;
	scopes: string[];
	createdAt: string | Date;
};

const LINK_ERRORS: Record<string, string> = {
	state_security_mismatch:
		'That linking attempt expired or was interrupted. It only stays valid for five minutes — try again.',
	state_not_found: 'That linking attempt expired or was interrupted. Try again.',
	account_already_linked_to_different_user:
		'That account is already attached to a different Purdue Hackers ID.',
	signup_disabled: 'That account is not attached to any ID yet.'
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const headers = event.request.headers;

	const linked = event.url.searchParams.get('linked');
	const errorCode = event.url.searchParams.get('error');

	const accounts = await auth.api.listUserAccounts({ headers });
	const consents = (await auth.api.getOAuthConsents({ headers })) as unknown as Consent[];

	const clientIds = [...new Set(consents.map((consent) => consent.clientId))];
	const clients = clientIds.length
		? await db
				.select({ clientId: oauthClient.clientId, name: oauthClient.name })
				.from(oauthClient)
				.where(inArray(oauthClient.clientId, clientIds))
		: [];
	const nameFor = new Map(clients.map((client) => [client.clientId, client.name]));

	return {
		notice: linked ? `${linked} connected.` : null,
		error: errorCode ? (LINK_ERRORS[errorCode] ?? `Linking failed (${errorCode}).`) : null,
		user: {
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified
		},
		connections: PROVIDERS.map((provider) => {
			const account = accounts.find((a) => a.providerId === provider.id);
			return {
				id: provider.id,
				label: provider.label,
				accountId: account?.id ?? null,
				connectedAt: account?.createdAt ?? null
			};
		}),
		apps: consents.map((consent) => ({
			id: consent.id,
			name: nameFor.get(consent.clientId) ?? consent.clientId,
			grantedAt: consent.createdAt,
			scopes: consent.scopes.map((scope) => SCOPE_DESCRIPTIONS[scope] ?? scope)
		}))
	};
};

function messageFrom(error: unknown, fallback: string) {
	return error instanceof APIError ? error.message || fallback : fallback;
}

export const actions: Actions = {
	link: async (event) => {
		requireUser(event);
		const formData = await event.request.formData();
		const provider = formData.get('provider')?.toString();

		if (!PROVIDERS.some((p) => p.id === provider)) {
			return fail(400, { message: 'Unknown provider.' });
		}

		let url: string | undefined;
		try {
			({ url } = await auth.api.linkSocialAccount({
				body: {
					provider: provider as Provider,
					callbackURL: `/dash?linked=${provider}`,
					errorCallbackURL: '/dash'
				},
				headers: event.request.headers
			}));
		} catch (error) {
			return fail(400, { message: messageFrom(error, `Could not start ${provider} linking.`) });
		}

		if (!url) return fail(500, { message: 'No authorization URL came back.' });

		redirect(302, url);
	},

	unlink: async (event) => {
		requireUser(event);
		const formData = await event.request.formData();
		const accountId = formData.get('accountId')?.toString();
		if (!accountId) return fail(400, { message: 'Nothing to disconnect.' });

		try {
			await auth.api.unlinkAccount({
				body: { accountId },
				headers: event.request.headers
			});
		} catch (error) {
			const message = messageFrom(error, 'Could not disconnect that account.');
			return fail(400, {
				message: /fresh|expired/i.test(message)
					? 'For this one you need to sign in again first.'
					: message
			});
		}

		return { message: 'Disconnected.' };
	},

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
			await auth.api.deleteOAuthConsent({
				body: { id },
				headers: event.request.headers
			});
		} catch (error) {
			return fail(400, { message: messageFrom(error, 'Could not revoke that app.') });
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

		return { message: 'Access revoked and existing tokens killed.' };
	},

	signOut: async (event) => {
		await auth.api.signOut({ headers: event.request.headers });
		redirect(302, '/login');
	}
};
