import type { RequestHandler } from './$types';
import { handleMcpRequest } from '$lib/server/mcp';

export const POST: RequestHandler = ({ request }) => handleMcpRequest(request);

const notAllowed: RequestHandler = () =>
	new Response('Use POST.', { status: 405, headers: { allow: 'POST' } });

export const GET = notAllowed;
export const DELETE = notAllowed;
