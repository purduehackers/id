import { fail, redirect, type Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import {
	LOGIN_COOKIE,
	PassportError,
	cancelLogin,
	claimApprovedLogin,
	loginState,
	startLogin
} from '$lib/server/passport';

function safeNext(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
	return raw;
}

const cookie = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	secure: !dev,
	maxAge: 5 * 60
} as const;

function clear(cookies: Cookies) {
	cookies.delete(LOGIN_COOKIE, { path: '/' });
}

export const load: PageServerLoad = async (event) => {
	const next = safeNext(event.url.searchParams.get('next'));
	if (event.locals.user) redirect(302, next);

	let login = await loginState(event.cookies.get(LOGIN_COOKIE));
	if (!login || login.status === 'used') {
		try {
			const started = await startLogin(event.getClientAddress());
			event.cookies.set(LOGIN_COOKIE, started.id, cookie);
			login = { code: started.code, status: 'pending', username: null, name: null };
		} catch (error) {
			if (error instanceof PassportError)
				return { next, code: null, approvedAs: null, error: error.message };
			throw error;
		}
	}

	return {
		next,
		code: login.code,
		approvedAs:
			login.status === 'approved' && login.username
				? { username: login.username, name: login.name }
				: null,
		error: null
	};
};

export const actions: Actions = {
	complete: async (event) => {
		const next = safeNext((await event.request.formData()).get('next')?.toString());
		const userId = await claimApprovedLogin(event.cookies.get(LOGIN_COOKIE));
		if (!userId) return fail(400, { message: 'Not approved yet. Type the code on your phone.' });
		clear(event.cookies);

		try {
			await auth.api.signInWithPassport({ body: { userId }, headers: event.request.headers });
		} catch (error) {
			const message = error instanceof APIError ? error.message : '';
			return fail(400, { message: message || 'Could not sign you in.' });
		}
		redirect(303, next);
	},

	cancel: async (event) => {
		const next = safeNext((await event.request.formData()).get('next')?.toString());
		await cancelLogin(event.cookies.get(LOGIN_COOKIE));
		clear(event.cookies);
		redirect(303, `/passport?next=${encodeURIComponent(next)}`);
	}
};
