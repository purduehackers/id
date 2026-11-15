import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MCP_RESOURCE, originFor } from '$lib/server/origin';
import { serverCardOptionsResponse, serverCardResponse } from '$lib/server/mcp/server-card';

export const GET: RequestHandler = ({ request, url }) => {
	if (!MCP_RESOURCE) error(404, 'Not Found');
	return serverCardResponse(request, originFor(url));
};

export const OPTIONS: RequestHandler = () => {
	if (!MCP_RESOURCE) error(404, 'Not Found');
	return serverCardOptionsResponse();
};
