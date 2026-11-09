import { eq } from 'drizzle-orm';
import { db } from './db';
import { user, account } from './db/schema';
import { passportsOf } from './passport';
import { rolesOf } from '$lib/roles';
import { termYear } from '$lib/graduation';
import { PROVIDERS } from '$lib/providers';
import type { IdCardData } from '$lib/id-card';

// Called only after the scan route resolves a valid, unexpired passport tap.
export async function idCardForUser(userId: string): Promise<IdCardData | null> {
	const [person] = await db
		.select({
			id: user.id,
			name: user.name,
			givenName: user.givenName,
			familyName: user.familyName,
			username: user.username,
			image: user.image,
			email: user.email,
			phone: user.phone,
			role: user.role,
			graduationTerm: user.graduationTerm,
			createdAt: user.createdAt
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!person) return null;
	const [passports, accounts] = await Promise.all([
		passportsOf(userId),
		db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, userId))
	]);
	return {
		id: person.id,
		name: person.name,
		givenName: person.givenName,
		familyName: person.familyName,
		username: person.username,
		image: person.image,
		email: person.email,
		phone: person.phone,
		roles: rolesOf(person),
		graduationYear: person.graduationTerm === null ? null : termYear(person.graduationTerm),
		since: person.createdAt,
		passports: passports.filter((p) => p.activated).map((p) => p.id),
		linked: PROVIDERS.filter((p) => accounts.some((a) => a.providerId === p.id)).map((p) => p.label)
	};
}
