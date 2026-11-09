import type { Role } from './roles';

export type IdCardData = {
	id: string;
	name: string;
	givenName?: string | null;
	familyName?: string | null;
	username: string;
	image?: string | null;
	email: string;
	phone?: string | null;
	roles: Role[];
	graduationYear?: number | null;
	since: Date | string;
	passports: number[];
	linked: string[];
};
