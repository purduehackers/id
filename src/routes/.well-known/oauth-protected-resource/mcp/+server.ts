import { metadataResponse } from '@better-auth/oauth-provider';
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { MCP_RESOURCE, issuerFor } from '$lib/server/origin';
import { MCP_SCOPES } from '$lib/server/scopes';

export const GET: RequestHandler = ({ url }) => {
	if (!MCP_RESOURCE) error(404, 'Not Found');
	return metadataResponse(
		{
			resource: MCP_RESOURCE,
			authorization_servers: [issuerFor(url)],
			scopes_supported: MCP_SCOPES,
			bearer_methods_supported: ['header'],
			resource_name: 'Purdue Hackers ID'
		},
		{ 'access-control-allow-origin': '*' }
	);
};
