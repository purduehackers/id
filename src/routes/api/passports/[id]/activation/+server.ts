import type { RequestHandler } from './$types';
import {
	authorizePassportRequest,
	handlePassportErrors,
	passportId,
	passportJson,
	readJson
} from '$lib/server/passport-api';
import { activatePassport } from '$lib/server/passport-issuing';

export const POST: RequestHandler = async ({ request, url, params }) => {
	const issuer = await authorizePassportRequest(request, url);
	if (issuer instanceof Response) return issuer;
	const body = await readJson(request);
	if (body instanceof Response) return body;

	return handlePassportErrors(async () =>
		passportJson(await activatePassport(issuer, passportId(params.id), body.url))
	);
};
