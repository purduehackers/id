import { grantedRoles } from '$lib/roles';

type ClaimUser = Record<string, unknown>;
type ClaimInfo = { user: ClaimUser; scopes: string[] };

export function identityClaims({ user, scopes }: ClaimInfo) {
	return {
		...(scopes.includes('profile') && { preferred_username: user.username }),
		...(scopes.includes('roles') && { roles: grantedRoles(user.role as string) })
	};
}

export function accessTokenClaims({ user, scopes }: { user?: ClaimUser | null; scopes: string[] }) {
	return user && scopes.includes('roles') ? { roles: grantedRoles(user.role as string) } : {};
}

function splitName(name: string) {
	const parts = name.split(' ').filter(Boolean);
	return parts.length <= 1 ? {} : { given: parts.slice(0, -1).join(' '), family: parts.at(-1) };
}

function standardClaims(user: PreviewUser, scopes: string[]) {
	const { given, family } = splitName(user.name);
	return {
		...(scopes.includes('profile') && {
			name: user.name,
			picture: user.image ?? undefined,
			given_name: given,
			family_name: family
		}),
		...(scopes.includes('email') && {
			email: user.email,
			email_verified: user.emailVerified
		})
	};
}

type PreviewUser = ClaimUser & {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
};

const ID_TOKEN_LIFETIME = 36000;

export function previewTokens(
	user: PreviewUser,
	client: { clientId: string; enableEndSession: boolean },
	scopes: string[],
	issuer: string
) {
	if (!scopes.includes('openid')) return null;

	const iat = Math.floor(Date.now() / 1000);
	const custom = identityClaims({ user, scopes });
	const drop = (claims: Record<string, unknown>) =>
		Object.fromEntries(Object.entries(claims).filter(([, value]) => value !== undefined));

	return {
		idToken: drop({
			auth_time: '<when the user signed in>',
			acr: '0',
			...custom,
			at_hash: '<hash of the access token>',
			iss: issuer,
			sub: user.id,
			aud: client.clientId,
			nonce: '<the nonce your app sent, if any>',
			iat,
			exp: iat + ID_TOKEN_LIFETIME,
			sid: client.enableEndSession ? '<session id>' : undefined
		}),
		userinfo: drop({ sub: user.id, ...standardClaims(user, scopes), ...custom }),
		accessToken: drop(accessTokenClaims({ user, scopes }))
	};
}
