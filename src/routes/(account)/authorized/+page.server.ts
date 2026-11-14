import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { authorizedApps, revokeApp } from '$lib/server/grants';
import { requireUser } from '$lib/server/guard';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	return { apps: await authorizedApps(user.id) };
};

export const actions: Actions = {
	revoke: async (event) => {
		const user = requireUser(event);
		const formData = await event.request.formData();
		const clientId = formData.get('id')?.toString();
		if (!clientId) return fail(400, { message: 'Nothing to revoke.' });

		const removed = await revokeApp(user.id, clientId);
		if (!removed) return fail(404, { message: 'That app is not on your list.' });
		return { message: 'Access revoked.' };
	}
};
