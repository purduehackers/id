import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { account, session, user as userTable } from '$lib/server/db/schema';
import { emailsOf } from '$lib/server/emails';
import { authorizedApps, revokeApp } from '$lib/server/grants';
import { pictureFor } from '$lib/server/avatar';
import { ProfileError, updateProfile } from '$lib/server/profile';
import { activeSessions } from '$lib/server/sessions';
import { DEFAULT_PHONE_COUNTRY } from '$lib/profile';
import { SEMESTERS, termSemester, termYear } from '$lib/graduation';
import { rolesOf } from '$lib/roles';
import { PROVIDERS } from '$lib/providers';
import { fail, ok, type Caller } from './result';

async function profileOf(userId: string) {
	const [[row], emails, accounts] = await Promise.all([
		db.select().from(userTable).where(eq(userTable.id, userId)).limit(1),
		emailsOf(userId),
		db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, userId))
	]);
	if (!row) throw new Error('User not found.');

	const linked = new Set(accounts.map((a) => a.providerId));
	return {
		id: row.id,
		username: row.username,
		name: row.name,
		given_name: row.givenName,
		family_name: row.familyName,
		picture: pictureFor(row),
		email: row.email,
		email_verified: row.emailVerified,
		other_emails: emails.map((e) => ({ email: e.email, verified: e.verifiedAt !== null })),
		phone_number: row.phone,
		graduation:
			row.graduationTerm === null
				? null
				: { semester: termSemester(row.graduationTerm), year: termYear(row.graduationTerm) },
		roles: rolesOf(row),
		connections: Object.fromEntries(PROVIDERS.map((p) => [p.id, linked.has(p.id)])),
		security_emails: row.securityEmails
	};
}

export function registerMemberTools(server: McpServer, caller: Caller) {
	if (!caller.scopes.has('user:read') && !caller.scopes.has('user')) return;

	server.registerTool(
		'get_profile',
		{
			title: 'Get profile',
			description:
				'Get the profile of the signed-in member: name, username, emails, phone, graduation, roles and linked accounts.',
			annotations: { readOnlyHint: true, openWorldHint: false }
		},
		async () => ok(await profileOf(caller.userId))
	);

	server.registerTool(
		'list_sessions',
		{
			title: 'List signed-in devices',
			description: 'List the devices where the member is signed in to Purdue Hackers ID.',
			annotations: { readOnlyHint: true, openWorldHint: false }
		},
		async () => ok(await activeSessions(caller.userId))
	);

	server.registerTool(
		'list_authorized_apps',
		{
			title: 'List authorized apps',
			description: 'List the applications that the member let use their Purdue Hackers ID.',
			annotations: { readOnlyHint: true, openWorldHint: false }
		},
		async () => {
			const apps = await authorizedApps(caller.userId);
			return ok(apps.map((app) => ({ ...app, current: app.id === caller.clientId })));
		}
	);

	if (!caller.scopes.has('user')) return;

	server.registerTool(
		'update_profile',
		{
			title: 'Update profile',
			description:
				'Change the profile of the signed-in member. Omit a field to keep it. ' +
				'Set phone to null to remove it. Set graduation_semester or graduation_year to null to remove the graduation.',
			inputSchema: {
				first_name: z.string().optional(),
				last_name: z.string().optional(),
				phone: z
					.string()
					.nullable()
					.optional()
					.describe('International format, like +1 765 555 0100, or national format.'),
				phone_country: z
					.string()
					.length(2)
					.optional()
					.describe('Two-letter country code for a national phone number. Default: US.'),
				graduation_semester: z.enum(SEMESTERS).nullable().optional(),
				graduation_year: z.number().int().nullable().optional()
			},
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
		},
		async (input) => {
			const current = await profileOf(caller.userId);
			const clearGraduation = input.graduation_semester === null || input.graduation_year === null;
			try {
				await updateProfile(caller.userId, {
					firstName: input.first_name ?? current.given_name ?? '',
					lastName: input.last_name ?? current.family_name ?? '',
					phoneCountry: input.phone_country?.toUpperCase() ?? DEFAULT_PHONE_COUNTRY,
					phone: input.phone === undefined ? (current.phone_number ?? '') : (input.phone ?? ''),
					graduationSemester: clearGraduation
						? ''
						: (input.graduation_semester ?? current.graduation?.semester ?? ''),
					graduationYear: clearGraduation
						? ''
						: String(input.graduation_year ?? current.graduation?.year ?? '')
				});
			} catch (error) {
				if (error instanceof ProfileError) return fail(error.message);
				throw error;
			}
			return ok(await profileOf(caller.userId));
		}
	);

	server.registerTool(
		'sign_out_device',
		{
			title: 'Sign out a device',
			description: 'Sign out one device of the member. Get the session ID from list_sessions.',
			inputSchema: { session_id: z.string() },
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
		},
		async ({ session_id }) => {
			const [target] = await db
				.select({ token: session.token })
				.from(session)
				.where(and(eq(session.id, session_id), eq(session.userId, caller.userId)))
				.limit(1);
			if (!target) return fail('That session has already ended.');
			await caller.member.signOut(target.token);
			return ok({ signed_out: session_id });
		}
	);

	server.registerTool(
		'revoke_app',
		{
			title: 'Revoke an app',
			description:
				'Remove the access of an application to the Purdue Hackers ID of the member. Get the app ID from list_authorized_apps.',
			inputSchema: { app_id: z.string() },
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
		},
		async ({ app_id }) => {
			if (app_id === caller.clientId) {
				return fail('This app is the one you use now. Revoke it on the Authorized apps page.');
			}
			const removed = await revokeApp(caller.userId, app_id);
			return removed ? ok({ revoked: app_id }) : fail('That app is not on your list.');
		}
	);
}
