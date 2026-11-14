import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { session } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/guard';
import { activeSessions } from '$lib/server/sessions';

function messageFrom(error: unknown, fallback: string) {
	return error instanceof APIError ? error.message || fallback : fallback;
}

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	const rows = await activeSessions(user.id);

	const current = event.locals.session?.id;
	const sessions = rows.map((row) => ({ ...row, current: row.id === current }));

	return { sessions: sessions.toSorted((a, b) => Number(b.current) - Number(a.current)) };
};

export const actions: Actions = {
	revoke: async (event) => {
		const user = requireUser(event);
		const id = (await event.request.formData()).get('id')?.toString();
		if (!id) return fail(400, { message: 'Nothing to sign out.' });
		if (id === event.locals.session?.id) {
			return fail(400, { message: 'Use Sign out to end the session on this device.' });
		}

		const [target] = await db
			.select({ token: session.token })
			.from(session)
			.where(and(eq(session.id, id), eq(session.userId, user.id)))
			.limit(1);
		if (!target) return { notice: 'That session has already ended.' };

		try {
			await auth.api.revokeSession({
				body: { token: target.token },
				headers: event.request.headers
			});
		} catch (error) {
			return fail(400, { message: messageFrom(error, 'Could not sign out that device.') });
		}

		return { notice: 'Device signed out.' };
	},

	revokeOthers: async (event) => {
		requireUser(event);

		try {
			await auth.api.revokeOtherSessions({ headers: event.request.headers });
		} catch (error) {
			return fail(400, { message: messageFrom(error, 'Could not sign out your other devices.') });
		}

		return { notice: 'Signed out everywhere else.' };
	}
};
