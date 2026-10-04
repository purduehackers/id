export type Scope =
	'openid' | 'profile' | 'email' | 'offline_access' | 'roles' | 'user:read' | 'user';

export const SCOPES: Scope[] = [
	'openid',
	'profile',
	'email',
	'offline_access',
	'roles',
	'user:read',
	'user'
];

export const SCOPE_DESCRIPTIONS: Record<string, string> = {
	openid: 'Confirm who you are',
	profile: 'See your name, username and avatar',
	email: 'See your email address',
	offline_access: 'Stay signed in when you are away',
	roles: 'See your roles at Purdue Hackers, like organizer',
	'user:read': 'Read your user data',
	user: 'Change your user data'
};

export const MEMBER_CLIENT_SCOPES: Scope[] = SCOPES;
