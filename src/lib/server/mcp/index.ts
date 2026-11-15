import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { eq } from 'drizzle-orm';
import { bearerToken, verifyAccessToken } from '$lib/server/bearer';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { grantIsActive } from '$lib/server/grants';
import { MCP_RESOURCE, issuerFor } from '$lib/server/origin';
import { MCP_SCOPES } from '$lib/server/scopes';
import { hasRole } from '$lib/roles';
import { registerAdminTools } from './admin';
import { registerAppTools } from './apps';
import { asMember } from './as-member';
import { MCP_SERVER_INFO } from './discovery';
import { registerMemberTools } from './member';
import type { Caller } from './result';

export const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource/mcp';

function challenge(
	url: URL,
	status: 401 | 403,
	error: string | null,
	description: string,
	scopes: readonly string[] = MCP_SCOPES
) {
	const params = [
		error && `error="${error}"`,
		`error_description="${description}"`,
		`scope="${scopes.join(' ')}"`,
		`resource_metadata="${new URL(PROTECTED_RESOURCE_PATH, url)}"`
	].filter(Boolean);
	return Response.json(
		{ error: error ?? 'invalid_request', error_description: description },
		{ status, headers: { 'www-authenticate': `Bearer ${params.join(', ')}` } }
	);
}

async function authenticate(request: Request, resource: string): Promise<Caller | Response> {
	const url = new URL(request.url);
	const token = bearerToken(request);
	if (!token) return challenge(url, 401, null, 'Sign in with your Purdue Hackers ID.');

	const verified = await verifyAccessToken(token, url, resource);
	if (!verified?.subject) return challenge(url, 401, 'invalid_token', 'Invalid or expired token.');

	const { subject: userId, clientId, scopes, issuedAt } = verified;
	if (!(await grantIsActive(userId, clientId, issuedAt))) {
		return challenge(url, 401, 'invalid_token', 'This access is no longer valid. Sign in again.');
	}

	if (!['user:read', 'user', 'apps', 'admin'].some((scope) => scopes.has(scope))) {
		return challenge(url, 403, 'insufficient_scope', 'Token lacks user:read, apps or admin.', [
			'user:read',
			'apps',
			'admin'
		]);
	}

	const [row] = await db
		.select({ username: user.username, role: user.role })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	const admin =
		row?.username && hasRole(row.role, 'admin') ? { id: userId, username: row.username } : null;

	return { userId, clientId, issuer: issuerFor(url), scopes, member: asMember(userId), admin };
}

function buildServer(caller: Caller) {
	const server = new McpServer(
		{ ...MCP_SERVER_INFO, websiteUrl: new URL(caller.issuer).origin },
		{
			instructions:
				'Tools for the Purdue Hackers ID of the signed-in member. ' +
				'Member tools show and change the profile, signed-in devices and authorized apps. ' +
				'Developer tools manage the OAuth applications that the member made, with their webhooks. ' +
				'Admin tools find members and decide directory access; only admins get them. ' +
				'Confirm with the member before you use a write tool.'
		}
	);

	registerMemberTools(server, caller);
	registerAppTools(server, caller);
	registerAdminTools(server, caller);
	return server;
}

export async function handleMcpRequest(request: Request): Promise<Response> {
	if (!MCP_RESOURCE) return new Response('Not Found', { status: 404 });
	const caller = await authenticate(request, MCP_RESOURCE);
	if (caller instanceof Response) return caller;

	const server = buildServer(caller);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});
	await server.connect(transport);
	return transport.handleRequest(request);
}
