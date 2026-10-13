import { json } from '@sveltejs/kit';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { account, user } from '$lib/server/db/schema';
import { authorizeDirectoryRequest } from '$lib/server/directory';
import { grantedRoles } from '$lib/roles';

export const GET: RequestHandler = async ({ request, url }) => {
	const authorized = await authorizeDirectoryRequest(request);
	if (authorized instanceof Response) return authorized;
	const { scopes } = authorized;
	const withDiscord = scopes.has('directory:discord');

	const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);
	const cursor = url.searchParams.get('cursor');
	const discordId = url.searchParams.get('discord_id');
	if (discordId && !withDiscord) {
		return json(
			{
				error: 'insufficient_scope',
				error_description: 'Looking up by Discord needs directory:discord.'
			},
			{
				status: 403,
				headers: {
					'www-authenticate': 'Bearer error="insufficient_scope", scope="directory:discord"'
				}
			}
		);
	}

	const discord = db
		.select({ userId: account.userId, discordId: account.accountId })
		.from(account)
		.where(eq(account.providerId, 'discord'))
		.as('discord');

	const rows = await db
		.select({
			id: user.id,
			username: user.username,
			name: user.name,
			role: user.role,
			banned: user.banned,
			discordId: discord.discordId
		})
		.from(user)
		.leftJoin(discord, eq(discord.userId, user.id))
		.where(
			and(
				cursor ? gt(user.id, cursor) : undefined,
				discordId ? eq(discord.discordId, discordId) : undefined
			)
		)
		.orderBy(asc(user.id))
		.limit(limit + 1);

	const page = rows.slice(0, limit);
	return json({
		users: page.map((row) => ({
			sub: row.id,
			preferred_username: row.username,
			name: row.name,
			roles: grantedRoles(row.role),
			banned: row.banned,
			...(withDiscord && { discord_id: row.discordId ?? null })
		})),
		next_cursor: rows.length > limit ? page.at(-1)!.id : null
	});
};
