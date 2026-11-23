import { createCipheriv, createDecipheriv, hkdfSync, timingSafeEqual } from 'node:crypto';

const BLOCK = 16;
const ZERO_IV = Buffer.alloc(BLOCK);
const RB = 0x87;

export const UID_LENGTH = 7;
export const PICC_DATA_HEX_LENGTH = 32;
export const SDM_MAC_HEX_LENGTH = 16;
const PICC_DATA_TAG = 0xc7;
const SV2_PREFIX = Buffer.from('3cc300010080', 'hex');
const DIVERSIFICATION_CONSTANT = 0x01;
const SYSTEM_IDENTIFIER = Buffer.from('PHID-PASSPORT', 'ascii');

export const KEY_SLOTS = [0, 1, 2, 3, 4] as const;
export type KeySlot = (typeof KEY_SLOTS)[number];
export const APP_MASTER_KEY: KeySlot = 0;
export const SDM_META_READ_KEY: KeySlot = 1;
export const SDM_FILE_READ_KEY: KeySlot = 2;

function encryptBlocks(key: Buffer, data: Buffer, iv = ZERO_IV) {
	const cipher = createCipheriv('aes-128-cbc', key, iv);
	cipher.setAutoPadding(false);
	return Buffer.concat([cipher.update(data), cipher.final()]);
}

function decryptBlocks(key: Buffer, data: Buffer) {
	const decipher = createDecipheriv('aes-128-cbc', key, ZERO_IV);
	decipher.setAutoPadding(false);
	return Buffer.concat([decipher.update(data), decipher.final()]);
}

function shiftLeft(block: Buffer) {
	const out = Buffer.alloc(BLOCK);
	for (let i = 0; i < BLOCK; i++) {
		out[i] = ((block[i] << 1) | (i + 1 < BLOCK ? block[i + 1] >> 7 : 0)) & 0xff;
	}
	if (block[0] & 0x80) out[BLOCK - 1] ^= RB;
	return out;
}

function subkeys(key: Buffer) {
	const k1 = shiftLeft(encryptBlocks(key, Buffer.alloc(BLOCK)));
	return { k1, k2: shiftLeft(k1) };
}

function xor(a: Buffer, b: Buffer) {
	const out = Buffer.alloc(a.length);
	for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
	return out;
}

function pad(data: Buffer, length: number) {
	const out = Buffer.alloc(length);
	data.copy(out);
	out[data.length] = 0x80;
	return out;
}

function macOver(key: Buffer, data: Buffer, padded: boolean) {
	const { k1, k2 } = subkeys(key);
	const last = data.length - BLOCK;
	const tail = xor(data.subarray(last), padded ? k2 : k1);
	const message = Buffer.concat([data.subarray(0, last), tail]);
	return encryptBlocks(key, message).subarray(-BLOCK);
}

export function aesCmac(key: Buffer, message: Buffer) {
	const complete = message.length > 0 && message.length % BLOCK === 0;
	const length = complete ? message.length : (Math.floor(message.length / BLOCK) + 1) * BLOCK;
	return macOver(key, complete ? message : pad(message, length), !complete);
}

export function diversifyKey(masterKey: Buffer, input: Buffer) {
	if (input.length < 1 || input.length > 31)
		throw new RangeError('Diversification input is 1-31 bytes.');
	const data = Buffer.concat([Buffer.from([DIVERSIFICATION_CONSTANT]), input]);
	return data.length === 2 * BLOCK
		? macOver(masterKey, data, false)
		: macOver(masterKey, pad(data, 2 * BLOCK), true);
}

export type KeySet = Record<KeySlot, Buffer>;

export function deriveMasterKey(rootKey: Buffer, version: number, slot: KeySlot) {
	const info = `purdue-hackers-id/ntag424/v${version}/key${slot}`;
	return Buffer.from(hkdfSync('sha256', rootKey, Buffer.alloc(0), info, BLOCK));
}

export function cardKeys(rootKey: Buffer, version: number, uid: Buffer): KeySet {
	const input = Buffer.concat([uid, SYSTEM_IDENTIFIER]);
	const keys = {} as KeySet;
	for (const slot of KEY_SLOTS) {
		const master = deriveMasterKey(rootKey, version, slot);
		keys[slot] = slot === SDM_META_READ_KEY ? master : diversifyKey(master, input);
	}
	return keys;
}

export type PiccData = { uid: Buffer; counter: number };

export function decryptPiccData(metaReadKey: Buffer, encrypted: Buffer): PiccData | null {
	if (encrypted.length !== BLOCK) return null;
	const plain = decryptBlocks(metaReadKey, encrypted);
	if (plain[0] !== PICC_DATA_TAG) return null;
	const uid = Buffer.from(plain.subarray(1, 1 + UID_LENGTH));
	return { uid, counter: plain.readUIntLE(1 + UID_LENGTH, 3) };
}

export function encryptPiccData(metaReadKey: Buffer, { uid, counter }: PiccData) {
	const plain = Buffer.alloc(BLOCK);
	plain[0] = PICC_DATA_TAG;
	uid.copy(plain, 1);
	plain.writeUIntLE(counter, 1 + UID_LENGTH, 3);
	return encryptBlocks(metaReadKey, plain);
}

export function sdmMac(
	fileReadKey: Buffer,
	{ uid, counter }: PiccData,
	macInput = Buffer.alloc(0)
) {
	const counterBytes = Buffer.alloc(3);
	counterBytes.writeUIntLE(counter, 0, 3);
	const sv2 = Buffer.concat([SV2_PREFIX, uid, counterBytes]);
	const full = aesCmac(aesCmac(fileReadKey, sv2), macInput);
	return Buffer.from([1, 3, 5, 7, 9, 11, 13, 15].map((i) => full[i]));
}

export function macMatches(expected: Buffer, actual: Buffer) {
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const hexOf = (length: number) => new RegExp(`^[0-9A-Fa-f]{${length}}$`);
const PICC_PATTERN = hexOf(PICC_DATA_HEX_LENGTH);
const MAC_PATTERN = hexOf(SDM_MAC_HEX_LENGTH);
const UID_PATTERN = /^04[0-9A-F]{12}$/;

export function parseSunParams(picc: string | null, mac: string | null) {
	if (!picc || !mac || !PICC_PATTERN.test(picc) || !MAC_PATTERN.test(mac)) return null;
	return { picc: Buffer.from(picc, 'hex'), mac: Buffer.from(mac, 'hex') };
}

export function normalizeUid(raw: unknown) {
	if (typeof raw !== 'string') return null;
	const uid = raw.replace(/[\s:-]/g, '').toUpperCase();
	return UID_PATTERN.test(uid) ? uid : null;
}

const URI_PREFIX_HTTPS = 0x04;
const NDEF_TNF_WELL_KNOWN_SHORT = 0xd1;
const NDEF_TYPE_URI = 0x55;
const NDEF_HEADER_LENGTH = 7;

export function sunTemplate(scanUrl: URL) {
	if (scanUrl.protocol !== 'https:') throw new Error('The scan URL must use https.');
	const base = `${scanUrl.host}${scanUrl.pathname}`;
	const piccPrefix = `${base}?p=`;
	const macPrefix = `&c=`;
	const rest = `${piccPrefix}${'0'.repeat(PICC_DATA_HEX_LENGTH)}${macPrefix}${'0'.repeat(SDM_MAC_HEX_LENGTH)}`;
	const payload = Buffer.concat([Buffer.from([URI_PREFIX_HTTPS]), Buffer.from(rest, 'ascii')]);
	if (payload.length > 0xff) throw new Error('The scan URL is too long for a short NDEF record.');

	const record = Buffer.concat([
		Buffer.from([NDEF_TNF_WELL_KNOWN_SHORT, 0x01, payload.length, NDEF_TYPE_URI]),
		payload
	]);
	const nlen = Buffer.alloc(2);
	nlen.writeUInt16BE(record.length);

	const piccDataOffset = NDEF_HEADER_LENGTH + piccPrefix.length;
	const macOffset = piccDataOffset + PICC_DATA_HEX_LENGTH + macPrefix.length;
	return {
		url: `https://${rest}`,
		ndef: Buffer.concat([nlen, record]),
		piccDataOffset,
		macInputOffset: macOffset,
		macOffset
	};
}
