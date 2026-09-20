import { redirect, type RequestEvent } from '@sveltejs/kit';

export function requireUser(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) {
		redirect(302, `/login?next=${encodeURIComponent(event.url.pathname)}`);
	}
	return user;
}
