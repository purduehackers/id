import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { USER_FILTERS, countUsers, listUsers } from '$lib/server/admin';
import { DirectoryError, accessFor, decide, listAccess } from '$lib/server/directory';
import { DIRECTORY_SCOPES } from '$lib/server/scopes';
import { rolesOf } from '$lib/roles';
import { fail, ok, type Caller } from './result';

const isPending = (row: { requestedAt: Date; decidedAt: Date | null }) =>
	row.decidedAt === null || row.decidedAt < row.requestedAt;

export function registerAdminTools(server: McpServer, caller: Caller) {
	const admin = caller.admin;
	if (!admin || !caller.scopes.has('admin')) return;

	server.registerTool(
		'search_members',
		{
			title: 'Search members',
			description:
				'Find members by username, name, email or phone. Returns at most 50 members, newest first, ' +
				'with the total counts for the search.',
			inputSchema: {
				query: z.string().optional().describe('Text to find. Leave it out to list all members.'),
				filter: z.enum(USER_FILTERS).optional()
			},
			annotations: { readOnlyHint: true, openWorldHint: false }
		},
		async ({ query = '', filter }) => {
			const [people, counts] = await Promise.all([
				listUsers(query, filter ?? null),
				countUsers(query)
			]);
			return ok({
				counts,
				members: people.map((person) => ({
					id: person.id,
					username: person.username,
					name: person.name,
					email: person.email,
					email_verified: person.emailVerified,
					phone_number: person.phone,
					roles: rolesOf(person),
					banned: person.banned ?? false,
					ban_reason: person.banReason,
					connections: person.connections,
					passkeys: person.passkeys,
					has_password: person.hasPassword,
					created_at: person.createdAt
				}))
			});
		}
	);

	server.registerTool(
		'list_directory_requests',
		{
			title: 'List directory requests',
			description:
				'List applications that asked to read the member directory, with the scopes they asked for ' +
				'and the scopes they have.',
			inputSchema: {
				pending_only: z
					.boolean()
					.default(true)
					.describe('Show only requests that wait for an admin.')
			},
			annotations: { readOnlyHint: true, openWorldHint: false }
		},
		async ({ pending_only }) => {
			const rows = await listAccess();
			return ok(
				rows
					.filter((row) => !pending_only || isPending(row))
					.map((row) => ({
						app_id: row.clientId,
						name: row.name,
						owner: row.ownerUsername,
						requested_scopes: row.requestedScopes,
						granted_scopes: row.grantedScopes,
						pending: isPending(row),
						requested_at: row.requestedAt,
						decided_at: row.decidedAt
					}))
			);
		}
	);

	server.registerTool(
		'set_directory_access',
		{
			title: 'Set directory access',
			description:
				'Set the directory scopes of an application. This replaces the scopes it has now. ' +
				'You can only give scopes that the application asked for. An empty list removes all access. ' +
				'Get the app ID from list_directory_requests.',
			inputSchema: {
				app_id: z.string(),
				scopes: z.array(z.enum(DIRECTORY_SCOPES as [string, ...string[]]))
			},
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
		},
		async ({ app_id, scopes }) => {
			const current = await accessFor(app_id);
			if (!current) return fail('That application has not asked for access.');
			const ignored = scopes.filter((scope) => !current.requestedScopes.includes(scope));
			if (ignored.length) {
				return fail(
					`The application did not ask for ${ignored.join(', ')}. ` +
						`It asked for ${current.requestedScopes.join(', ')}.`
				);
			}
			try {
				const name = await decide(admin, app_id, scopes);
				const after = await accessFor(app_id);
				return ok({ app_id, name, granted_scopes: after?.grantedScopes ?? [] });
			} catch (error) {
				if (error instanceof DirectoryError) return fail(error.message);
				throw error;
			}
		}
	);
}
