import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { hasRole } from '$lib/roles';

export function requireUser(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) {
		redirect(302, `/login?next=${encodeURIComponent(event.url.pathname)}`);
	}
	return user;
}

export function requireAdmin(event: RequestEvent) {
	const user = requireUser(event);
	if (!hasRole(user.role, 'admin')) error(404, 'Not Found');
	return user;
}
