import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { idCardForScan } from '$lib/server/id-card';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import {
	PassportError,
	TAP_COOKIE,
	approveLogin,
	claimPassport,
	recordTap,
	signInHere,
	tapState
} from '$lib/server/passport';

const cookie = {
	path: '/scan',
	httpOnly: true,
	sameSite: 'lax',
	secure: !dev,
	maxAge: 30 * 60
} as const;

export const load: PageServerLoad = async (event) => {
	const id = event.url.searchParams.get('id');
	const secret = event.url.searchParams.get('secret');

	if (id && secret) {
		try {
			event.cookies.set(TAP_COOKIE, await recordTap(id, secret), cookie);
			event.cookies.set('passport_entrance', '1', { ...cookie, maxAge: 60 });
		} catch (error) {
			if (error instanceof PassportError)
				return { tap: null, entrance: false, error: error.message };
			throw error;
		}
		redirect(303, '/scan');
	}

	const tap = await tapState(event.cookies.get(TAP_COOKIE));
	const viewerIsOwner = !!tap?.owner && event.locals.user?.id === tap.owner.id;
	const entrance = event.cookies.get('passport_entrance') === '1';
	event.cookies.delete('passport_entrance', { path: '/scan' });
	return {
		entrance: !!tap && entrance,
		tap: tap && {
			passportId: tap.passportId,
			owner: tap.owner && { username: tap.owner.username, name: tap.owner.name },
			returning: tap.returning,
			card: tap.owner ? await idCardForScan(tap.owner.id, tap.passportId, viewerIsOwner) : null
		},
		me: event.locals.user ? { username: event.locals.user.username } : null,
		error: null
	};
};

export const actions: Actions = {
	claim: async (event) => {
		const me = event.locals.user;
		if (!me) redirect(303, '/scan/claim');
		try {
			const id = await claimPassport(event.cookies.get(TAP_COOKIE), {
				id: me.id,
				username: me.username!
			});
			event.cookies.delete(TAP_COOKIE, { path: '/scan' });
			return { claimed: id };
		} catch (error) {
			if (error instanceof PassportError) return fail(400, { message: error.message });
			throw error;
		}
	},

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
