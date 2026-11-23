import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	aesCmac,
	cardKeys,
	decryptPiccData,
	diversifyKey,
	encryptPiccData,
	macMatches,
	normalizeUid,
	parseSunParams,
	sdmMac,
	sunTemplate
} from '../src/lib/server/ntag424.ts';

const hex = (value: string) => Buffer.from(value.replace(/\s/g, ''), 'hex');

test('aesCmac matches the RFC 4493 vectors', () => {
	const key = hex('2b7e151628aed2a6abf7158809cf4f3c');
	const message = hex(
		'6bc1bee22e409f96e93d7e117393172a ae2d8a571e03ac9c9eb76fac45af8e51' +
			'30c81c46a35ce411e5fbc1191a0a52ef f69f2445df4f9b17ad2b417be66c3710'
	);
	assert.equal(aesCmac(key, Buffer.alloc(0)).toString('hex'), 'bb1d6929e95937287fa37d129b756746');
	assert.equal(
		aesCmac(key, message.subarray(0, 16)).toString('hex'),
		'070a16b46b4d4144f79bdd9dd04a287c'
	);
	assert.equal(
		aesCmac(key, message.subarray(0, 40)).toString('hex'),
		'dfa66747de9ae63030ca32611497c827'
	);
	assert.equal(aesCmac(key, message).toString('hex'), '51f0bebf7e3b9d92fc49741779363cfe');
});

test('diversifyKey matches the NXP AN10922 AES-128 vector', () => {
	const master = hex('00112233445566778899AABBCCDDEEFF');
	const input = hex('04782E21801D80 3042F5 4E585020416275');
	assert.equal(
		diversifyKey(master, input).toString('hex').toUpperCase(),
		'A8DD63A3B89D54B37CA802473FDA9175'
	);
});

test('SUN verification matches the NXP AN12196 vector', () => {
	const zero = Buffer.alloc(16);
	const picc = decryptPiccData(zero, hex('EF963FF7828658A599F3041510671E88'));
	assert.ok(picc);
	assert.equal(picc.uid.toString('hex').toUpperCase(), '04DE5F1EACC040');
	assert.equal(picc.counter, 61);
	assert.equal(sdmMac(zero, picc).toString('hex').toUpperCase(), '94EED9EE65337086');
});

test('decryptPiccData rejects data from the wrong key', () => {
	const wrong = Buffer.alloc(16, 1);
	assert.equal(decryptPiccData(wrong, hex('EF963FF7828658A599F3041510671E88')), null);
});

test('a simulated tap round-trips with derived card keys', () => {
	const root = Buffer.alloc(32, 7);
	const uid = hex('04A1B2C3D4E5F6');
	const keys = cardKeys(root, 1, uid);
	const encrypted = encryptPiccData(keys[1], { uid, counter: 0x123456 });
	const picc = decryptPiccData(keys[1], encrypted);
	assert.ok(picc);
	assert.equal(picc.counter, 0x123456);
	assert.ok(macMatches(sdmMac(keys[2], picc), sdmMac(keys[2], { uid, counter: 0x123456 })));
	assert.ok(!macMatches(sdmMac(keys[2], picc), sdmMac(keys[2], { uid, counter: 0x123457 })));
});

test('cardKeys separates slots, cards and versions', () => {
	const root = Buffer.alloc(32, 7);
	const a = cardKeys(root, 1, hex('04A1B2C3D4E5F6'));
	const b = cardKeys(root, 1, hex('04A1B2C3D4E5F7'));
	const v2 = cardKeys(root, 2, hex('04A1B2C3D4E5F6'));
	const all = [...Object.values(a), ...Object.values(b), ...Object.values(v2)].map((k) =>
		k.toString('hex')
	);
	assert.equal(new Set(all).size, all.length - 1, 'only the shared meta read key repeats');
	assert.deepEqual(a[1], b[1]);
	assert.notDeepEqual(a[1], v2[1]);
});

test('sunTemplate offsets point at the placeholders', () => {
	const t = sunTemplate(new URL('https://id.purduehackers.com/scan'));
	assert.equal(t.ndef.readUInt16BE(0), t.ndef.length - 2);
	const at = (offset: number, length: number) =>
		t.ndef.subarray(offset, offset + length).toString('ascii');
	assert.equal(at(t.piccDataOffset - 3, 3), '?p=');
	assert.equal(at(t.piccDataOffset, 32), '0'.repeat(32));
	assert.equal(at(t.macOffset - 3, 3), '&c=');
	assert.equal(at(t.macOffset, 16), '0'.repeat(16));
	assert.equal(t.macOffset + 16, t.ndef.length);
	assert.equal(t.url, `https://id.purduehackers.com/scan?p=${'0'.repeat(32)}&c=${'0'.repeat(16)}`);
});

test('input parsers reject malformed values', () => {
	assert.equal(normalizeUid('04:a1:b2:c3:d4:e5:f6'), '04A1B2C3D4E5F6');
	assert.equal(normalizeUid('05A1B2C3D4E5F6'), null);
	assert.equal(normalizeUid('04A1B2'), null);
	assert.equal(parseSunParams('zz'.repeat(16), '00'.repeat(8)), null);
	assert.equal(parseSunParams('00'.repeat(16), '00'.repeat(7)), null);
	assert.ok(parseSunParams('00'.repeat(16), '00'.repeat(8)));
});
