export class ProfileError extends Error {}

export const NAME_MAX_LENGTH = 100;
export const PHONE_MAX_LENGTH = 32;
const PHONE_CHARS = /^[+\d()\-\s.]+$/;
export const GRADUATION_YEAR_MIN = 1950;
export const GRADUATION_YEAR_MAX = 2050;

export type ProfileInput = {
	name: string;
	phone: string;
	graduationYear: string;
};

export type ValidatedProfile = {
	name: string;
	phone: string | null;
	graduationYear: number | null;
};

export function validateProfile(input: ProfileInput): ValidatedProfile {
	const name = input.name.trim();
	if (!name) throw new ProfileError('Tell us your name.');
	if (name.length > NAME_MAX_LENGTH) {
		throw new ProfileError(`Keep your name under ${NAME_MAX_LENGTH} characters.`);
	}

	const rawPhone = input.phone.trim();
	let phone: string | null = null;
	if (rawPhone) {
		const digits = rawPhone.replace(/\D/g, '');
		if (
			rawPhone.length > PHONE_MAX_LENGTH ||
			!PHONE_CHARS.test(rawPhone) ||
			digits.length < 7 ||
			digits.length > 15
		) {
			throw new ProfileError('That does not look like a phone number.');
		}
		phone = rawPhone;
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

	return { name, phone, graduationYear };
}
