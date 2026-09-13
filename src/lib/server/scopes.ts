export type Scope =
	'openid' | 'profile' | 'email' | 'offline_access' | 'user:read' | 'user' | 'admin:read' | 'admin';

export const SCOPES: Scope[] = [
	'openid',
	'profile',
	'email',
	'offline_access',
	'user:read',
	'user',
	'admin:read',
	'admin'
];

export const SCOPE_DESCRIPTIONS: Record<string, string> = {
	openid: 'Confirm who you are',
	profile: 'See your name and avatar',
	email: 'See your email address',
	offline_access: 'Stay signed in when you are away',
	'user:read': 'Read your user data',
	user: 'Change your user data',
	'admin:read': "Read everyone's data",
	admin: "Change everyone's data"
};

export const ADMIN_SCOPES = new Set<string>(['admin:read', 'admin']);
