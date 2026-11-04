import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProfileError, validateProfile } from '../src/lib/profile.ts';
import { rolesGranting } from '../src/lib/roles.ts';

test('validateProfile normalizes valid fields and optional empty values', () => {
	assert.deepEqual(validateProfile({ name: '  Purdue Pete  ', phone: '', graduationYear: '' }), {
		name: 'Purdue Pete',
		phone: null,
		graduationYear: null
	});

	assert.deepEqual(
		validateProfile({
			name: 'Ada Lovelace',
			phone: ' +1 (765) 555-0123 ',
			graduationYear: ' 2026 '
		}),
		{ name: 'Ada Lovelace', phone: '+1 (765) 555-0123', graduationYear: 2026 }
	);
});

test('validateProfile rejects invalid name, phone, and graduation year', () => {
	assert.throws(
		() => validateProfile({ name: '   ', phone: '', graduationYear: '' }),
		ProfileError
	);
	assert.throws(
		() => validateProfile({ name: 'Ada', phone: '123', graduationYear: '' }),
		ProfileError
	);
	assert.throws(
		() => validateProfile({ name: 'Ada', phone: 'not-a-phone', graduationYear: '' }),
		ProfileError
	);
	assert.throws(
		() => validateProfile({ name: 'Ada', phone: '', graduationYear: '26' }),
		ProfileError
	);
	assert.throws(
		() => validateProfile({ name: 'Ada', phone: '', graduationYear: '1800' }),
		ProfileError
	);
});

test('rolesGranting expands roles for directory filtering', () => {
	assert.deepEqual(rolesGranting(['organizer']), ['organizer', 'admin']);
	assert.deepEqual(rolesGranting(['alumni']), ['alumni']);
	assert.deepEqual(rolesGranting(['organizer', 'alumni']), ['alumni', 'organizer', 'admin']);
	assert.deepEqual(rolesGranting(['admin']), ['admin']);
});
