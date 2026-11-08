import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	ProfileError,
	capitalizeName,
	formatNationalPhone,
	formatPhone,
	parsePhoneInput,
	splitNameParts,
	splitPhone,
	validatePhone,
	validateProfile
} from '../src/lib/profile.ts';
import { user } from '../src/lib/server/db/auth.schema.ts';
import { parseRoles, rolesOf, serializeRoles, toRoles } from '../src/lib/roles.ts';
import { termSemester, termYear, toTerm } from '../src/lib/graduation.ts';

test('validateProfile normalizes first/last name, phone with country code, and graduation year', () => {
	assert.deepEqual(
		validateProfile({
			firstName: '  Purdue ',
			lastName: ' Pete  ',
			phoneCountry: 'US',
			phone: '',
			graduationSemester: '',
			graduationYear: ''
		}),
		{
			name: 'Purdue Pete',
			givenName: 'Purdue',
			familyName: 'Pete',
			phone: null,
			graduationTerm: null
		}
	);

	assert.deepEqual(
		validateProfile({
			firstName: 'Ada',
			lastName: 'Lovelace',
			phoneCountry: 'US',
			phone: '7655550123',
			graduationSemester: 'spring',
			graduationYear: ' 2026 '
		}),
		{
			name: 'Ada Lovelace',
			givenName: 'Ada',
			familyName: 'Lovelace',
			phone: '+17655550123',
			graduationTerm: 4052
		}
	);

	assert.deepEqual(
		validateProfile({
			firstName: 'Alan',
			lastName: 'Turing',
			phoneCountry: 'GB',
			phone: '7400123456',
			graduationSemester: 'fall',
			graduationYear: '2027'
		}),
		{
			name: 'Alan Turing',
			givenName: 'Alan',
			familyName: 'Turing',
			phone: '+447400123456',
			graduationTerm: 4055
		}
	);
});

test('validateProfile rejects invalid first/last name, phone, and graduation year', () => {
	assert.throws(
		() =>
			validateProfile({
				firstName: '   ',
				lastName: 'Pete',
				phoneCountry: 'US',
				phone: '',
				graduationSemester: '',
				graduationYear: ''
			}),
		ProfileError
	);
	assert.throws(
		() =>
			validateProfile({
				firstName: 'Purdue',
				lastName: '   ',
				phoneCountry: 'US',
				phone: '',
				graduationSemester: '',
				graduationYear: ''
			}),
		ProfileError
	);
	assert.throws(
		() =>
			validateProfile({
				firstName: 'Ada',
				lastName: 'Lovelace',
				phoneCountry: 'US',
				phone: '123',
				graduationSemester: '',
				graduationYear: ''
			}),
		ProfileError
	);
	assert.throws(
		() =>
			validateProfile({
				firstName: 'Ada',
				lastName: 'Lovelace',
				phoneCountry: 'ZZ',
				phone: '7655550123',
				graduationSemester: '',
				graduationYear: ''
			}),
		ProfileError
	);
	assert.throws(
		() =>
			validateProfile({
				firstName: 'Ada',
				lastName: 'Lovelace',
				phoneCountry: 'US',
				phone: '',
				graduationSemester: 'spring',
				graduationYear: '26'
			}),
		ProfileError
	);
	assert.throws(
		() =>
			validateProfile({
				firstName: 'Ada',
				lastName: 'Lovelace',
				phoneCountry: 'US',
				phone: '',
				graduationSemester: 'spring',
				graduationYear: '1800'
			}),
		ProfileError
	);
});

test('phone numbers are grouped the way each country writes them', () => {
	assert.equal(formatNationalPhone('7655550123', 'US'), '(765) 555-0123');
	assert.equal(formatNationalPhone('76555', 'US'), '(765) 55');
	assert.equal(formatNationalPhone('11912345678', 'BR'), '(11) 91234-5678');
	assert.equal(formatNationalPhone('0612345678', 'FR'), '06 12 34 56 78');
	assert.equal(formatNationalPhone('9876543210', 'IN'), '98765 43210');
	assert.equal(formatNationalPhone('7400123456', 'GB'), '7400 123456');
	assert.equal(formatNationalPhone('07400123456', 'GB'), '07400 123456');
	assert.equal(formatNationalPhone('15123456789', 'DE'), '1512 3456789');
});

test('deleting back through a phone number never gets stuck on punctuation', () => {
	assert.equal(formatNationalPhone('765', 'US'), '(765');
	assert.equal(formatNationalPhone('(76', 'US'), '76');
});

test('formatting never drops digits', () => {
	const tooLong = '90123456789012345678';
	assert.equal(formatNationalPhone(tooLong, 'BR').replace(/\D/g, ''), tooLong);
});

test('a pasted or stored number picks its own country', () => {
	assert.deepEqual(parsePhoneInput('+44 7400 123456', 'US'), {
		country: 'GB',
		national: '7400 123456'
	});
	assert.deepEqual(parsePhoneInput('+55 11 91234-5678', 'US'), {
		country: 'BR',
		national: '(11) 91234-5678'
	});
	assert.deepEqual(splitPhone('+17655550123'), { country: 'US', national: '(765) 555-0123' });
	assert.deepEqual(splitPhone('+14165550123'), { country: 'CA', national: '(416) 555-0123' });
	assert.equal(splitPhone('+390612345678').country, 'IT');
	assert.deepEqual(splitPhone(null), { country: 'US', national: '' });
	assert.equal(formatPhone('+5511912345678'), '+55 11 91234 5678');
	assert.equal(formatPhone('not a number'), 'not a number');
});

test('a country code can be typed one character at a time', () => {
	assert.deepEqual(parsePhoneInput('+', 'US'), { country: 'US', national: '+' });
	assert.deepEqual(parsePhoneInput('+4', 'US'), { country: 'US', national: '+4' });
	assert.deepEqual(parsePhoneInput('+44', 'US'), { country: 'GB', national: '' });
	assert.deepEqual(parsePhoneInput('+1', 'BR'), { country: 'US', national: '' });
	assert.deepEqual(parsePhoneInput('+1', 'CA'), { country: 'CA', national: '' });
});

test('validatePhone rejects numbers that are not real for the country', () => {
	assert.throws(() => validatePhone('123', 'US'), ProfileError);
	assert.throws(() => validatePhone('+', 'US'), ProfileError);
	assert.throws(() => validatePhone('765 555 01234', 'US'), ProfileError);
	assert.throws(() => validatePhone('0765 555 0123', 'US'), ProfileError);
	assert.throws(() => validatePhone('1 176 555 0123', 'US'), ProfileError);
	assert.throws(() => validatePhone('1234567890123456', 'GB'), ProfileError);
	assert.throws(() => validatePhone('07700 900077', 'GB'), ProfileError);
	assert.throws(() => validatePhone('+999 123456789', 'US'), ProfileError);
	assert.throws(() => validatePhone('7655550123', 'ZZ'), ProfileError);
});

test('validatePhone returns E.164', () => {
	assert.equal(validatePhone('', 'US'), null);
	assert.equal(validatePhone('(765) 555-0123', 'US'), '+17655550123');
	assert.equal(validatePhone('1 765 555 0123', 'US'), '+17655550123');
	assert.equal(validatePhone('+44 7400 123456', 'US'), '+447400123456');
	assert.equal(validatePhone('07400 123456', 'GB'), '+447400123456');
	assert.equal(validatePhone('06 1234 5678', 'IT'), '+390612345678');
	assert.equal(validatePhone('(11) 91234-5678', 'BR'), '+5511912345678');
	assert.equal(validatePhone('+7 912 345 6789', 'US'), '+79123456789');
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

test('roles are a list where admin implies organizer', () => {
	assert.deepEqual(toRoles(['admin']), ['admin', 'organizer']);
	assert.deepEqual(toRoles(['organizer', 'admin']), ['admin', 'organizer']);
	assert.deepEqual(toRoles(['alumni', 'nope']), []);
	assert.deepEqual(parseRoles('organizer,alumni'), ['organizer']);
	assert.deepEqual(parseRoles(null), []);
	assert.equal(serializeRoles(toRoles(['admin'])), 'admin,organizer');
	assert.equal(serializeRoles([]), null);
});

test('alumni comes from the graduation term once it has ended', () => {
	const grad = (semester: 'spring' | 'fall', year: number, role: string | null = null) => ({
		role,
		graduationTerm: toTerm(year, semester)
	});
	const may = new Date('2027-05-31T12:00:00Z');
	const june = new Date('2027-06-01T12:00:00Z');
	const newYear = new Date('2028-01-01T12:00:00Z');

	assert.deepEqual(rolesOf(grad('spring', 2027), may), []);
	assert.deepEqual(rolesOf(grad('spring', 2027), june), ['alumni']);
	assert.deepEqual(rolesOf(grad('fall', 2027), june), []);
	assert.deepEqual(rolesOf(grad('fall', 2027), newYear), ['alumni']);
	assert.deepEqual(rolesOf(grad('fall', 2020, 'admin,organizer'), may), [
		'admin',
		'organizer',
		'alumni'
	]);
	assert.deepEqual(rolesOf({ role: null, graduationTerm: null }, may), []);
});

test('a graduation term round-trips its semester and year', () => {
	assert.equal(toTerm(2027, 'spring'), 4054);
	assert.equal(toTerm(2027, 'fall'), 4055);
	assert.equal(termYear(4055), 2027);
	assert.equal(termSemester(4055), 'fall');
	assert.equal(termSemester(4054), 'spring');
});

test('graduation needs both a semester and a year, or neither', () => {
	const base = { firstName: 'Ada', lastName: 'Lovelace', phoneCountry: 'US', phone: '' };
	assert.throws(
		() => validateProfile({ ...base, graduationSemester: 'spring', graduationYear: '' }),
		ProfileError
	);
	assert.throws(
		() => validateProfile({ ...base, graduationSemester: '', graduationYear: '2027' }),
		ProfileError
	);
	assert.throws(
		() => validateProfile({ ...base, graduationSemester: 'summer', graduationYear: '2027' }),
		ProfileError
	);
});

test('capitalizeName raises the start of each name without touching the rest', () => {
	assert.equal(capitalizeName('gabriel di lucca'), 'Gabriel Di Lucca');
	assert.equal(capitalizeName('minatel'), 'Minatel');
	assert.equal(capitalizeName('mary-jane'), 'Mary-Jane');
	assert.equal(capitalizeName("o'brien"), "O'Brien");
	assert.equal(capitalizeName('d’angelo'), 'D’Angelo');
	assert.equal(capitalizeName("sa'id"), "Sa'id");
	assert.equal(capitalizeName('álvaro'), 'Álvaro');
	assert.equal(capitalizeName('McDonald'), 'McDonald');
	assert.equal(capitalizeName('gabriel '), 'Gabriel ');
	assert.equal(capitalizeName('王 小明'), '王 小明');
	assert.equal(capitalizeName(''), '');
});
