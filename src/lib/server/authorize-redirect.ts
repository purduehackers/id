const AUTHORIZE_PATH = '/api/auth/oauth2/authorize';

/**
 * Better Auth answers some browser page loads of the authorize endpoint with
 * `{ "redirect": true, "url": "…" }` instead of a redirect. That happens when one of
 * its hooks resumes the OAuth flow, for example after the session refreshes during
 * the request. A page load cannot follow JSON, so the person sees the raw object.
 *
 * For a page load only, turn that answer into the redirect it describes and keep every
 * other header (the session cookies). Better Auth has already validated the URL.
 */
export async function followAuthorizeJson(request: Request, response: Response): Promise<Response> {
	if (new URL(request.url).pathname !== AUTHORIZE_PATH) return response;

	const mode = request.headers.get('sec-fetch-mode');
	const accept = request.headers.get('accept') ?? '';
	const pageLoad = mode === 'navigate' || (!mode && accept.includes('text/html'));
	if (!pageLoad) return response;

	if (!response.headers.get('content-type')?.includes('application/json')) return response;

	const body: unknown = await response
		.clone()
		.json()
		.catch(() => null);
	if (
		typeof body !== 'object' ||
		body === null ||
		!('redirect' in body) ||
		body.redirect !== true ||
		!('url' in body) ||
		typeof body.url !== 'string'
	) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.delete('content-type');
	headers.delete('content-length');
	headers.set('location', body.url);
	headers.set('cache-control', 'no-store');
	return new Response(null, { status: 302, headers });
}
