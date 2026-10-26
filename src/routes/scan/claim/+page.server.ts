import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PassportError, TAP_COOKIE, claimPassport, tapState } from '$lib/server/passport';

export const load: PageServerLoad = async (event) => {
	const me = event.locals.user;
	if (!me) redirect(303, `/login?next=${encodeURIComponent('/scan/claim')}`);

	const tap = await tapState(event.cookies.get(TAP_COOKIE));
	return {
		me: { username: me.username },
		passportId: tap?.passportId ?? null,
		ownedBy: tap?.owner?.username ?? null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const me = event.locals.user;
		if (!me) redirect(303, `/login?next=${encodeURIComponent('/scan/claim')}`);
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
	}
};
