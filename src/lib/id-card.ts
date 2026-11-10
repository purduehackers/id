import type { Role } from './roles';

export type IdCardData = {
	id: string;
	name: string;
	givenName?: string | null;
	familyName?: string | null;
	username: string | null;
	image?: string | null;
	email: string | null;
	phone?: string | null;
	roles: Role[];
	graduationYear?: number | null;
	since: Date | string | null;
	passports: number[];
	linked: string[];
	censored?: boolean;
};

/** Keeps only public fields: photo, name, @username, role, passport number and issue date. */
export function censorIdCard(card: IdCardData, passportId: number): IdCardData {
	return {
		id: `passport-${passportId}`,
		name: card.name,
		givenName: card.givenName,
		familyName: card.familyName,
		image: card.image,
		username: card.username,
		email: null,
		phone: null,
		roles: card.roles,
		graduationYear: null,
		since: card.since,
		passports: [passportId],
		linked: [],
		censored: true
	};
}
