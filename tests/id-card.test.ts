import assert from 'node:assert/strict';
import { test } from 'node:test';
import { identicon } from '../src/lib/components/pixel.ts';
import { censorIdCard, type IdCardData } from '../src/lib/id-card.ts';

const card: IdCardData = {
	id: '0197a1b2-private-user-id',
	name: 'Matthew Stanciu',
	givenName: 'Matthew',
	familyName: 'Stanciu',
	username: 'secretname',
	image: 'https://example.com/photo.webp',
	email: 'secret@example.com',
	phone: '+17655550107',
	roles: ['organizer'],
	graduationYear: 2028,
	since: '2024-08-23T12:00:00Z',
	passports: [12, 40],
	linked: ['Discord']
};

test('censorIdCard keeps what is printed on the passport', () => {
	const censored = censorIdCard(card, 40);
	assert.equal(censored.censored, true);
	assert.equal(censored.name, 'Matthew Stanciu');
	assert.equal(censored.image, card.image);
	assert.deepEqual(censored.passports, [40]);
	assert.equal(censored.since, card.since);
	assert.equal(censored.username, 'secretname');
	assert.deepEqual(censored.roles, ['organizer']);
});

test('censorIdCard removes everything else, including the user id', () => {
	const sent = JSON.stringify(censorIdCard(card, 40));
	for (const secret of [card.id, 'secret@example.com', '+17655550107', '2028', 'Discord', '[12']) {
		assert.equal(sent.includes(secret), false, `leaked ${secret}`);
	}
});

test('censorIdCard preserves the original identicon across different passports', () => {
	const first = censorIdCard({ ...card, image: null }, 12);
	const second = censorIdCard({ ...card, image: null }, 40);
	assert.notEqual(first.id, card.id);
	assert.notEqual(first.id, second.id);
	assert.deepEqual(first.identiconCells, identicon(card.id));
	assert.deepEqual(first.identiconCells, second.identiconCells);
	assert.deepEqual(first.roles, card.roles); // Role supplies the same ink/accent colors.
	assert.deepEqual(censorIdCard(first, 12).identiconCells, first.identiconCells);
	assert.equal(JSON.stringify(first).includes(card.id), false);
});
