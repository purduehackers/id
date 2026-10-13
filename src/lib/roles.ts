export const ROLES = ['alumni', 'organizer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
	alumni: 'Alumni',
	organizer: 'Organizer',
	admin: 'Admin'
};

const GRANTS: Record<Role, Role[]> = {
	alumni: ['alumni'],
	organizer: ['organizer'],
	admin: ['organizer', 'admin']
};

export function isRole(value: unknown): value is Role {
	return (ROLES as readonly unknown[]).includes(value);
}

export function grantedRoles(role: string | null | undefined): Role[] {
	return isRole(role) ? GRANTS[role] : [];
}

export function losesRoles(from: string | null, to: string | null) {
	const kept = new Set(grantedRoles(to));
	return grantedRoles(from).some((role) => !kept.has(role));
}
