import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MCP_RESOURCE, originFor } from '$lib/server/origin';
import {
	SERVER_CARD_MEDIA_TYPE,
	buildServerCard,
	discoveryJsonResponse,
	discoveryOptionsResponse
} from '$lib/server/mcp/discovery';

export const GET: RequestHandler = ({ request, url }) => {
	if (!MCP_RESOURCE) error(404, 'Not Found');
	return discoveryJsonResponse(request, buildServerCard(originFor(url)), SERVER_CARD_MEDIA_TYPE);
};

export const OPTIONS: RequestHandler = () => {
	if (!MCP_RESOURCE) error(404, 'Not Found');
	return discoveryOptionsResponse();
};
