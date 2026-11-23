import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { auditEvent, passport } from '$lib/server/db/schema';
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

function describe(row: Row) {
	return {
		id: row.id,
		uid: row.uid,
		status: row.activated ? 'active' : 'pending',
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

async function byUid(uid: string) {
	const [row] = await db.select().from(passport).where(eq(passport.uid, uid)).limit(1);
	return row ?? null;
}

async function owned(issuer: Issuer, id: number) {
	if (!Number.isSafeInteger(id) || id < 1) throw notFound();
	const [row] = await db
		.select()
		.from(passport)
		.where(and(eq(passport.id, id), eq(passport.issuedBy, issuer.clientId)))
		.limit(1);
	if (!row?.uid || row.keyVersion === null) throw notFound();
	return row;
}

function reuse(issuer: Issuer, row: Row, scanUrl: URL) {
	if (row.issuedBy !== issuer.clientId) {
		throw new IssueError(409, 'uid_taken', 'Another issuer already registered this chip.');
	}
	if (row.activated) {
		throw new IssueError(409, 'already_active', 'This chip is already an active passport.');
	}
	return { created: false, body: { ...describe(row), ...personalization(row, scanUrl) } };
}

export async function issuePassport(issuer: Issuer, rawUid: unknown, scanUrl: URL) {
	const uid = normalizeUid(rawUid);
	if (!uid) {
		throw new IssueError(400, 'invalid_request', 'uid must be the 7-byte chip UID in hex.');
	}
	const version = currentKeyVersion();
	if (version === null) {
		throw new IssueError(503, 'temporarily_unavailable', 'Passport keys are not configured.');
	}

	const existing = await byUid(uid);
	if (existing) return reuse(issuer, existing, scanUrl);

	let row: Row;
	try {
		[row] = await db
			.insert(passport)
			.values({ uid, keyVersion: version, issuedBy: issuer.clientId, activated: false })
			.returning();
	} catch (error) {
		const raced = await byUid(uid);
		if (raced) return reuse(issuer, raced, scanUrl);
		throw error;
	}

	await db.insert(auditEvent).values({
		id: uuidv7(),
		action: 'passport-issue',
		actorId: null,
		actorUsername: `app:${issuer.clientId}`,
		targetId: null,
		targetUsername: 'nobody',
		appName: issuer.name,
		from: null,
		to: String(row.id)
	});
	return { created: true, body: { ...describe(row), ...personalization(row, scanUrl) } };
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
	const uid = Buffer.from(row.uid!, 'hex');
	const keys = keysForCard(row.keyVersion!, uid);
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
	return describe(activated);
}

export async function passportStatus(issuer: Issuer, id: number) {
	return describe(await owned(issuer, id));
}
