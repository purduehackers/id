import type { RequestHandler } from './$types';
import {
	authorizePassportRequest,
	handlePassportErrors,
	passportId,
	passportJson
} from '$lib/server/passport-api';
import { passportStatus } from '$lib/server/passport-issuing';

export const GET: RequestHandler = async ({ request, url, params }) => {
	const issuer = await authorizePassportRequest(request, url);
	if (issuer instanceof Response) return issuer;
	return handlePassportErrors(async () =>
		passportJson(await passportStatus(issuer, passportId(params.id)))
	);
};
