import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

function safeNext(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dash';
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

const SIGN_IN_ERRORS: Record<string, string> = {
	signup_disabled:
		'That account is not connected to any Purdue Hackers ID. Sign in with your email and password, then connect it from your dashboard.',
	state_security_mismatch: 'That sign-in attempt expired or was interrupted. Try again.',
	state_not_found: 'That sign-in attempt expired or was interrupted. Try again.'
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

function toVerify(email: string, next: string): never {
	redirect(302, `/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

export const actions: Actions = {
	signIn: async (event) => {
		const formData = await event.request.formData();
		const next = safeNext(formData.get('next')?.toString());
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await auth.api.signInEmail({ body: { email, password }, headers: event.request.headers });
		} catch (error) {
			if (error instanceof APIError && error.body?.code === 'EMAIL_NOT_VERIFIED') {
				toVerify(email, next);
			}
			return fail(400, { email, message: message(error, 'Sign in failed.') });
		}

		redirect(302, next);
	},

	signUp: async (event) => {
		const formData = await event.request.formData();
		const next = safeNext(formData.get('next')?.toString());
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString().trim() ?? '';

		if (!name) return fail(400, { email, message: 'Tell us your name.' });

		try {
			await auth.api.signUpEmail({
				body: { email, password, name },
				headers: event.request.headers
			});
		} catch (error) {
			return fail(400, { email, message: message(error, 'Could not create the account.') });
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
