import type { RequestHandler } from './$types';
import {
	authorizePassportRequest,
	handlePassportErrors,
	passportJson,
	readJson
} from '$lib/server/passport-api';
import { issuePassport } from '$lib/server/passport-issuing';
import { originFor } from '$lib/server/origin';

export const POST: RequestHandler = async ({ request, url }) => {
	const issuer = await authorizePassportRequest(request, url);
	if (issuer instanceof Response) return issuer;
	const body = await readJson(request);
	if (body instanceof Response) return body;

	return handlePassportErrors(async () => {
		const scanUrl = new URL('/scan', originFor(url));
		const { created, body: passport } = await issuePassport(issuer, body.uid, scanUrl);
		return passportJson(passport, created ? 201 : 200);
	});
};
