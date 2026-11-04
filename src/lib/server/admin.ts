import { and, count, desc, eq, inArray, not, or, sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { db } from '$lib/server/db';
import {
	account,
	auditEvent,
	oauthAccessToken,
	oauthRefreshToken,
	passkey,
	session,
	user
} from '$lib/server/db/schema';
import { uuidv7 } from '$lib/server/uuid';
import { isRole, losesRoles } from '$lib/roles';
import { banChanged, deliverSoon, enqueueForUser, rolesChanged } from '$lib/server/webhooks';

type Actor = { id: string; username: string };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AdminError extends Error {}

export const USER_FILTERS = ['unverified', 'banned'] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

export const isUserFilter = (value: unknown): value is UserFilter =>
	USER_FILTERS.includes(value as UserFilter);

const FILTERS: Record<UserFilter, () => SQL> = {
	unverified: () => not(user.emailVerified),
	banned: () => eq(user.banned, true)
};

function searchFor(query: string) {
	const q = query.trim().toLowerCase();
	const match = (column: AnySQLiteColumn) => sql`instr(lower(${column}), ${q}) > 0`;
	return q ? or(match(user.username), match(user.email), match(user.name)) : undefined;
}

export async function listUsers(query: string, filter: UserFilter | null) {
	const people = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			email: user.email,
			emailVerified: user.emailVerified,
			role: user.role,
			banned: user.banned,
			banReason: user.banReason,
			createdAt: user.createdAt
		})
		.from(user)
		.where(and(searchFor(query), filter ? FILTERS[filter]() : undefined))
		.orderBy(desc(user.createdAt))
		.limit(50);

	const ids = people.map((person) => person.id);
	const [accounts, passkeys] = ids.length
		? await Promise.all([
				db
					.select({ userId: account.userId, providerId: account.providerId })
					.from(account)
					.where(inArray(account.userId, ids)),
				db
					.select({ userId: passkey.userId, count: count() })
					.from(passkey)
					.where(inArray(passkey.userId, ids))
					.groupBy(passkey.userId)
			])
		: [[], []];
	const passkeysOf = new Map(passkeys.map((row) => [row.userId, row.count]));

	return people.map((person) => {
		const providers = accounts
			.filter((row) => row.userId === person.id)
			.map((row) => row.providerId);
		return {
			...person,
			hasPassword: providers.includes('credential'),
			connections: providers.filter((provider) => provider !== 'credential'),
			passkeys: passkeysOf.get(person.id) ?? 0
		};
	});
}

export async function countUsers(query: string) {
	const search = searchFor(query);
	const [everyone, ...filtered] = await Promise.all([
		db.$count(user, search),
		...USER_FILTERS.map((filter) => db.$count(user, and(search, FILTERS[filter]())))
	]);
	return {
		everyone,
		...(Object.fromEntries(USER_FILTERS.map((filter, i) => [filter, filtered[i]])) as Record<
			UserFilter,
			number
		>)
	};
}

export async function recentEvents() {
	return db.select().from(auditEvent).orderBy(desc(auditEvent.createdAt)).limit(30);
}

async function revokeOAuthTokens(tx: Tx, userId: string) {
	await tx.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, userId));
	await tx.delete(oauthRefreshToken).where(eq(oauthRefreshToken.userId, userId));
}

async function findTarget(tx: Tx, actor: Actor, targetId: string) {
	if (targetId === actor.id) throw new AdminError('You cannot change your own account here.');

	const [target] = await tx
		.select({ id: user.id, username: user.username, role: user.role, banned: user.banned })
		.from(user)
		.where(eq(user.id, targetId))
		.limit(1);
	if (!target) throw new AdminError('That user does not exist anymore.');
	return target;
}

function audit(tx: Tx, actor: Actor, target: { id: string; username: string }) {
	return (event: { action: 'role' | 'ban' | 'unban'; from?: string | null; to?: string | null }) =>
		tx.insert(auditEvent).values({
			id: uuidv7(),
			actorId: actor.id,
			actorUsername: actor.username,
			targetId: target.id,
			targetUsername: target.username,
			...event
		});
}

export async function setRole(actor: Actor, targetId: string, value: string) {
	const role = value || null;
	if (role !== null && !isRole(role)) throw new AdminError('That is not a role.');

	const username = await db.transaction(async (tx) => {
		const target = await findTarget(tx, actor, targetId);
		const from = isRole(target.role) ? target.role : null;
		if (from === role) return target.username;

		await tx.update(user).set({ role }).where(eq(user.id, target.id));
		await audit(tx, actor, target)({ action: 'role', from, to: role });
		await enqueueForUser(tx, target, 'user.roles.changed', rolesChanged(from, role));
		if (losesRoles(from, role)) await revokeOAuthTokens(tx, target.id);

		return target.username;
	});
	deliverSoon();
	return username;
}

export async function ban(actor: Actor, targetId: string, reason: string) {
	const username = await db.transaction(async (tx) => {
		const target = await findTarget(tx, actor, targetId);
		if (target.banned) return target.username;

		await tx
			.update(user)
			.set({ banned: true, banReason: reason || null, banExpires: null })
			.where(eq(user.id, target.id));
		await tx.delete(session).where(eq(session.userId, target.id));
		await revokeOAuthTokens(tx, target.id);
		await audit(tx, actor, target)({ action: 'ban', to: reason || null });
		await enqueueForUser(tx, target, 'user.banned', banChanged);

		return target.username;
	});
	deliverSoon();
	return username;
}

export async function unban(actor: Actor, targetId: string) {
	const username = await db.transaction(async (tx) => {
		const target = await findTarget(tx, actor, targetId);
		if (!target.banned) return target.username;

		await tx
			.update(user)
			.set({ banned: false, banReason: null, banExpires: null })
			.where(eq(user.id, target.id));
		await audit(tx, actor, target)({ action: 'unban' });
		await enqueueForUser(tx, target, 'user.unbanned', banChanged);

		return target.username;
	});
	deliverSoon();
	return username;
}
