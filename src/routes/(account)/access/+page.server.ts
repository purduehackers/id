import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/guard';
import { DirectoryError, decide, listAccess } from '$lib/server/directory';
import { SCOPE_DESCRIPTIONS } from '$lib/server/scopes';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	return {
		apps: (await listAccess()).map((app) => ({
			...app,
			scopes: app.requestedScopes.map((scope) => ({
				scope,
				description: SCOPE_DESCRIPTIONS[scope] ?? scope,
				granted: app.grantedScopes.includes(scope)
			}))
		}))
	};
};

export const actions: Actions = {
	decide: async (event) => {
		const admin = requireAdmin(event);
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const scopes = formData.getAll('scope').map(String);

		try {
			const name = await decide({ id: admin.id, username: admin.username! }, clientId, scopes);
			return { notice: scopes.length ? `Updated ${name}.` : `Revoked ${name}.` };
		} catch (error) {
			if (error instanceof DirectoryError) return fail(400, { message: error.message });
			throw error;
		}
	}
};
