export class ProfileError extends Error {}

export const PART_NAME_MAX_LENGTH = 60;
export const GRADUATION_YEAR_MIN = 1950;
export const GRADUATION_YEAR_MAX = 2050;

export const COUNTRY_CODES = [
	{ code: '+1', label: '+1 (US/CA)', placeholder: '(765) 555-0123' },
	{ code: '+44', label: '+44 (UK)', placeholder: '7700 900077' },
	{ code: '+91', label: '+91 (IN)', placeholder: '98765 43210' },
	{ code: '+86', label: '+86 (CN)', placeholder: '138 0013 8000' },
	{ code: '+82', label: '+82 (KR)', placeholder: '10 1234 5678' },
	{ code: '+81', label: '+81 (JP)', placeholder: '90 1234 5678' },
	{ code: '+886', label: '+886 (TW)', placeholder: '912 345 678' },
	{ code: '+852', label: '+852 (HK)', placeholder: '5123 4567' },
	{ code: '+65', label: '+65 (SG)', placeholder: '8123 4567' },
	{ code: '+60', label: '+60 (MY)', placeholder: '12 345 6789' },
	{ code: '+62', label: '+62 (ID)', placeholder: '812 3456 7890' },
	{ code: '+63', label: '+63 (PH)', placeholder: '917 123 4567' },
	{ code: '+66', label: '+66 (TH)', placeholder: '81 234 5678' },
	{ code: '+84', label: '+84 (VN)', placeholder: '91 234 5678' },
	{ code: '+61', label: '+61 (AU)', placeholder: '412 345 678' },
	{ code: '+64', label: '+64 (NZ)', placeholder: '21 123 4567' },
	{ code: '+49', label: '+49 (DE)', placeholder: '151 23456789' },
	{ code: '+33', label: '+33 (FR)', placeholder: '6 12 34 56 78' },
	{ code: '+34', label: '+34 (ES)', placeholder: '612 345 678' },
	{ code: '+39', label: '+39 (IT)', placeholder: '312 345 6789' },
	{ code: '+31', label: '+31 (NL)', placeholder: '6 12345678' },
	{ code: '+41', label: '+41 (CH)', placeholder: '78 123 45 67' },
	{ code: '+46', label: '+46 (SE)', placeholder: '70 123 45 67' },
	{ code: '+47', label: '+47 (NO)', placeholder: '406 12 345' },
	{ code: '+45', label: '+45 (DK)', placeholder: '20 12 34 56' },
	{ code: '+358', label: '+358 (FI)', placeholder: '40 1234567' },
	{ code: '+48', label: '+48 (PL)', placeholder: '512 345 678' },
	{ code: '+353', label: '+353 (IE)', placeholder: '85 123 4567' },
	{ code: '+351', label: '+351 (PT)', placeholder: '912 345 678' },
	{ code: '+32', label: '+32 (BE)', placeholder: '470 12 34 56' },
	{ code: '+43', label: '+43 (AT)', placeholder: '664 123456' },
	{ code: '+420', label: '+420 (CZ)', placeholder: '601 123 456' },
	{ code: '+30', label: '+30 (GR)', placeholder: '691 234 5678' },
	{ code: '+90', label: '+90 (TR)', placeholder: '501 234 5678' },
	{ code: '+972', label: '+972 (IL)', placeholder: '50 123 4567' },
	{ code: '+971', label: '+971 (AE)', placeholder: '50 123 4567' },
	{ code: '+92', label: '+92 (PK)', placeholder: '300 1234567' },
	{ code: '+880', label: '+880 (BD)', placeholder: '1712 345678' },
	{ code: '+94', label: '+94 (LK)', placeholder: '71 234 5678' },
	{ code: '+977', label: '+977 (NP)', placeholder: '984 1234567' },
	{ code: '+52', label: '+52 (MX)', placeholder: '55 1234 5678' },
	{ code: '+55', label: '+55 (BR)', placeholder: '11 91234 5678' },
	{ code: '+54', label: '+54 (AR)', placeholder: '11 1234 5678' },
	{ code: '+56', label: '+56 (CL)', placeholder: '9 1234 5678' },
	{ code: '+57', label: '+57 (CO)', placeholder: '300 1234567' },
	{ code: '+51', label: '+51 (PE)', placeholder: '912 345 678' },
	{ code: '+20', label: '+20 (EG)', placeholder: '100 123 4567' },
	{ code: '+234', label: '+234 (NG)', placeholder: '802 123 4567' },
	{ code: '+254', label: '+254 (KE)', placeholder: '712 123456' },
	{ code: '+27', label: '+27 (ZA)', placeholder: '71 123 4567' }
] as const;

const CODES_BY_LENGTH = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

export function isCountryCode(code: string): boolean {
	return COUNTRY_CODES.some((c) => c.code === code);
}

export function formatNationalPhone(raw: string, countryCode: string): string {
	let digits = raw.replace(/\D/g, '');
	if (!digits) return '';

	if (countryCode === '+1') {
		if (digits.length === 11 && digits.startsWith('1')) {
			digits = digits.slice(1);
		}
		digits = digits.slice(0, 10);
		if (digits.length <= 3) return digits;
		if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
		return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
	}

	const maxNational = Math.max(15 - (countryCode.length - 1), 7);
	digits = digits.slice(0, maxNational);
	if (digits.length <= 3) return digits;
	if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
	if (digits.length <= 10) {
		return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
	}
	return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
}

export function parsePhoneInput(
	raw: string,
	currentCountryCode: string
): { countryCode: string; national: string } {
	const trimmed = raw.trimStart();
	if (trimmed.startsWith('+')) {
		const compact = '+' + trimmed.slice(1).replace(/\D/g, '');
		const matched = CODES_BY_LENGTH.find((c) => compact.startsWith(c.code));
		if (matched) {
			const rest = compact.slice(matched.code.length);
			return {
				countryCode: matched.code,
				national: formatNationalPhone(rest, matched.code)
			};
		}
	}
	const countryCode = isCountryCode(currentCountryCode) ? currentCountryCode : '+1';
	return {
		countryCode,
		national: formatNationalPhone(raw, countryCode)
	};
}

export function splitPhone(stored: string | null | undefined): {
	countryCode: string;
	national: string;
} {
	if (!stored) return { countryCode: '+1', national: '' };
	return parsePhoneInput(stored, '+1');
}

export function splitNameParts(user: {
	name: string;
	givenName?: string | null;
	familyName?: string | null;
}): { firstName: string; lastName: string } {
	if (user.givenName || user.familyName) {
		return {
			firstName: user.givenName ?? '',
			lastName: user.familyName ?? ''
		};
	}
	const parts = user.name.trim().split(/\s+/).filter(Boolean);
	if (parts.length <= 1) {
		return { firstName: parts[0] ?? '', lastName: '' };
	}
	return {
		firstName: parts.slice(0, -1).join(' '),
		lastName: parts.at(-1)!
	};
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

export function validateProfile(input: ProfileInput): ValidatedProfile {
	const givenName = input.firstName.trim().replace(/\s+/g, ' ');
	const familyName = input.lastName.trim().replace(/\s+/g, ' ');
	if (!givenName) throw new ProfileError('Tell us your first name.');
	if (!familyName) throw new ProfileError('Tell us your last name.');
	if (givenName.length > PART_NAME_MAX_LENGTH) {
		throw new ProfileError(`Keep your first name under ${PART_NAME_MAX_LENGTH} characters.`);
	}
	if (familyName.length > PART_NAME_MAX_LENGTH) {
		throw new ProfileError(`Keep your last name under ${PART_NAME_MAX_LENGTH} characters.`);
	}
	const name = `${givenName} ${familyName}`;

	const rawPhone = input.phone.trim();
	let phone: string | null = null;
	if (rawPhone) {
		const requestedCode = input.phoneCountry.trim() || '+1';
		if (!isCountryCode(requestedCode)) {
			throw new ProfileError('Pick a valid country code.');
		}
		const { countryCode, national } = parsePhoneInput(rawPhone, requestedCode);
		const nationalDigits = national.replace(/\D/g, '');
		const totalDigits = countryCode.slice(1).length + nationalDigits.length;
		if (
			(countryCode === '+1' && nationalDigits.length !== 10) ||
			nationalDigits.length < 6 ||
			totalDigits > 15
		) {
			throw new ProfileError('That does not look like a complete phone number.');
		}
		phone = `${countryCode} ${national}`;
	}

	const rawYear = input.graduationYear.trim();
	let graduationYear: number | null = null;
	if (rawYear) {
		if (!/^\d{4}$/.test(rawYear)) {
			throw new ProfileError('Enter a four-digit graduation year.');
		}
		const year = Number(rawYear);
		if (year < GRADUATION_YEAR_MIN || year > GRADUATION_YEAR_MAX) {
			throw new ProfileError(
				`Enter a graduation year between ${GRADUATION_YEAR_MIN} and ${GRADUATION_YEAR_MAX}.`
			);
		}
		graduationYear = year;
	}

	return { name, givenName, familyName, phone, graduationYear };
}
