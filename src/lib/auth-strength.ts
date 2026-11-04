const TIERS = ['Wet paper', 'Screen door', 'Bike lock', 'Deadbolt', 'Bank vault', "Dragon's hoard"];

export const STRENGTH_MAX = TIERS.length - 1;

/** A playful summary of how someone can sign in, not a security audit. */
export function authStrength(person: {
	emailVerified: boolean;
	hasPassword: boolean;
	connections: string[];
	passkeys: number;
	activatedPassports: number;
}) {
	const checks = [
		{ label: 'Verified email', points: 1, earned: person.emailVerified },
		{
			label: 'Password or linked account',
			points: 1,
			earned: person.hasPassword || person.connections.length > 0
		},
		{ label: 'Passkey', points: 2, earned: person.passkeys > 0 },
		{ label: 'Activated passport', points: 1, earned: person.activatedPassports > 0 }
	];
	const score = checks.reduce((total, check) => total + (check.earned ? check.points : 0), 0);
	return { score, tier: TIERS[score], checks };
}

export type AuthStrength = ReturnType<typeof authStrength>;
