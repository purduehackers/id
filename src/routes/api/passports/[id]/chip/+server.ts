import type { RequestHandler } from './$types';
import {
	authorizePassportRequest,
	handlePassportErrors,
	passportId,
	passportJson,
	readJson
} from '$lib/server/passport-api';
import { registerChip } from '$lib/server/passport-issuing';
import { originFor } from '$lib/server/origin';

export const POST: RequestHandler = async ({ request, url, params }) => {
	const issuer = await authorizePassportRequest(request, url);
	if (issuer instanceof Response) return issuer;
	const body = await readJson(request);
	if (body instanceof Response) return body;

	return handlePassportErrors(async () =>
		passportJson(
			await registerChip(issuer, passportId(params.id), body.uid, new URL('/scan', originFor(url)))
		)
	);
};
