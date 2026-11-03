import type { LayoutServerLoad } from './$types';
import { requireUser } from '$lib/server/guard';

export const load: LayoutServerLoad = (event) => {
	const user = requireUser(event);
	return {
		user: {
			id: user.id,
			name: user.name,
			username: user.username,
			role: user.role,
			email: user.email,
			emailVerified: user.emailVerified,
			createdAt: user.createdAt
		}
	};
};
