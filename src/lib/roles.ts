export const ROLES = ['member', 'organizer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
	member: 'Member',
	organizer: 'Organizer',
	admin: 'Admin'
};

export function isRole(value: unknown): value is Role {
	return (ROLES as readonly unknown[]).includes(value);
}

export function grantedRoles(role: string | null | undefined): Role[] {
	const rank = ROLES.indexOf(isRole(role) ? role : 'member');
	return ROLES.slice(0, rank + 1);
}

export function outranks(a: Role, b: Role) {
	return ROLES.indexOf(a) > ROLES.indexOf(b);
}
