import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { SCOPE_DESCRIPTIONS, isDirectoryScope } from '$lib/server/scopes';

function messageFrom(err: unknown, fallback: string) {
	if (!(err instanceof Error)) return fallback;
	const body = (err as { body?: { error_description?: string } }).body;
	const message = body?.error_description || err.message;
	return message ? message.replace(/^\[[^\]]+\]\s*/, '') : fallback;
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		redirect(302, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}

	const userCode = event.url.searchParams.get('user_code')?.trim().toUpperCase();
	if (!userCode) return { request: null };

	let verified: { status: string; client_id?: string; scope?: string };
	try {
		verified = await auth.api.deviceVerify({
			query: { user_code: userCode },
			headers: event.request.headers
		});
	} catch (err) {
		return { request: null, userCode, message: messageFrom(err, 'That code is not valid.') };
	}

	if (verified.status !== 'pending') {
		return { request: null, userCode, message: 'That code has already been used.' };
	}
	if (!verified.client_id) {
		return { request: null, userCode, message: 'That code belongs to another account.' };
	}

	let clientName = verified.client_id;
	try {
		const client = await auth.api.getOAuthClientPublic({
			query: { client_id: verified.client_id },
			headers: event.request.headers
		});
		clientName = client.client_name ?? verified.client_id;
	} catch {
		error(400, 'Unknown application.');
	}

	const requested = (verified.scope ?? '').split(/\s+/).filter(Boolean);
	if (requested.some(isDirectoryScope))
		error(400, 'This application asked for access you cannot grant.');

	return {
		request: {
			userCode,
			clientName,
			scopes: requested.map((scope) => ({
				scope,
				description: SCOPE_DESCRIPTIONS[scope] ?? scope
			}))
		}
	};
};

async function respond(event: Parameters<Actions[string]>[0], accept: boolean) {
	if (!event.locals.user) error(401, 'Sign in first.');
	const userCode = (await event.request.formData()).get('userCode')?.toString();
	if (!userCode) return fail(400, { message: 'Nothing to answer.' });

	try {
		const answer = accept ? auth.api.deviceApprove : auth.api.deviceDeny;
		await answer({ body: { userCode }, headers: event.request.headers });
	} catch (err) {
		return fail(400, { message: messageFrom(err, 'Could not record your answer.') });
	}

	return { answered: accept ? 'allowed' : 'denied' };
}

export const actions: Actions = {
	allow: (event) => respond(event, true),
	deny: (event) => respond(event, false)
};
