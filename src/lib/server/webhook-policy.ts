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

/** Queued/retried link events must honor revocation at delivery time too. */
export function githubDeliveryAllowed(type: string, events: string[], directoryScopes: string[]) {
	return (
		!type.startsWith('user.github.') ||
		(events.includes(type) && directoryScopes.includes('directory:github'))
	);
}
