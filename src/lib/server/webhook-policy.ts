export const WEBHOOK_EVENTS = {
	'user.roles.changed': { description: "A user's roles changed.", needs: ['roles'] },
	'user.banned': { description: 'A user was banned.', needs: [] },
	'user.unbanned': { description: 'A user was unbanned.', needs: [] },
	'user.updated': {
		description: 'A user was updated. Carries their current profile, email or phone number.',
		needs: ['profile', 'email', 'phone']
	},
	'user.github.linked': { description: 'A user connected a GitHub account.', needs: ['github'] },
	'user.github.unlinked': {
		description: 'A user disconnected a GitHub account.',
		needs: ['github']
	},
	'user.discord.linked': { description: 'A user connected a Discord account.', needs: ['discord'] },
	'user.discord.unlinked': {
		description: 'A user disconnected their Discord account.',
		needs: ['discord']
	}
} as const satisfies Record<string, { description: string; needs: readonly string[] }>;
export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

const DIRECTORY_EXPANDS: Record<string, string[]> = {
	'directory:roles': ['roles', 'profile'],
	'directory:contact': ['email', 'phone'],
	'directory:discord': ['discord'],
	'directory:github': ['github']
};

export function expandScopes(scopes: string[]): Set<string> {
	return new Set(scopes.flatMap((scope) => DIRECTORY_EXPANDS[scope] ?? [scope]));
}

export function availableEvents(scopes: string[]): WebhookEvent[] {
	const visible = expandScopes(scopes);
	return (Object.keys(WEBHOOK_EVENTS) as WebhookEvent[]).filter((type) => {
		const needs: readonly string[] = WEBHOOK_EVENTS[type].needs;
		return needs.length === 0 || needs.some((scope) => visible.has(scope));
	});
}

const USER_FIELD_SCOPES: Record<string, string | null> = {
	sub: null,
	preferred_username: 'profile',
	name: 'profile',
	given_name: 'profile',
	family_name: 'profile',
	picture: 'profile',
	graduation_year: 'profile',
	email: 'email',
	email_verified: 'email',
	phone_number: 'phone',
	discord_id: 'discord'
};

const DATA_FIELD_SCOPES: Record<string, string | null> = {
	user: null,
	roles: 'roles',
	previous_roles: 'roles',
	github_account: 'github'
};

export function payloadScopes(data: unknown): Set<string> | null {
	if (typeof data !== 'object' || data === null) return null;
	const needed = new Set<string>();
	const add = (fields: object, scopes: Record<string, string | null>) => {
		for (const field of Object.keys(fields)) {
			if (!Object.hasOwn(scopes, field)) return false;
			const scope = scopes[field];
			if (scope) needed.add(scope);
		}
		return true;
	};
	const { user } = data as { user?: unknown };
	if (user !== undefined && (typeof user !== 'object' || user === null)) return null;
	if (!add(data, DATA_FIELD_SCOPES) || (user && !add(user, USER_FIELD_SCOPES))) return null;
	return needed;
}

export function deliveryAllowed(type: string, data: unknown, events: string[], granted: string[]) {
	if (type === 'webhook.test') return true;
	if (!events.includes(type) || granted.length === 0) return false;
	const needed = payloadScopes(data);
	if (!needed) return false;
	const visible = expandScopes(granted);
	return [...needed].every((scope) => visible.has(scope));
}
