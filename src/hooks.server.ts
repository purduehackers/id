import type { Handle } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { isForbiddenFormSubmission, isServerOAuthPath } from '$lib/server/csrf';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (!dev && isForbiddenFormSubmission(event.request)) {
		const message = `Cross-site ${event.request.method} form submissions are forbidden`;
		if (isServerOAuthPath(event.url.pathname)) {
			return Response.json(
				{ error: 'invalid_request', error_description: message },
				{ status: 403 }
			);
		}
		return event.request.headers.get('accept') === 'application/json'
			? Response.json({ message }, { status: 403 })
			: new Response(message, { status: 403 });
	}

	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
