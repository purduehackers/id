import { and, eq, gt, lt } from 'drizzle-orm';
import { constantTimeEqual } from 'better-auth/crypto';
import { db } from '$lib/server/db';
import {
	account,
	legacyMember,
	passport,
	passportLogin,
	passportTap,
	user
} from '$lib/server/db/schema';

export class PassportError extends Error {}

const LOGIN_TTL = 5 * 60_000;
const TAP_TTL = 10 * 60_000;
const MAX_PENDING = 5;

export const LOGIN_COOKIE = 'passport_login';
export const TAP_COOKIE = 'passport_tap';

const hex = (bytes: ArrayBuffer) => Buffer.from(bytes).toString('hex');
export const sha256 = async (value: string) =>
	hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
export const randomToken = () =>
	Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const randomCode = () =>
	String(crypto.getRandomValues(new Uint32Array(1))[0] % 10_000).padStart(4, '0');

function parseNumber(raw: string) {
	const id = Number(raw.trim());
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function activePassport(id: number) {
	const [row] = await db.select().from(passport).where(eq(passport.id, id)).limit(1);
	return row?.activated ? row : null;
}

export async function ownerOf(discordId: string) {
	const [row] = await db
		.select({ id: user.id, username: user.username, name: user.name })
		.from(account)
		.innerJoin(user, eq(user.id, account.userId))
		.where(and(eq(account.providerId, 'discord'), eq(account.accountId, discordId)))
		.limit(1);
	return row ?? null;
}

const NOT_LINKED =
	'This passport is not connected to a Purdue Hackers ID yet. Sign in with your email, connect Discord on your account page, then try again.';

export async function startLogin(rawNumber: string) {
	const id = parseNumber(rawNumber);
	const found = id && (await activePassport(id));
	if (!found) throw new PassportError('That passport number is not active.');

	const now = new Date();
	await db.delete(passportLogin).where(lt(passportLogin.expiresAt, now));
	const pending = await db
		.select({ id: passportLogin.id, code: passportLogin.code })
		.from(passportLogin)
		.where(and(eq(passportLogin.passportId, found.id), eq(passportLogin.status, 'pending')));
	if (pending.length >= MAX_PENDING) {
		throw new PassportError(
			'Too many sign-ins are waiting for this passport. Try again in a few minutes.'
		);
	}

	const taken = new Set(pending.map((p) => p.code));
	let code = randomCode();
	while (taken.has(code)) code = randomCode();
	const login = { id: randomToken(), code };
	await db.insert(passportLogin).values({
		...login,
		passportId: found.id,
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
			expiresAt: passportLogin.expiresAt
		})
		.from(passportLogin)
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
	const found = id && (await activePassport(id));
	if (!found || !constantTimeEqual(await sha256(secret), found.secretHash)) {
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

export async function tappedPassport(token: string | undefined) {
	if (!token) return null;
	const [tap] = await db
		.select({ passportId: passportTap.passportId, discordId: passport.discordId })
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
	const owner = await ownerOf(tap.discordId);
	const [returning] = owner
		? []
		: await db
				.select({ name: legacyMember.name, givenName: legacyMember.givenName })
				.from(legacyMember)
				.where(eq(legacyMember.discordId, tap.discordId))
				.limit(1);
	return { passportId: tap.passportId, owner, returning: returning ?? null };
}

async function useTap(token: string | undefined) {
	const tap = await tappedPassport(token);
	if (!tap) throw new PassportError('That tap expired. Tap your passport again.');
	const owner = await ownerOf(tap.discordId);
	if (!owner) throw new PassportError(NOT_LINKED);
	return { tap, owner, tokenHash: await sha256(token!) };
}

export async function approveLogin(token: string | undefined, rawCode: string) {
	const { tap, owner, tokenHash } = await useTap(token);
	await db.delete(passportTap).where(eq(passportTap.tokenHash, tokenHash));

	const matches = await db
		.select({ id: passportLogin.id })
		.from(passportLogin)
		.where(
			and(
				eq(passportLogin.passportId, tap.passportId),
				eq(passportLogin.code, rawCode.replace(/\D/g, '')),
				eq(passportLogin.status, 'pending'),
				gt(passportLogin.expiresAt, new Date())
			)
		);
	const [approved] =
		matches.length === 1
			? await db
					.update(passportLogin)
					.set({ status: 'approved', userId: owner.id })
					.where(and(eq(passportLogin.id, matches[0].id), eq(passportLogin.status, 'pending')))
					.returning({ id: passportLogin.id })
			: [];
	if (!approved) {
		throw new PassportError(
			'That code does not match a sign-in waiting for this passport. Tap again and check the code.'
		);
	}
	return owner;
}

export async function signInHere(token: string | undefined) {
	const { owner, tokenHash } = await useTap(token);
	await db.delete(passportTap).where(eq(passportTap.tokenHash, tokenHash));
	return owner;
}
