import { eq } from 'drizzle-orm';
import { db } from './db';
import { user } from './db/schema';
import { rolesOf } from '$lib/roles';
import { termYear } from '$lib/graduation';
import { censorIdCard, type IdCardData } from '$lib/id-card';

// Called only after the scan route resolves a valid, unexpired passport tap. A tap proves
// someone is holding the passport, not who they are, so only the signed-in owner gets the
// full card. The embedded card has no back, so its fields are never sent.
export async function idCardForScan(
	userId: string,
	passportId: number,
	viewerIsOwner: boolean
): Promise<IdCardData | null> {
	const [person] = await db
		.select({
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
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!person) return null;

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
