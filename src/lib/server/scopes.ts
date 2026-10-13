export type Scope =
	| 'openid'
	| 'profile'
	| 'email'
	| 'offline_access'
	| 'roles'
	| 'user:read'
	| 'user'
	| DirectoryScope;

export type DirectoryScope = 'directory:roles' | 'directory:discord';
export const DIRECTORY_SCOPES: DirectoryScope[] = ['directory:roles', 'directory:discord'];
export const DIRECTORY_RESOURCE = 'https://id.purduehackers.com/api/directory';

export const MEMBER_CLIENT_SCOPES: Scope[] = [
	'openid',
	'profile',
	'email',
	'offline_access',
	'roles',
	'user:read',
	'user'
];

export const SCOPES: Scope[] = [...MEMBER_CLIENT_SCOPES, ...DIRECTORY_SCOPES];

export const SCOPE_DESCRIPTIONS: Record<string, string> = {
	openid: 'Confirm who you are',
	profile: 'See your name, username and avatar',
	email: 'See your email address',
	offline_access: 'Stay signed in when you are away',
	roles: 'See your roles at Purdue Hackers, like organizer',
	'user:read': 'Read your user data',
	user: 'Change your user data',
	'directory:roles': "See every member's username, name, roles and public information",
	'directory:discord': "See every member's linked Discord account"
};

export function isDirectoryScope(scope: string): scope is DirectoryScope {
	return (DIRECTORY_SCOPES as string[]).includes(scope);
}
