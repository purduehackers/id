import { and, asc, eq, isNotNull, ne } from 'drizzle-orm';
import { constantTimeEqual } from 'better-auth/crypto';
import { auth, devFixedOtp } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user, userEmail } from '$lib/server/db/schema';
import { sendEmail } from '$lib/server/email';
import { uuidv7 } from '$lib/server/uuid';

export class EmailError extends Error {}

const MAX_EMAILS = 5;
const CODE_TTL = 10 * 60_000;
const RESEND_COOLDOWN = 60_000;
const MAX_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hex = (bytes: ArrayBuffer) => Buffer.from(bytes).toString('hex');
const hashCode = async (id: string, code: string) =>
	hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${id}:${code}`)));
const randomCode = () =>
	devFixedOtp ?? String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

async function primaryOwner(email: string) {
	const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
	return row?.id ?? null;
}

async function verifiedOwner(email: string) {
	const [row] = await db
		.select({ userId: userEmail.userId })
		.from(userEmail)
		.where(and(eq(userEmail.email, email), isNotNull(userEmail.verifiedAt)))
		.limit(1);
	return row?.userId ?? null;
}

async function takenByOther(userId: string, email: string) {
	const owner = (await primaryOwner(email)) ?? (await verifiedOwner(email));
	return owner !== null && owner !== userId;
}

export function emailsOf(userId: string) {
	return db
		.select({ id: userEmail.id, email: userEmail.email, verifiedAt: userEmail.verifiedAt })
		.from(userEmail)
		.where(eq(userEmail.userId, userId))
		.orderBy(asc(userEmail.createdAt));
}

export async function primaryEmailFor(email: string) {
	const normalized = normalizeEmail(email);
	if (await primaryOwner(normalized)) return normalized;
	const [row] = await db
		.select({ email: user.email })
		.from(userEmail)
		.innerJoin(user, eq(user.id, userEmail.userId))
		.where(and(eq(userEmail.email, normalized), isNotNull(userEmail.verifiedAt)))
		.limit(1);
	return row?.email ?? normalized;
}

export async function isVerifiedSecondary(email: string) {
	return (await verifiedOwner(normalizeEmail(email))) !== null;
}

async function sendCode(id: string, email: string) {
	const code = randomCode();
	await db
		.update(userEmail)
		.set({ codeHash: await hashCode(id, code), codeSentAt: new Date(), codeAttempts: 0 })
		.where(eq(userEmail.id, id));
	await sendEmail({
		to: email,
		subject: `${code} is your Purdue Hackers ID code`,
		text: [
			`Your code to add this address to your Purdue Hackers ID is ${code}.`,
			'',
			'It expires in ten minutes. If you did not ask for this, you can ignore this email.'
		].join('\n')
	});
}

export async function addEmail(owner: { id: string; email: string }, raw: string) {
	const email = normalizeEmail(raw);
	if (!EMAIL_PATTERN.test(email)) throw new EmailError('That does not look like an email address.');
	if (email === owner.email.toLowerCase()) {
		throw new EmailError('That is already your primary email.');
	}

	const existing = await emailsOf(owner.id);
	if (existing.some((e) => e.email === email)) {
		throw new EmailError('You already added that address.');
	}
	if (existing.length >= MAX_EMAILS) {
		throw new EmailError(`You can add up to ${MAX_EMAILS} addresses.`);
	}
	if (await takenByOther(owner.id, email)) {
		throw new EmailError('That address belongs to a different Purdue Hackers ID.');
	}

	const id = uuidv7();
	await db.insert(userEmail).values({ id, userId: owner.id, email });
	await sendCode(id, email);
	return email;
}

async function ownedEmail(userId: string, id: string) {
	const [row] = await db
		.select()
		.from(userEmail)
		.where(and(eq(userEmail.id, id), eq(userEmail.userId, userId)))
		.limit(1);
	if (!row) throw new EmailError('That address is not on your account.');
	return row;
}

export async function resendCode(userId: string, id: string) {
	const row = await ownedEmail(userId, id);
	if (row.verifiedAt) throw new EmailError('That address is already verified.');
	if (row.codeSentAt && Date.now() - row.codeSentAt.getTime() < RESEND_COOLDOWN) {
		throw new EmailError('Wait a minute before asking for another code.');
	}
	await sendCode(row.id, row.email);
	return row.email;
}

export async function verifyEmail(userId: string, id: string, rawCode: string) {
	const row = await ownedEmail(userId, id);
	if (row.verifiedAt) return row.email;

	const expired =
		!row.codeHash || !row.codeSentAt || Date.now() - row.codeSentAt.getTime() > CODE_TTL;
	if (expired || row.codeAttempts >= MAX_ATTEMPTS) {
		throw new EmailError('That code expired. Send a new one.');
	}

	const matches = constantTimeEqual(
		await hashCode(row.id, rawCode.replace(/\D/g, '')),
		row.codeHash!
	);
	if (!matches) {
		await db
			.update(userEmail)
			.set({ codeAttempts: row.codeAttempts + 1 })
			.where(eq(userEmail.id, row.id));
		throw new EmailError('That code did not work.');
	}

	if (await takenByOther(userId, row.email)) {
		throw new EmailError('That address belongs to a different Purdue Hackers ID.');
	}

	await db
		.update(userEmail)
		.set({ verifiedAt: new Date(), codeHash: null, codeSentAt: null, codeAttempts: 0 })
		.where(eq(userEmail.id, row.id));
	await db
		.delete(userEmail)
		.where(and(eq(userEmail.email, row.email), ne(userEmail.userId, userId)));
	return row.email;
}

export async function removeEmail(userId: string, id: string) {
	const row = await ownedEmail(userId, id);
	await db.delete(userEmail).where(eq(userEmail.id, row.id));
	return row.email;
}

export async function makePrimary(
	owner: { id: string; email: string; emailVerified: boolean },
	id: string
) {
	const row = await ownedEmail(owner.id, id);
	if (!row.verifiedAt) throw new EmailError('Verify that address before making it primary.');

	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(owner.id, { email: row.email, emailVerified: true });

	if (owner.emailVerified) {
		await db
			.update(userEmail)
			.set({ email: owner.email.toLowerCase(), verifiedAt: new Date() })
			.where(eq(userEmail.id, row.id));
	} else {
		await db.delete(userEmail).where(eq(userEmail.id, row.id));
	}
	return row.email;
}
