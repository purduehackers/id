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
	setRole,
	unban
} from '$lib/server/admin';
import { authStrength } from '$lib/auth-strength';
import { ROLES, ROLE_LABELS } from '$lib/roles';
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
		roles: ROLES.map((role) => ({ role, label: ROLE_LABELS[role] })),
		users: await Promise.all(
			people.map(async (person) => {
				const passports = (await passportsOf(person.id)).map(({ id, activated }) => ({
					id,
					activated
				}));
				return {
					...person,
					passports,
					strength: authStrength({
						...person,
						activatedPassports: passports.filter((passport) => passport.activated).length
					})
				};
			})
		),
		events
	};
};

async function run(event: Parameters<Actions[string]>[0], change: typeof setRole) {
	const admin = requireAdmin(event);
	const formData = await event.request.formData();
	const userId = formData.get('userId')?.toString() ?? '';
	const value = formData.get('value')?.toString().trim() ?? '';

	try {
		const actor = { id: admin.id, username: admin.username! };
		const username = await change(actor, userId, value);
		return { notice: `Updated @${username}.`, opened: userId };
	} catch (error) {
		if (error instanceof AdminError) return fail(400, { message: error.message, opened: userId });
		throw error;
	}
}

export const actions: Actions = {
	role: (event) => run(event, setRole),
	ban: (event) => run(event, ban),
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
