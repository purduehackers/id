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
const back = (next: string) => `/passport?next=${encodeURIComponent(next)}`;

export const load: PageServerLoad = async (event) => {
	const next = safeNext(event.url.searchParams.get('next'));
	if (event.locals.user) redirect(302, next);

	const login = await loginState(event.cookies.get(LOGIN_COOKIE));
	return {
		next,
		code: login?.status === 'pending' || login?.status === 'approved' ? login.code : null
	};
};

function clear(cookies: Cookies) {
	cookies.delete(LOGIN_COOKIE, { path: '/' });
}

export const actions: Actions = {
	start: async (event) => {
		const formData = await event.request.formData();
		const next = safeNext(formData.get('next')?.toString());
		const number = formData.get('number')?.toString() ?? '';

		try {
			const login = await startLogin(number);
			event.cookies.set(LOGIN_COOKIE, login.id, cookie);
		} catch (error) {
			if (error instanceof PassportError) return fail(400, { number, message: error.message });
			throw error;
		}
		redirect(303, back(next));
	},

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
		redirect(303, back(next));
	}
};
