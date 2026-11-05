export const PROVIDERS = [
	{ id: 'discord', label: 'Discord' },
	{ id: 'github', label: 'GitHub' }
] as const;

export type Provider = (typeof PROVIDERS)[number]['id'];
