import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MCP_RESOURCE, originFor } from '$lib/server/origin';
import {
	AI_CATALOG_MEDIA_TYPE,
	buildAiCatalog,
	discoveryJsonResponse,
	discoveryOptionsResponse
} from '$lib/server/mcp/discovery';

export const GET: RequestHandler = ({ request, url }) => {
	if (!MCP_RESOURCE) error(404, 'Not Found');
	return discoveryJsonResponse(request, buildAiCatalog(originFor(url)), AI_CATALOG_MEDIA_TYPE);
};

export const OPTIONS: RequestHandler = () => {
	if (!MCP_RESOURCE) error(404, 'Not Found');
	return discoveryOptionsResponse();
};
