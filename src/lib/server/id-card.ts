import { eq } from 'drizzle-orm';
import { db } from './db';
import { user } from './db/schema';
import { rolesOf } from '$lib/roles';
import { termYear } from '$lib/graduation';
import { censorIdCard, type IdCardData } from '$lib/id-card';

/** Fields needed to build the scan card; also selected when resolving its owner. */
export const idCardOwnerFields = {
	id: user.id,
	name: user.name,
	givenName: user.givenName,
	familyName: user.familyName,
	username: user.username,
	image: user.image,
	email: user.email,
	role: user.role,
	graduationTerm: user.graduationTerm,
	createdAt: user.createdAt
};
type IdCardOwner = Pick<typeof user.$inferSelect, keyof typeof idCardOwnerFields>;

/** Fetch only when the caller does not already have the owner. */
export async function idCardForScan(
	userId: string,
	passportId: number,
	viewerIsOwner: boolean
): Promise<IdCardData | null> {
	const [person] = await db
		.select(idCardOwnerFields)
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	return person ? idCardFromOwner(person, passportId, viewerIsOwner) : null;
}

/** Build a scan card without another query. Redact before returning data to the browser. */
export function idCardFromOwner(
	person: IdCardOwner,
	passportId: number,
	viewerIsOwner: boolean
): IdCardData {
	const card: IdCardData = {
		id: person.id,
		name: person.name,
		givenName: person.givenName,
		familyName: person.familyName,
		username: person.username,
		image: person.image,
		email: person.email,
		phone: null,
		roles: rolesOf(person),
		graduationYear: person.graduationTerm === null ? null : termYear(person.graduationTerm),
		since: person.createdAt,
		passports: [passportId],
		linked: []
	};
	return viewerIsOwner ? card : censorIdCard(card, passportId);
}
