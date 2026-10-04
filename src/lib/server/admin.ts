import { desc, eq, or, sql } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { db } from '$lib/server/db';
import {
	auditEvent,
	oauthAccessToken,
	oauthRefreshToken,
	session,
	user
} from '$lib/server/db/schema';
import { uuidv7 } from '$lib/server/uuid';
import { isRole, outranks, type Role } from '$lib/roles';

type Actor = { id: string; username: string };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AdminError extends Error {}

export async function listUsers(query: string) {
	const q = query.trim().toLowerCase();
	const match = (column: AnySQLiteColumn) => sql`instr(lower(${column}), ${q}) > 0`;

	return db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			email: user.email,
			role: user.role,
			banned: user.banned,
			banReason: user.banReason,
			createdAt: user.createdAt
		})
		.from(user)
		.where(q ? or(match(user.username), match(user.email), match(user.name)) : undefined)
		.orderBy(desc(user.createdAt))
		.limit(50);
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

export async function setRole(actor: Actor, targetId: string, role: string) {
	if (!isRole(role)) throw new AdminError('That is not a role.');

	return db.transaction(async (tx) => {
		const target = await findTarget(tx, actor, targetId);
		const from = (isRole(target.role) ? target.role : 'member') as Role;
		if (from === role) return target.username;

		await tx.update(user).set({ role }).where(eq(user.id, target.id));
		await audit(tx, actor, target)({ action: 'role', from, to: role });
		if (outranks(from, role)) await revokeOAuthTokens(tx, target.id);

		return target.username;
	});
}

export async function ban(actor: Actor, targetId: string, reason: string) {
	return db.transaction(async (tx) => {
		const target = await findTarget(tx, actor, targetId);
		if (target.banned) return target.username;

		await tx
			.update(user)
			.set({ banned: true, banReason: reason || null, banExpires: null })
			.where(eq(user.id, target.id));
		await tx.delete(session).where(eq(session.userId, target.id));
		await revokeOAuthTokens(tx, target.id);
		await audit(tx, actor, target)({ action: 'ban', to: reason || null });

		return target.username;
	});
}

export async function unban(actor: Actor, targetId: string) {
	return db.transaction(async (tx) => {
		const target = await findTarget(tx, actor, targetId);
		if (!target.banned) return target.username;

		await tx
			.update(user)
			.set({ banned: false, banReason: null, banExpires: null })
			.where(eq(user.id, target.id));
		await audit(tx, actor, target)({ action: 'unban' });

		return target.username;
	});
}
