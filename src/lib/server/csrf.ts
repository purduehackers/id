const FORM_CONTENT_TYPES = new Set([
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain',
	'application/x-sveltekit-formdata'
]);

const SERVER_OAUTH_PATHS = new Set([
	'/api/auth/oauth2/token',
	'/api/auth/oauth2/introspect',
	'/api/auth/oauth2/revoke'
]);

export function isServerOAuthPath(pathname: string): boolean {
	return SERVER_OAUTH_PATHS.has(pathname);
}

export function isForbiddenFormSubmission(request: Request): boolean {
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return false;

	const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
	if (!contentType || !FORM_CONTENT_TYPES.has(contentType)) return false;

	const url = new URL(request.url);
	const origin = request.headers.get('origin');
	if (origin === url.origin) return false;

	// These endpoints authenticate OAuth clients and do not use a browser session.
	// A browser request still carries cookies or Fetch Metadata and is checked below.
	if (
		request.method === 'POST' &&
		isServerOAuthPath(url.pathname) &&
		origin === null &&
		!request.headers.has('cookie') &&
		!request.headers.has('sec-fetch-site') &&
		!request.headers.has('sec-fetch-mode') &&
		!request.headers.has('sec-fetch-dest')
	) {
		return false;
	}

	return true;
}
