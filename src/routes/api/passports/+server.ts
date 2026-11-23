import type { RequestHandler } from './$types';
import {
	authorizePassportRequest,
	handlePassportErrors,
	passportJson,
	readJson
} from '$lib/server/passport-api';
import { createPassport } from '$lib/server/passport-issuing';

export const POST: RequestHandler = async ({ request, url }) => {
	const issuer = await authorizePassportRequest(request, url);
	if (issuer instanceof Response) return issuer;
	const body = await readJson(request);
	if (body instanceof Response) return body;

	return handlePassportErrors(async () => {
		const { created, body: passport } = await createPassport(issuer, body);
		return passportJson(passport, created ? 201 : 200);
	});
};
