import { and, count, eq, gt, isNotNull, isNull, lt, ne, type SQL } from 'drizzle-orm';
import { constantTimeEqual } from 'better-auth/crypto';
import { db } from '$lib/server/db';
import {
	account,
	auditEvent,
	legacyMember,
	passport,
	passportLogin,
	passportTap,
	user
} from '$lib/server/db/schema';
import { uuidv7 } from '$lib/server/uuid';

export class PassportError extends Error {}

const LOGIN_TTL = 5 * 60_000;
const TAP_TTL = 30 * 60_000;
const MAX_PENDING_PER_IP = 5;
const MAX_PENDING = 5_000;

export const LOGIN_COOKIE = 'passport_login';
export const TAP_COOKIE = 'passport_tap';

const hex = (bytes: ArrayBuffer) => Buffer.from(bytes).toString('hex');
export const sha256 = async (value: string) =>
	hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
export const randomToken = () =>
	Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const randomCode = () =>
	String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');

type Actor = { id: string; username: string };
type Owner = { id: string; username: string; name: string };

function parseNumber(raw: string) {
	const id = Number(raw.trim());
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function findUser(where: SQL) {
	const [row] = await db
		.select({ id: user.id, username: user.username, name: user.name })
		.from(user)
		.where(where)
		.limit(1);
	return row ?? null;
}

async function ownerOf(p: {
	userId: string | null;
	discordId: string | null;
}): Promise<Owner | null> {
	if (p.userId) return findUser(eq(user.id, p.userId));
	if (!p.discordId) return null;
	const [row] = await db
		.select({ id: user.id, username: user.username, name: user.name })
		.from(account)
		.innerJoin(user, eq(user.id, account.userId))
		.where(and(eq(account.providerId, 'discord'), eq(account.accountId, p.discordId)))
		.limit(1);
	return row ?? null;
}

function audit(actor: Actor, passportId: number, target: Actor | null, previous: string | null) {
	return db.insert(auditEvent).values({
		id: uuidv7(),
		action: 'passport',
		actorId: actor.id,
		actorUsername: actor.username,
		targetId: target?.id ?? null,
		targetUsername: target?.username ?? 'nobody',
		from: previous,
		to: String(passportId)
	});
}

export async function startLogin(ip: string) {
	const now = new Date();
	await db.delete(passportLogin).where(lt(passportLogin.expiresAt, now));

	const ipHash = await sha256(ip);
	const pending = and(eq(passportLogin.status, 'pending'), gt(passportLogin.expiresAt, now));
	const [[fromIp], [overall]] = await Promise.all([
		db
			.select({ n: count() })
			.from(passportLogin)
			.where(and(pending, eq(passportLogin.ipHash, ipHash))),
		db.select({ n: count() }).from(passportLogin).where(pending)
	]);
	if (fromIp.n >= MAX_PENDING_PER_IP || overall.n >= MAX_PENDING) {
		throw new PassportError('Too many sign-ins are waiting. Try again in a few minutes.');
	}

	const taken = async (code: string) =>
		(
			await db
				.select({ id: passportLogin.id })
				.from(passportLogin)
				.where(and(pending, eq(passportLogin.code, code)))
				.limit(1)
		).length > 0;
	let code = randomCode();
	while (await taken(code)) code = randomCode();

	const login = { id: randomToken(), code };
	await db.insert(passportLogin).values({
		...login,
		ipHash,
		expiresAt: new Date(now.getTime() + LOGIN_TTL)
	});
	return login;
}

export async function loginState(loginId: string | undefined) {
	if (!loginId) return null;
	const [row] = await db
		.select({
			code: passportLogin.code,
			status: passportLogin.status,
			username: user.username,
			name: user.name
		})
		.from(passportLogin)
		.leftJoin(user, eq(user.id, passportLogin.userId))
		.where(and(eq(passportLogin.id, loginId), gt(passportLogin.expiresAt, new Date())))
		.limit(1);
	return row ?? null;
}

export async function claimApprovedLogin(loginId: string | undefined) {
	if (!loginId) return null;
	const [row] = await db
		.update(passportLogin)
		.set({ status: 'used' })
		.where(
			and(
				eq(passportLogin.id, loginId),
				eq(passportLogin.status, 'approved'),
				gt(passportLogin.expiresAt, new Date())
			)
		)
		.returning({ userId: passportLogin.userId });
	return row?.userId ?? null;
}

export async function cancelLogin(loginId: string | undefined) {
	if (loginId) await db.delete(passportLogin).where(eq(passportLogin.id, loginId));
}

export async function recordTap(rawNumber: string, secret: string) {
	const id = parseNumber(rawNumber);
	const [found] = id ? await db.select().from(passport).where(eq(passport.id, id)).limit(1) : [];
	if (!found?.activated || !constantTimeEqual(await sha256(secret), found.secretHash)) {
		throw new PassportError('This passport could not be read. Try tapping it again.');
	}

	const now = new Date();
	await db.delete(passportTap).where(lt(passportTap.expiresAt, now));
	const token = randomToken();
	await db.insert(passportTap).values({
		tokenHash: await sha256(token),
		passportId: found.id,
		expiresAt: new Date(now.getTime() + TAP_TTL)
	});
	return token;
}

async function tappedPassport(token: string | undefined) {
	if (!token) return null;
	const [tap] = await db
		.select({
			passportId: passportTap.passportId,
			userId: passport.userId,
			discordId: passport.discordId
		})
		.from(passportTap)
		.innerJoin(passport, eq(passport.id, passportTap.passportId))
		.where(
			and(eq(passportTap.tokenHash, await sha256(token)), gt(passportTap.expiresAt, new Date()))
		)
		.limit(1);
	return tap ?? null;
}

export async function tapState(token: string | undefined) {
	const tap = await tappedPassport(token);
	if (!tap) return null;
	const owner = await ownerOf(tap);
	const [returning] =
		owner || !tap.discordId
			? []
			: await db
					.select({ name: legacyMember.name, givenName: legacyMember.givenName })
					.from(legacyMember)
					.where(eq(legacyMember.discordId, tap.discordId))
					.limit(1);
	return { passportId: tap.passportId, owner, returning: returning ?? null };
}

async function ownedTap(token: string | undefined) {
	const tap = await tappedPassport(token);
	if (!tap) throw new PassportError('That tap expired. Tap your passport again.');
	await db.delete(passportTap).where(eq(passportTap.tokenHash, await sha256(token!)));
	const owner = await ownerOf(tap);
	if (!owner) throw new PassportError('This passport does not belong to anyone yet.');
	return { tap, owner };
}

export async function approveLogin(token: string | undefined, rawCode: string) {
	const { tap, owner } = await ownedTap(token);
	const matches = await db
		.select({ id: passportLogin.id })
		.from(passportLogin)
		.where(
			and(
				eq(passportLogin.code, rawCode.replace(/\D/g, '')),
				eq(passportLogin.status, 'pending'),
				gt(passportLogin.expiresAt, new Date())
			)
		);
	const [approved] =
		matches.length === 1
			? await db
					.update(passportLogin)
					.set({ status: 'approved', userId: owner.id, passportId: tap.passportId })
					.where(and(eq(passportLogin.id, matches[0].id), eq(passportLogin.status, 'pending')))
					.returning({ id: passportLogin.id })
			: [];
	if (!approved) {
		throw new PassportError(
			'That code does not match a waiting sign-in. Tap again and check the code.'
		);
	}
	return owner;
}

export async function signInHere(token: string | undefined) {
	return (await ownedTap(token)).owner;
}

export async function claimPassport(token: string | undefined, claimant: Actor) {
	const tap = await tappedPassport(token);
	if (!tap) throw new PassportError('That tap expired. Tap your passport again.');
	if (await ownerOf(tap)) throw new PassportError('This passport already belongs to someone.');

	const [claimed] = await db
		.update(passport)
		.set({ userId: claimant.id })
		.where(and(eq(passport.id, tap.passportId), isNull(passport.userId)))
		.returning({ id: passport.id });
	if (!claimed) throw new PassportError('This passport already belongs to someone.');

	await db.delete(passportTap).where(eq(passportTap.tokenHash, await sha256(token!)));
	await audit(claimant, tap.passportId, claimant, null);
	if (tap.discordId) {
		await db
			.update(legacyMember)
			.set({ claimedBy: claimant.id, claimedAt: new Date() })
			.where(and(eq(legacyMember.discordId, tap.discordId), isNull(legacyMember.claimedBy)));
	}
	return tap.passportId;
}

export async function recoverByDiscord(userId: string, discordId: string) {
	const taken = await db
		.select({ id: passport.id, holder: user.username })
		.from(passport)
		.leftJoin(user, eq(user.id, passport.userId))
		.where(
			and(
				eq(passport.discordId, discordId),
				isNotNull(passport.userId),
				ne(passport.userId, userId)
			)
		);
	if (taken.length === 0) return;

	const me = await findUser(eq(user.id, userId));
	if (!me) return;
	for (const p of taken) {
		await db.update(passport).set({ userId }).where(eq(passport.id, p.id));
		await audit(me, p.id, me, p.holder ?? null);
	}
}

export async function passportsOf(userId: string) {
	const [discord] = await db
		.select({ id: account.accountId })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'discord')))
		.limit(1);
	const rows = await db
		.select({ id: passport.id, userId: passport.userId, activated: passport.activated })
		.from(passport)
		.where(eq(passport.userId, userId));
	const viaDiscord = discord
		? await db
				.select({ id: passport.id, userId: passport.userId, activated: passport.activated })
				.from(passport)
				.where(and(eq(passport.discordId, discord.id), isNull(passport.userId)))
		: [];
	return [...rows, ...viaDiscord].sort((a, b) => a.id - b.id);
}

export async function assignPassport(actor: Actor, rawNumber: string, targetId: string | null) {
	const id = parseNumber(rawNumber);
	const [found] = id ? await db.select().from(passport).where(eq(passport.id, id)).limit(1) : [];
	if (!found) throw new PassportError('There is no passport with that number.');

	const previous = await ownerOf(found);
	const target = targetId ? await findUser(eq(user.id, targetId)) : null;
	if (targetId && !target) throw new PassportError('That user does not exist anymore.');

	await db
		.update(passport)
		.set({ userId: target?.id ?? null, discordId: null })
		.where(eq(passport.id, found.id));
	await audit(actor, found.id, target, previous?.username ?? null);
	return found.id;
}
