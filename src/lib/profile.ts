import {
	AsYouType,
	getCountryCallingCode,
	isSupportedCountry,
	parsePhoneNumberFromString,
	type CountryCode
} from 'libphonenumber-js';
import metadata from 'libphonenumber-js/min/metadata';

export class ProfileError extends Error {}

export const PART_NAME_MAX_LENGTH = 60;
export const GRADUATION_YEAR_MIN = 1950;
export const GRADUATION_YEAR_MAX = 2050;

// Constrained by Vercel Functions
export const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'US';

export function primaryPhoneCountry(callingCode: string): CountryCode | undefined {
	return metadata.country_calling_codes[callingCode]?.[0] as CountryCode | undefined;
}

export function formatNationalPhone(raw: string, country: string): string {
	const digits = raw.replace(/\D/g, '');
	if (!digits) return '';
	const region = isSupportedCountry(country) ? country : DEFAULT_PHONE_COUNTRY;
	const national = new AsYouType(region).input(digits);
	const formatted = /\D/.test(national) ? national : groupInternationally(digits, region);
	return formatted.replace(/\D+$/, '');
}

function groupInternationally(digits: string, country: CountryCode): string {
	const prefix = `+${getCountryCallingCode(country)} `;
	const grouped = new AsYouType().input(prefix + digits);
	if (!grouped.startsWith(prefix)) return digits;
	const rest = grouped.slice(prefix.length);
	return rest.replace(/\D/g, '') === digits ? rest : digits;
}

export function parsePhoneInput(
	raw: string,
	currentCountry: string
): { country: CountryCode; national: string } {
	const current = isSupportedCountry(currentCountry) ? currentCountry : DEFAULT_PHONE_COUNTRY;
	const trimmed = raw.trimStart();
	if (!trimmed.startsWith('+')) {
		return { country: current, national: formatNationalPhone(raw, current) };
	}

	const typed = new AsYouType();
	typed.input(trimmed);
	const callingCode = typed.getCallingCode();
	if (!callingCode) {
		return { country: current, national: `+${trimmed.slice(1).replace(/\D/g, '')}` };
	}

	const country =
		typed.getCountry() ??
		(getCountryCallingCode(current) === callingCode ? current : primaryPhoneCountry(callingCode)) ??
		current;
	return { country, national: formatNationalPhone(typed.getNationalNumber(), country) };
}

export function splitPhone(stored: string | null | undefined): {
	country: CountryCode;
	national: string;
} {
	if (!stored) return { country: DEFAULT_PHONE_COUNTRY, national: '' };
	return parsePhoneInput(stored, DEFAULT_PHONE_COUNTRY);
}

export function formatPhone(stored: string): string {
	return parsePhoneNumberFromString(stored)?.formatInternational() ?? stored;
}

export function validatePhone(raw: string, country: string): string | null {
	const phone = raw.trim();
	if (!phone) return null;
	if (!isSupportedCountry(country)) throw new ProfileError('Pick a valid country.');

	const parsed = parsePhoneNumberFromString(phone, country);
	if (!parsed?.isValid()) {
		throw new ProfileError('That does not look like a complete phone number.');
	}
	return parsed.number;
}

export function splitNameParts(name: string): { firstName: string; lastName: string } {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length <= 1) {
		return { firstName: parts[0] ?? '', lastName: '' };
	}
	return {
		firstName: parts.slice(0, -1).join(' '),
		lastName: parts.at(-1)!
	};
}

export function capitalizeName(name: string): string {
	return name
		.replace(/(^|[\s-])(\p{Ll})/gu, (_, before, letter) => before + letter.toUpperCase())
		.replace(
			/(^|[\s-])(\p{L}['’])(\p{Ll})/gu,
			(_, before, prefix, letter) => before + prefix + letter.toUpperCase()
		);
}

export function normalizeNamePart(part: string): string {
	return part.trim().replace(/\s+/g, ' ');
}

export type ProfileInput = {
	firstName: string;
	lastName: string;
	phoneCountry: string;
	phone: string;
	graduationYear: string;
};

export type ValidatedProfile = {
	name: string;
	givenName: string;
	familyName: string;
	phone: string | null;
	graduationYear: number | null;
};

export function validateGraduationYear(raw: string): number | null {
	const rawYear = raw.trim();
	if (!rawYear) return null;
	if (!/^\d{4}$/.test(rawYear)) {
		throw new ProfileError('Enter a four-digit graduation year.');
	}
	const year = Number(rawYear);
	if (year < GRADUATION_YEAR_MIN || year > GRADUATION_YEAR_MAX) {
		throw new ProfileError(
			`Enter a graduation year between ${GRADUATION_YEAR_MIN} and ${GRADUATION_YEAR_MAX}.`
		);
	}
	return year;
}

export function validateProfile(input: ProfileInput): ValidatedProfile {
	const givenName = normalizeNamePart(input.firstName);
	const familyName = normalizeNamePart(input.lastName);
	if (!givenName) throw new ProfileError('Tell us your first name.');
	if (!familyName) throw new ProfileError('Tell us your last name.');
	if (givenName.length > PART_NAME_MAX_LENGTH) {
		throw new ProfileError(`Keep your first name under ${PART_NAME_MAX_LENGTH} characters.`);
	}
	if (familyName.length > PART_NAME_MAX_LENGTH) {
		throw new ProfileError(`Keep your last name under ${PART_NAME_MAX_LENGTH} characters.`);
	}
	const name = `${givenName} ${familyName}`;

	const phone = validatePhone(input.phone, input.phoneCountry);

	const graduationYear = validateGraduationYear(input.graduationYear);

	return { name, givenName, familyName, phone, graduationYear };
}
