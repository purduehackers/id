import { getRequestEvent } from '$app/server';
import { configuredOrigin } from '$lib/server/origin';

function origin() {
	if (configuredOrigin) return configuredOrigin;
	try {
		return getRequestEvent().url.origin;
	} catch {
		// No request context, for example in webhook retries.
		return '';
	}
}

/** The user image, or the pixel avatar. */
export function pictureFor(user: { id: string; image?: string | null }): string {
	return user.image || `${origin()}/avatar/${user.id}.svg`;
}
