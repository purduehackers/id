import type { LayoutServerLoad } from './$types';
import { requireUser } from '$lib/server/guard';

export const load: LayoutServerLoad = (event) => {
	const user = requireUser(event);
	return {
		user: {
			id: user.id,
			name: user.name,
			givenName: user.givenName ?? null,
			familyName: user.familyName ?? null,
			username: user.username,
			image: user.image ?? null,
			role: user.role,
			email: user.email,
			emailVerified: user.emailVerified,
			phone: user.phone ?? null,
			graduationTerm: user.graduationTerm ?? null,
			createdAt: user.createdAt
		}
	};
};
