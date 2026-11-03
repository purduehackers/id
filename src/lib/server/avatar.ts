import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';

function origin() {
	if (env.ORIGIN) return env.ORIGIN.replace(/\/$/, '');
	try {
		return getRequestEvent().url.origin;
	} catch {
		// No request context, for example in webhook retries.
		return 'https://id.purduehackers.com';
	}
}

/** The user image, or the pixel avatar. */
export function pictureFor(user: { id: string; image?: string | null }): string {
	return user.image || `${origin()}/avatar/${user.id}.svg`;
}
