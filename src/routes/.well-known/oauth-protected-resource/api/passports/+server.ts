import { metadataResponse } from '@better-auth/oauth-provider';
import { DPOP_SIGNING_ALGORITHMS } from 'better-auth/oauth2';
import type { RequestHandler } from './$types';
import { issuerFor } from '$lib/server/origin';
import { PASSPORT_RESOURCE, PASSPORT_SCOPES } from '$lib/server/scopes';

export const GET: RequestHandler = ({ url }) =>
	metadataResponse(
		{
			resource: PASSPORT_RESOURCE,
			authorization_servers: [issuerFor(url)],
			scopes_supported: PASSPORT_SCOPES,
			bearer_methods_supported: ['header'],
			dpop_signing_alg_values_supported: [...DPOP_SIGNING_ALGORITHMS],
			dpop_bound_access_tokens_required: true,
			resource_name: 'Purdue Hackers passports'
		},
		{ 'access-control-allow-origin': '*' }
	);
