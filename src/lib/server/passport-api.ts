import { eq } from 'drizzle-orm';
import {
	DPOP_SIGNING_ALGORITHMS,
	createDpopReplayStore,
	enforceDpopBinding,
	getDpopJktFromPayload,
	isDpopBindingError,
	parseAccessTokenAuthorization,
	type DpopReplayStore
} from 'better-auth/oauth2';
import { auth } from '$lib/server/auth';
import { describeAccessToken, verifyAccessTokenPayload } from '$lib/server/bearer';
import { db } from '$lib/server/db';
import { oauthClient } from '$lib/server/db/schema';
import { originFor } from '$lib/server/origin';
import { isIssuer } from '$lib/server/passport-issuers';
import { IssueError, type Issuer } from '$lib/server/passport-issuing';
import { PASSPORT_RESOURCE } from '$lib/server/scopes';

const REQUIRED_SCOPE = 'passports:issue';
const ALGS = DPOP_SIGNING_ALGORITHMS.join(' ');
const NO_STORE = { 'cache-control': 'no-store', pragma: 'no-cache' };

let replayStore: Promise<DpopReplayStore> | null = null;
function dpopReplayStore() {
	replayStore ??= auth.$context.then((ctx) => createDpopReplayStore(ctx.internalAdapter));
	return replayStore;
}

const quote = (value: string) => value.replace(/["\\]/g, '');

function challenge(status: 400 | 401 | 403, error: string | null, description: string) {
	const params = [
		...(error ? [`error="${error}"`, `error_description="${quote(description)}"`] : []),
		...(error === 'insufficient_scope' ? [`scope="${REQUIRED_SCOPE}"`] : []),
		`algs="${ALGS}"`
	];
	return Response.json(
		{ error: error ?? 'invalid_request', error_description: description },
		{ status, headers: { ...NO_STORE, 'www-authenticate': `DPoP ${params.join(', ')}` } }
	);
}

export async function authorizePassportRequest(
	request: Request,
	url: URL
): Promise<Issuer | Response> {
	const authorization = parseAccessTokenAuthorization(request.headers.get('authorization'));
	if (!authorization?.token) return challenge(401, null, 'Send a DPoP-bound access token.');
	if (authorization.scheme !== 'DPoP') {
		return challenge(401, 'invalid_token', 'This API accepts only DPoP-bound access tokens.');
	}

	const payload = await verifyAccessTokenPayload(authorization.token, url, PASSPORT_RESOURCE);
	if (!payload) return challenge(401, 'invalid_token', 'Invalid or expired token.');
	if (!getDpopJktFromPayload(payload)) {
		return challenge(401, 'invalid_token', 'The access token is not DPoP-bound.');
	}

	try {
		await enforceDpopBinding({
			payload,
			authorization,
			proofJwt: request.headers.get('dpop'),
			method: request.method,
			url: new URL(`${url.pathname}${url.search}`, originFor(url)).href,
			replayStore: await dpopReplayStore()
		});
	} catch (error) {
		if (isDpopBindingError(error)) return challenge(401, error.code, error.message);
		throw error;
	}

	const token = describeAccessToken(payload);
	if (!token) return challenge(401, 'invalid_token', 'The access token names no client.');
	if (!token.scopes.has(REQUIRED_SCOPE) || !(await isIssuer(token.clientId))) {
		return challenge(403, 'insufficient_scope', 'This application may not issue passports.');
	}

	const [client] = await db
		.select({ name: oauthClient.name })
		.from(oauthClient)
		.where(eq(oauthClient.clientId, token.clientId))
		.limit(1);
	if (!client) return challenge(401, 'invalid_token', 'The application no longer exists.');
	return { clientId: token.clientId, name: client.name ?? token.clientId };
}

export function passportJson(body: unknown, status = 200) {
	return Response.json(body, { status, headers: NO_STORE });
}

export function passportError(status: number, error: string, description: string) {
	return Response.json({ error, error_description: description }, { status, headers: NO_STORE });
}

export async function handlePassportErrors(run: () => Promise<Response>) {
	try {
		return await run();
	} catch (error) {
		if (error instanceof IssueError) return passportError(error.status, error.code, error.message);
		throw error;
	}
}

export async function readJson(request: Request): Promise<Record<string, unknown> | Response> {
	const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
	if (type !== 'application/json') {
		return passportError(415, 'invalid_request', 'Send the body as application/json.');
	}
	const body: unknown = await request.json().catch(() => null);
	if (body && typeof body === 'object' && !Array.isArray(body)) {
		return body as Record<string, unknown>;
	}
	return passportError(400, 'invalid_request', 'The body must be a JSON object.');
}

export function passportId(raw: string) {
	return /^\d{1,15}$/.test(raw) ? Number(raw) : NaN;
}
