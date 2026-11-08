import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/guard';
import {
	AdminError,
	ban,
	countUsers,
	isUserFilter,
	listUsers,
	recentEvents,
	setRoles,
	unban
} from '$lib/server/admin';
import { ASSIGNED_ROLES, ROLE_LABELS } from '$lib/roles';
import { PassportError, assignPassport, passportsOf } from '$lib/server/passport';

export const load: PageServerLoad = async (event) => {
	const admin = requireAdmin(event);
	const query = event.url.searchParams.get('q') ?? '';
	const rawFilter = event.url.searchParams.get('filter');
	const filter = isUserFilter(rawFilter) ? rawFilter : null;

	const [people, counts, events] = await Promise.all([
		listUsers(query, filter),
		countUsers(query),
		recentEvents()
	]);

	return {
		query,
		filter,
		counts,
		me: admin.id,
		roles: ASSIGNED_ROLES.map((role) => ({ role, label: ROLE_LABELS[role] })),
		users: await Promise.all(
			people.map(async (person) => {
				const passports = (await passportsOf(person.id)).map(({ id, activated }) => ({
					id,
					activated
				}));
				return {
					...person,
					passports
				};
			})
		),
		events
	};
};

type Change = (
	actor: { id: string; username: string },
	userId: string,
	formData: FormData
) => Promise<string>;

async function run(event: Parameters<Actions[string]>[0], change: Change) {
	const admin = requireAdmin(event);
	const formData = await event.request.formData();
	const userId = formData.get('userId')?.toString() ?? '';

	try {
		const actor = { id: admin.id, username: admin.username! };
		const username = await change(actor, userId, formData);
		return { notice: `Updated @${username}.`, opened: userId };
	} catch (error) {
		if (error instanceof AdminError) return fail(400, { message: error.message, opened: userId });
		throw error;
	}
}

export const actions: Actions = {
	roles: (event) =>
		run(event, (admin, userId, formData) =>
			setRoles(admin, userId, formData.getAll('role').map(String))
		),
	ban: (event) =>
		run(event, (admin, userId, formData) =>
			ban(admin, userId, formData.get('value')?.toString().trim() ?? '')
		),
	unban: (event) => run(event, (admin, userId) => unban(admin, userId)),

	passport: async (event) => {
		const admin = requireAdmin(event);
		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString() || null;
		const number = formData.get('passport')?.toString() ?? '';
		const opened = userId ?? formData.get('from')?.toString();
		try {
			const id = await assignPassport({ id: admin.id, username: admin.username! }, number, userId);
			return { notice: userId ? `Gave passport ${id}.` : `Took passport ${id} back.`, opened };
		} catch (error) {
			if (error instanceof PassportError) return fail(400, { message: error.message, opened });
			throw error;
		}
	}
};
