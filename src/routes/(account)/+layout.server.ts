import type { LayoutServerLoad } from './$types';
import { requireUser } from '$lib/server/guard';

export const load: LayoutServerLoad = (event) => {
	const user = requireUser(event);
	return {
		user: {
			name: user.name,
			username: user.username,
			email: user.email,
			emailVerified: user.emailVerified
		}
	};
};
