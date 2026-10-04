import { error, redirect, type RequestEvent } from '@sveltejs/kit';

export function requireUser(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) {
		redirect(302, `/login?next=${encodeURIComponent(event.url.pathname)}`);
	}
	return user;
}

export function requireAdmin(event: RequestEvent) {
	const user = requireUser(event);
	if (user.role !== 'admin') error(404, 'Not Found');
	return user;
}
