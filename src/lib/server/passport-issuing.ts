import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { auditEvent, passport, user } from '$lib/server/db/schema';
import {
	KEY_SLOTS,
	SDM_FILE_READ_KEY,
	SDM_META_READ_KEY,
	APP_MASTER_KEY,
	decryptPiccData,
	macMatches,
	normalizeUid,
	parseSunParams,
	sdmMac,
	sunTemplate
} from '$lib/server/ntag424';
import { currentKeyVersion, keysForCard } from '$lib/server/passport-keys';
import { alertPassportActivated } from '$lib/server/security-emails';
import { uuidv7 } from '$lib/server/uuid';

export class IssueError extends Error {
	constructor(
		readonly status: 400 | 404 | 409 | 422 | 503,
		readonly code: string,
		message: string
	) {
		super(message);
	}
}

export type Issuer = { clientId: string; name: string };

type Row = typeof passport.$inferSelect;

const notFound = () => new IssueError(404, 'not_found', 'There is no passport with that number.');

const MAX_REFERENCE_LENGTH = 200;

function describe(row: Row) {
	return {
		id: row.id,
		status: row.activated ? 'active' : row.uid ? 'pending' : 'unprogrammed',
		owner: row.userId,
		reference: row.reference,
		uid: row.uid,
		key_version: row.keyVersion,
		issued_at: row.importedAt.toISOString(),
		activated_at: row.activatedAt?.toISOString() ?? null
	};
}

function personalization(row: Row, scanUrl: URL) {
	const keys = keysForCard(row.keyVersion!, Buffer.from(row.uid!, 'hex'));
	if (!keys) {
		throw new IssueError(
			503,
			'temporarily_unavailable',
			'The keys for this passport are not loaded.'
		);
	}
	const template = sunTemplate(scanUrl);
	return {
		keys: Object.fromEntries(
			KEY_SLOTS.map((slot) => [slot, keys[slot].toString('hex').toUpperCase()])
		),
		sdm: {
			url: template.url,
			ndef: template.ndef.toString('hex').toUpperCase(),
			picc_data_offset: template.piccDataOffset,
			mac_input_offset: template.macInputOffset,
			mac_offset: template.macOffset,
			app_master_key: APP_MASTER_KEY,
			meta_read_key: SDM_META_READ_KEY,
			file_read_key: SDM_FILE_READ_KEY
		}
	};
}

async function owned(issuer: Issuer, id: number) {
	if (!Number.isSafeInteger(id) || id < 1) throw notFound();
	const [row] = await db
		.select()
		.from(passport)
		.where(and(eq(passport.id, id), eq(passport.issuedBy, issuer.clientId)))
		.limit(1);
	if (!row) throw notFound();
	return row;
}

async function byReference(issuer: Issuer, reference: string) {
	const [row] = await db
		.select()
		.from(passport)
		.where(and(eq(passport.issuedBy, issuer.clientId), eq(passport.reference, reference)))
		.limit(1);
	return row ?? null;
}

function parseOptional(raw: unknown, field: string) {
	if (raw === undefined || raw === null) return null;
	if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_REFERENCE_LENGTH) {
		throw new IssueError(
			400,
			'invalid_request',
			`${field} must be a string of 1 to ${MAX_REFERENCE_LENGTH} characters.`
		);
	}
	return raw.trim();
}

async function findOwner(id: string) {
	const [owner] = await db
		.select({ id: user.id, username: user.username, banned: user.banned })
		.from(user)
		.where(eq(user.id, id))
		.limit(1);
	if (!owner) throw new IssueError(422, 'invalid_owner', 'There is no member with that user ID.');
	if (owner.banned) throw new IssueError(422, 'invalid_owner', 'That member is suspended.');
	return owner;
}

function reuse(row: Row, ownerId: string | null) {
	if (ownerId && row.userId !== ownerId) {
		throw new IssueError(
			409,
			'reference_conflict',
			'This reference already belongs to a passport for another member.'
		);
	}
	return { created: false, body: describe(row) };
}

export async function createPassport(
	issuer: Issuer,
	input: { owner?: unknown; reference?: unknown }
) {
	const ownerId = parseOptional(input.owner, 'owner');
	const reference = parseOptional(input.reference, 'reference');

	if (reference) {
		const existing = await byReference(issuer, reference);
		if (existing) return reuse(existing, ownerId);
	}
	const owner = ownerId ? await findOwner(ownerId) : null;

	let row: Row;
	try {
		[row] = await db
			.insert(passport)
			.values({ issuedBy: issuer.clientId, reference, userId: owner?.id ?? null, activated: false })
			.returning();
	} catch (error) {
		const raced = reference ? await byReference(issuer, reference) : null;
		if (raced) return reuse(raced, ownerId);
		throw error;
	}

	await db.insert(auditEvent).values({
		id: uuidv7(),
		action: 'passport-issue',
		actorId: null,
		actorUsername: `app:${issuer.clientId}`,
		targetId: owner?.id ?? null,
		targetUsername: owner?.username ?? 'nobody',
		appName: issuer.name,
		from: null,
		to: String(row.id)
	});
	return { created: true, body: describe(row) };
}

export async function registerChip(issuer: Issuer, id: number, rawUid: unknown, scanUrl: URL) {
	const uid = normalizeUid(rawUid);
	if (!uid) {
		throw new IssueError(400, 'invalid_request', 'uid must be the 7-byte chip UID in hex.');
	}
	const row = await owned(issuer, id);
	if (row.activated) {
		throw new IssueError(409, 'already_active', 'This passport is already active.');
	}
	if (row.uid === uid && row.keyVersion !== null) {
		return { ...describe(row), ...personalization(row, scanUrl) };
	}
	const version = currentKeyVersion();
	if (version === null) {
		throw new IssueError(503, 'temporarily_unavailable', 'Passport keys are not configured.');
	}

	const taken = () => new IssueError(409, 'uid_taken', 'Another passport already uses this chip.');
	const [other] = await db
		.select({ id: passport.id })
		.from(passport)
		.where(eq(passport.uid, uid))
		.limit(1);
	if (other) throw taken();

	let updated: Row | undefined;
	try {
		[updated] = await db
			.update(passport)
			.set({ uid, keyVersion: version, readCounter: null })
			.where(and(eq(passport.id, row.id), eq(passport.activated, false)))
			.returning();
	} catch {
		throw taken();
	}
	if (!updated) throw new IssueError(409, 'already_active', 'This passport is already active.');
	return { ...describe(updated), ...personalization(updated, scanUrl) };
}

export async function activatePassport(issuer: Issuer, id: number, rawUrl: unknown) {
	const url = typeof rawUrl === 'string' ? URL.parse(rawUrl) : null;
	const sun = url && parseSunParams(url.searchParams.get('p'), url.searchParams.get('c'));
	if (!sun) {
		throw new IssueError(400, 'invalid_request', 'url must be the URL read from the chip.');
	}

	const row = await owned(issuer, id);
	if (row.activated) {
		throw new IssueError(409, 'already_active', 'This passport is already active.');
	}
	if (!row.uid || row.keyVersion === null) {
		throw new IssueError(409, 'no_chip', 'Register a chip for this passport first.');
	}
	const uid = Buffer.from(row.uid, 'hex');
	const keys = keysForCard(row.keyVersion, uid);
	if (!keys) {
		throw new IssueError(
			503,
			'temporarily_unavailable',
			'The keys for this passport are not loaded.'
		);
	}

	const picc = decryptPiccData(keys[SDM_META_READ_KEY], sun.picc);
	if (
		!picc ||
		!picc.uid.equals(uid) ||
		!macMatches(sdmMac(keys[SDM_FILE_READ_KEY], picc), sun.mac)
	) {
		throw new IssueError(
			422,
			'invalid_sun',
			'The chip did not produce a valid SUN message for this passport. Check its keys and SDM settings.'
		);
	}

	const [activated] = await db
		.update(passport)
		.set({ activated: true, activatedAt: new Date(), readCounter: picc.counter })
		.where(and(eq(passport.id, row.id), eq(passport.activated, false)))
		.returning();
	if (!activated) throw new IssueError(409, 'already_active', 'This passport is already active.');
	if (activated.userId) alertPassportActivated(activated.userId, activated.id);
	return describe(activated);
}

export async function passportStatus(issuer: Issuer, id: number) {
	return describe(await owned(issuer, id));
}
