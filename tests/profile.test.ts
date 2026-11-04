import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	ProfileError,
	formatNationalPhone,
	parsePhoneInput,
	splitNameParts,
	splitPhone,
	validateProfile
} from '../src/lib/profile.ts';
import { rolesGranting } from '../src/lib/roles.ts';

test('validateProfile normalizes first/last name, phone with country code, and graduation year', () => {
	assert.deepEqual(
		validateProfile({
			firstName: '  Purdue ',
			lastName: ' Pete  ',
			phoneCountry: '+1',
			phone: '',
			graduationYear: ''
		}),
		{
			name: 'Purdue Pete',
			givenName: 'Purdue',
			familyName: 'Pete',
			phone: null,
			graduationYear: null
		}
	);

	assert.deepEqual(
		validateProfile({
			firstName: 'Ada',
			lastName: 'Lovelace',
			phoneCountry: '+1',
			phone: '7655550123',
			graduationYear: ' 2026 '
		}),
		{
			name: 'Ada Lovelace',
			givenName: 'Ada',
			familyName: 'Lovelace',
			phone: '+1 (765) 555-0123',
			graduationYear: 2026
		}
	);

	assert.deepEqual(
		validateProfile({
			firstName: 'Alan',
			lastName: 'Turing',
			phoneCountry: '+44',
			phone: '7700900077',
			graduationYear: '2027'
		}),
		{
			name: 'Alan Turing',
			givenName: 'Alan',
			familyName: 'Turing',
			phone: '+44 770 090 0077',
			graduationYear: 2027
		}
	);
});

test('validateProfile rejects invalid first/last name, phone, and graduation year', () => {
	assert.throws(
		() =>
			validateProfile({
				firstName: '   ',
				lastName: 'Pete',
				phoneCountry: '+1',
				phone: '',
				graduationYear: ''
			}),
		ProfileError
	);
	assert.throws(
		() =>
			validateProfile({
				firstName: 'Purdue',
				lastName: '   ',
				phoneCountry: '+1',
				phone: '',
				graduationYear: ''
			}),
		ProfileError
	);
	assert.throws(
		() =>
			validateProfile({
				firstName: 'Ada',
				lastName: 'Lovelace',
				phoneCountry: '+1',
				phone: '123',
				graduationYear: ''
			}),
		ProfileError
	);
	assert.throws(
		() =>
			validateProfile({
				firstName: 'Ada',
				lastName: 'Lovelace',
				phoneCountry: '+999',
				phone: '7655550123',
				graduationYear: ''
			}),
		ProfileError
	);
	assert.throws(
		() =>
			validateProfile({
				firstName: 'Ada',
				lastName: 'Lovelace',
				phoneCountry: '+1',
				phone: '',
				graduationYear: '26'
			}),
		ProfileError
	);
	assert.throws(
		() =>
			validateProfile({
				firstName: 'Ada',
				lastName: 'Lovelace',
				phoneCountry: '+1',
				phone: '',
				graduationYear: '1800'
			}),
		ProfileError
	);
});

test('phone formatting and parsing handle country codes and national digits', () => {
	assert.equal(formatNationalPhone('7655550123', '+1'), '(765) 555-0123');
	assert.equal(formatNationalPhone('17655550123', '+1'), '(765) 555-0123');
	assert.equal(formatNationalPhone('76555', '+1'), '(765) 55');
	assert.deepEqual(parsePhoneInput('+44 7700 900077', '+1'), {
		countryCode: '+44',
		national: '770 090 0077'
	});
	assert.deepEqual(splitPhone('+1 (765) 555-0123'), {
		countryCode: '+1',
		national: '(765) 555-0123'
	});
	assert.deepEqual(splitPhone(null), {
		countryCode: '+1',
		national: ''
	});
});

test('splitNameParts prefers explicit given/family names and falls back to full name', () => {
	assert.deepEqual(
		splitNameParts({
			name: 'Grace Brewster Hopper',
			givenName: 'Grace Brewster',
			familyName: 'Hopper'
		}),
		{ firstName: 'Grace Brewster', lastName: 'Hopper' }
	);
	assert.deepEqual(splitNameParts({ name: 'Grace Brewster Hopper' }), {
		firstName: 'Grace Brewster',
		lastName: 'Hopper'
	});
	assert.deepEqual(splitNameParts({ name: 'Cher' }), {
		firstName: 'Cher',
		lastName: ''
	});
});

test('rolesGranting expands roles for directory filtering', () => {
	assert.deepEqual(rolesGranting(['organizer']), ['organizer', 'admin']);
	assert.deepEqual(rolesGranting(['alumni']), ['alumni']);
	assert.deepEqual(rolesGranting(['organizer', 'alumni']), ['alumni', 'organizer', 'admin']);
	assert.deepEqual(rolesGranting(['admin']), ['admin']);
});
