import { hasGraduated } from './graduation';

export const ROLES = ['admin', 'organizer', 'alumni'] as const;
export type Role = (typeof ROLES)[number];

export const ASSIGNED_ROLES = ['admin', 'organizer'] as const;
export type AssignedRole = (typeof ASSIGNED_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
	admin: 'Admin',
	organizer: 'Organizer',
	alumni: 'Alumni'
};

export function isRole(value: unknown): value is Role {
	return (ROLES as readonly unknown[]).includes(value);
}

export function isAssignedRole(value: unknown): value is AssignedRole {
	return (ASSIGNED_ROLES as readonly unknown[]).includes(value);
}

export function toRoles(values: Iterable<string>): AssignedRole[] {
	const wanted = new Set(values);
	if (wanted.has('admin')) wanted.add('organizer');
	return ASSIGNED_ROLES.filter((role) => wanted.has(role));
}

export function parseRoles(value: string | null | undefined): AssignedRole[] {
	return toRoles(value?.split(',') ?? []);
}

export function serializeRoles(roles: AssignedRole[]): string | null {
	return roles.length ? roles.join(',') : null;
}

export function hasRole(value: string | null | undefined, role: AssignedRole) {
	return parseRoles(value).includes(role);
}

export function losesRoles(from: Role[], to: Role[]) {
	return from.some((role) => !to.includes(role));
}

export function rolesOf(
	user: { role?: unknown; graduationTerm?: unknown },
	now = new Date()
): Role[] {
	const assigned = parseRoles(typeof user.role === 'string' ? user.role : null);
	return hasGraduated(user.graduationTerm, now) ? [...assigned, 'alumni'] : assigned;
}
