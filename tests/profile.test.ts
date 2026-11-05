import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	DISCORD_SYNC_INTERVAL_MS,
	ProfileError,
	capitalizeName,
	discordHandle,
	isDiscordSyncDue,
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
			phoneCountry: 'US',
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
			phoneCountry: 'US',
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
			phoneCountry: 'GB',
			phone: '7400123456',
			graduationYear: '2027'
		}),
		{
			name: 'Alan Turing',
			givenName: 'Alan',
			familyName: 'Turing',
			phone: '+447400123456',
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
				phoneCountry: 'US',
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
				phoneCountry: 'US',
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
				phoneCountry: 'US',
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
				phoneCountry: 'ZZ',
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
				phoneCountry: 'US',
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
				phoneCountry: 'US',
				phone: '',
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

test('rolesGranting expands roles for directory filtering', () => {
	assert.deepEqual(rolesGranting(['organizer']), ['organizer', 'admin']);
	assert.deepEqual(rolesGranting(['alumni']), ['alumni']);
	assert.deepEqual(rolesGranting(['organizer', 'alumni']), ['alumni', 'organizer', 'admin']);
	assert.deepEqual(rolesGranting(['admin']), ['admin']);
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

test('discordHandle reads pomelo and legacy usernames', () => {
	assert.equal(discordHandle({ username: 'purduepete', discriminator: '0' }), 'purduepete');
	assert.equal(discordHandle({ username: 'purduepete' }), 'purduepete');
	assert.equal(discordHandle({ username: 'Pete', discriminator: '1869' }), 'Pete#1869');
	assert.equal(discordHandle({ username: '' }), null);
	assert.equal(discordHandle({}), null);
});

test('isDiscordSyncDue checks at most once per interval', () => {
	const now = 1_800_000_000_000;
	assert.equal(isDiscordSyncDue(null, now), true);
	assert.equal(isDiscordSyncDue(undefined, now), true);
	assert.equal(isDiscordSyncDue(new Date(now - 1000), now), false);
	assert.equal(isDiscordSyncDue(now - DISCORD_SYNC_INTERVAL_MS + 1, now), false);
	assert.equal(isDiscordSyncDue(now - DISCORD_SYNC_INTERVAL_MS, now), true);
	assert.equal(isDiscordSyncDue(new Date(now - DISCORD_SYNC_INTERVAL_MS).toISOString(), now), true);
});
