import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import {
	PassportError,
	TAP_COOKIE,
	approveLogin,
	recordTap,
	signInHere,
	tapState
} from '$lib/server/passport';

const cookie = {
	path: '/scan',
	httpOnly: true,
	sameSite: 'lax',
	secure: !dev,
	maxAge: 10 * 60
} as const;

export const load: PageServerLoad = async (event) => {
	const id = event.url.searchParams.get('id');
	const secret = event.url.searchParams.get('secret');

	if (id && secret) {
		try {
			event.cookies.set(TAP_COOKIE, await recordTap(id, secret), cookie);
		} catch (error) {
			if (error instanceof PassportError) return { tap: null, error: error.message };
			throw error;
		}
		redirect(303, '/scan');
	}

	const tap = await tapState(event.cookies.get(TAP_COOKIE));
	return {
		tap: tap && {
			passportId: tap.passportId,
			owner: tap.owner && { username: tap.owner.username, name: tap.owner.name },
			returning: tap.returning
		},
		error: null
	};
};

export const actions: Actions = {
	approve: async (event) => {
		const code = (await event.request.formData()).get('code')?.toString() ?? '';
		try {
			const owner = await approveLogin(event.cookies.get(TAP_COOKIE), code);
			return { approved: owner.username };
		} catch (error) {
			if (error instanceof PassportError) return fail(400, { message: error.message });
			throw error;
		} finally {
			event.cookies.delete(TAP_COOKIE, { path: '/scan' });
		}
	},

	here: async (event) => {
		let userId: string;
		try {
			userId = (await signInHere(event.cookies.get(TAP_COOKIE))).id;
		} catch (error) {
			if (error instanceof PassportError) return fail(400, { message: error.message });
			throw error;
		} finally {
			event.cookies.delete(TAP_COOKIE, { path: '/scan' });
		}

		try {
			await auth.api.signInWithPassport({ body: { userId }, headers: event.request.headers });
		} catch (error) {
			const message = error instanceof APIError ? error.message : '';
			return fail(400, { message: message || 'Could not sign you in.' });
		}
		redirect(303, '/');
	}
};
