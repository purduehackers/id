import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	ProfileError,
	formatNationalPhone,
	formatPhone,
	parsePhoneInput,
	splitNameParts,
	splitPhone,
	validatePhone,
	validateProfile
} from '../src/lib/profile.ts';
import { user } from '../src/lib/server/db/auth.schema.ts';
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
			phone: '+17655550123',
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
			phone: '+447700900077',
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
	assert.deepEqual(splitPhone('+17655550123'), {
		countryCode: '+1',
		national: '(765) 555-0123'
	});
	assert.deepEqual(splitPhone(null), {
		countryCode: '+1',
		national: ''
	});
	assert.equal(formatPhone('+17655550123'), '+1 (765) 555-0123');
	assert.equal(formatPhone('+447700900077'), '+44 770 090 0077');
});

test('a country code can be typed one character at a time', () => {
	assert.deepEqual(parsePhoneInput('+', '+1'), { countryCode: '+1', national: '+' });
	assert.deepEqual(parsePhoneInput('+4', '+1'), { countryCode: '+1', national: '+4' });
	assert.deepEqual(parsePhoneInput('+44', '+1'), { countryCode: '+44', national: '' });
});

test('validatePhone never stores a number different from the one entered', () => {
	assert.throws(() => validatePhone('+7 912 345 6789', '+1'), ProfileError);
	assert.throws(() => validatePhone('+', '+1'), ProfileError);
	assert.throws(() => validatePhone('765 555 01234', '+1'), ProfileError);
	assert.throws(() => validatePhone('+1 765 555 01234', '+44'), ProfileError);
	assert.throws(() => validatePhone('+1 176 555 01234', '+1'), ProfileError);
	assert.throws(() => validatePhone('+1 1 765 555 0123', '+1'), ProfileError);
	assert.throws(() => validatePhone('1 176 555 0123', '+1'), ProfileError);
	assert.throws(() => validatePhone('0765 555 0123', '+1'), ProfileError);
	assert.throws(() => validatePhone('007700 900077', '+44'), ProfileError);
	assert.throws(() => validatePhone('0044 7700 900077', '+44'), ProfileError);
	assert.throws(() => validatePhone('01234567890123', '+44'), ProfileError);
	assert.throws(() => validatePhone('1234567890123456', '+44'), ProfileError);
});

test('validatePhone returns E.164', () => {
	assert.equal(validatePhone('', '+1'), null);
	assert.equal(validatePhone('(765) 555-0123', '+1'), '+17655550123');
	assert.equal(validatePhone('1 765 555 0123', '+1'), '+17655550123');
	assert.equal(validatePhone('+44 7700 900077', '+1'), '+447700900077');
	assert.equal(validatePhone('07700 900077', '+44'), '+447700900077');
	assert.equal(validatePhone('06 1234 5678', '+39'), '+390612345678');
});

test('splitNameParts guesses the parts of a free-text name', () => {
	assert.deepEqual(splitNameParts('Grace Brewster Hopper'), {
		firstName: 'Grace Brewster',
		lastName: 'Hopper'
	});
	assert.deepEqual(splitNameParts('Cher'), {
		firstName: 'Cher',
		lastName: ''
	});
});

test('user.name stays a generated column', () => {
	assert.equal(user.name.generated?.type, 'always');
});

test('rolesGranting expands roles for directory filtering', () => {
	assert.deepEqual(rolesGranting(['organizer']), ['organizer', 'admin']);
	assert.deepEqual(rolesGranting(['alumni']), ['alumni']);
	assert.deepEqual(rolesGranting(['organizer', 'alumni']), ['alumni', 'organizer', 'admin']);
	assert.deepEqual(rolesGranting(['admin']), ['admin']);
});
