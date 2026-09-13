import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { SCOPE_DESCRIPTIONS } from '$lib/server/scopes';

function oauthQuery(url: URL): string {
	return url.search.replace(/^\?/, '');
}

export const load: PageServerLoad = async (event) => {
	const query = oauthQuery(event.url);
	const clientId = event.url.searchParams.get('client_id');

	if (!clientId || !event.url.searchParams.get('sig')) {
		error(400, 'This page is only reachable from an authorization request.');
	}

	if (!event.locals.user) {
		redirect(302, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}

	let clientName = clientId;
	try {
		const client = await auth.api.getOAuthClientPublic({
			query: { client_id: clientId },
			headers: event.request.headers
		});
		clientName = client.client_name ?? clientId;
	} catch {
		error(400, 'Unknown application.');
	}

	const scopes = (event.url.searchParams.get('scope') ?? '')
		.split(/\s+/)
		.filter(Boolean)
		.map((scope) => ({ scope, description: SCOPE_DESCRIPTIONS[scope] ?? scope }));

	return {
		query,
		clientName,
		scopes
	};
};

async function respond(event: Parameters<Actions[string]>[0], accept: boolean) {
	const formData = await event.request.formData();
	const query = formData.get('query')?.toString() ?? '';

	const response = await auth.api.oauth2Consent({
		body: { accept, oauth_query: query },
		headers: event.request.headers,
		request: event.request,
		asResponse: true
	});

	const body = (await response.json().catch(() => ({}))) as {
		url?: string;
		error_description?: string;
		message?: string;
	};

	if (!response.ok || !body.url) {
		return fail(response.ok ? 500 : 400, {
			message: body.error_description ?? body.message ?? 'Could not record your answer.'
		});
	}

	redirect(302, body.url);
}

export const actions: Actions = {
	allow: (event) => respond(event, true),
	deny: (event) => respond(event, false)
};
