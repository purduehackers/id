import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { normalizeUsername, usernameProblem } from '$lib/username';

function safeNext(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
	return raw;
}

function resumeTarget(url: URL): string | null {
	if (!url.searchParams.get('sig') || !url.searchParams.get('client_id')) return null;
	return `/api/auth/oauth2/authorize${url.search}`;
}

const PROVIDERS = [
	{ id: 'discord', label: 'Discord' },
	{ id: 'github', label: 'GitHub' }
] as const;

type Provider = (typeof PROVIDERS)[number]['id'];

const EXPIRED = 'That linking attempt expired or was interrupted. Please try again.';
const SIGN_IN_ERRORS: Record<string, string> = {
	signup_disabled:
		'That account is not connected to any Purdue Hackers ID. Sign in with your email and password, then connect it from your dashboard.',
	account_not_linked:
		'There is a Purdue Hackers ID with that email, but this account is not connected to it. Sign in with your email and password, then connect it from the dashboard.',
	state_mismatch: EXPIRED,
	state_not_found: EXPIRED,
	state_invalid: EXPIRED
};

export const load: PageServerLoad = (event) => {
	const next = resumeTarget(event.url) ?? safeNext(event.url.searchParams.get('next'));
	if (event.locals.user) redirect(302, next);

	const code = event.url.searchParams.get('error');
	return {
		next,
		providers: PROVIDERS,
		error: code ? (SIGN_IN_ERRORS[code] ?? `Sign in failed (${code}).`) : null
	};
};

function message(error: unknown, fallback: string) {
	return error instanceof APIError ? error.message || fallback : fallback;
}

async function emailForUsername(username: string) {
	const [row] = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.username, normalizeUsername(username)))
		.limit(1);
	return row?.email ?? '';
}

function toVerify(email: string, next: string): never {
	redirect(302, `/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

export const actions: Actions = {
	signIn: async (event) => {
		const formData = await event.request.formData();
		const next = safeNext(formData.get('next')?.toString());
		const identifier = formData.get('identifier')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const byEmail = identifier.includes('@');

		try {
			if (byEmail) {
				await auth.api.signInEmail({
					body: { email: identifier, password },
					headers: event.request.headers
				});
			} else {
				await auth.api.signInUsername({
					body: { username: normalizeUsername(identifier), password },
					headers: event.request.headers
				});
			}
		} catch (error) {
			if (error instanceof APIError && error.body?.code === 'EMAIL_NOT_VERIFIED') {
				toVerify(byEmail ? identifier : await emailForUsername(identifier), next);
			}
			return fail(400, { identifier, message: message(error, 'Sign in failed.') });
		}

		redirect(302, next);
	},

	signUp: async (event) => {
		const formData = await event.request.formData();
		const next = safeNext(formData.get('next')?.toString());
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString().trim() ?? '';
		const username = normalizeUsername(formData.get('username')?.toString() ?? '');

		if (!name) return fail(400, { email, name, username, message: 'Tell us your name.' });
		const problem = usernameProblem(username);
		if (problem) return fail(400, { email, name, username, message: problem });

		try {
			await auth.api.signUpEmail({
				body: { email, password, name, username },
				headers: event.request.headers
			});
		} catch (error) {
			return fail(400, {
				email,
				name,
				username,
				message: message(error, 'Could not create the account.')
			});
		}

		toVerify(email, next);
	},

	social: async (event) => {
		const formData = await event.request.formData();
		const next = safeNext(formData.get('next')?.toString());
		const provider = formData.get('provider')?.toString();

		if (!PROVIDERS.some((p) => p.id === provider)) {
			return fail(400, { message: 'Unknown provider.' });
		}

		let url: string | undefined;
		try {
			({ url } = await auth.api.signInSocial({
				body: {
					provider: provider as Provider,
					callbackURL: next,
					errorCallbackURL: '/login'
				}
			}));
		} catch (error) {
			return fail(400, { message: message(error, `Could not start ${provider} sign-in.`) });
		}

		if (!url) return fail(500, { message: 'No authorization URL came back.' });

		redirect(302, url);
	}
};
