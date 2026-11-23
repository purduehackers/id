import { env } from '$env/dynamic/private';
import { SDM_META_READ_KEY, cardKeys, deriveMasterKey } from '$lib/server/ntag424';

const MIN_ROOT_KEY_BYTES = 32;

type RootKeys = { current: number; byVersion: Map<number, Buffer> };

function parseRootKeys(raw: string | undefined): RootKeys | null {
	if (!raw?.trim()) return null;
	const byVersion = new Map<number, Buffer>();
	for (const entry of raw.split(',')) {
		const match = entry.trim().match(/^(\d+):(.+)$/);
		if (!match) throw new Error('PASSPORT_ROOT_KEYS entries must look like "1:<base64>".');
		const version = Number(match[1]);
		const key = Buffer.from(match[2], 'base64');
		if (!Number.isSafeInteger(version) || version < 1) {
			throw new Error('PASSPORT_ROOT_KEYS versions must be positive integers.');
		}
		if (key.length < MIN_ROOT_KEY_BYTES) {
			throw new Error(`PASSPORT_ROOT_KEYS keys must be at least ${MIN_ROOT_KEY_BYTES} bytes.`);
		}
		if (byVersion.has(version)) throw new Error(`PASSPORT_ROOT_KEYS repeats version ${version}.`);
		byVersion.set(version, key);
	}
	return { current: Math.max(...byVersion.keys()), byVersion };
}

let cached: { raw: string | undefined; keys: RootKeys | null } | null = null;

function rootKeys() {
	const raw = env.PASSPORT_ROOT_KEYS;
	if (!cached || cached.raw !== raw) cached = { raw, keys: parseRootKeys(raw) };
	return cached.keys;
}

export function chipKeysConfigured() {
	return rootKeys() !== null;
}

export function currentKeyVersion() {
	return rootKeys()?.current ?? null;
}

export function keysForCard(version: number, uid: Buffer) {
	const root = rootKeys()?.byVersion.get(version);
	return root ? cardKeys(root, version, uid) : null;
}

export function metaReadKeys() {
	const keys = rootKeys();
	if (!keys) return [];
	return [...keys.byVersion]
		.sort(([a], [b]) => b - a)
		.map(([version, root]) => ({
			version,
			key: deriveMasterKey(root, version, SDM_META_READ_KEY)
		}));
}
