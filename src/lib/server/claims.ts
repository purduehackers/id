import { grantedRoles } from '$lib/roles';
import { pictureFor } from '$lib/server/avatar';

type ClaimUser = Record<string, unknown>;
type ClaimInfo = { user: ClaimUser; scopes: string[] };

export function identityClaims({ user, scopes }: ClaimInfo) {
	return {
		...(scopes.includes('profile') && {
			preferred_username: user.username,
			...(user.givenName ? { given_name: user.givenName } : {}),
			...(user.familyName ? { family_name: user.familyName } : {}),
			...(user.graduationYear ? { graduation_year: user.graduationYear } : {})
		}),
		...(scopes.includes('phone') && user.phone ? { phone_number: user.phone } : {}),
		...(scopes.includes('roles') && { roles: grantedRoles(user.role as string) })
	};
}

/** Adds `picture`. Use for UserInfo only, not for the ID token. */
export function userInfoClaims(info: ClaimInfo) {
	const { user, scopes } = info;
	return {
		...identityClaims(info),
		...(scopes.includes('profile') &&
			typeof user.id === 'string' && {
				picture: pictureFor({ id: user.id, image: user.image as string | null })
			})
	};
}

export function accessTokenClaims({ user, scopes }: { user?: ClaimUser | null; scopes: string[] }) {
	return user && scopes.includes('roles') ? { roles: grantedRoles(user.role as string) } : {};
}

function standardClaims(user: PreviewUser, scopes: string[]) {
	return {
		...(scopes.includes('profile') && {
			name: user.name,
			picture: pictureFor(user),
			given_name: user.givenName || undefined,
			family_name: user.familyName || undefined
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
	givenName?: string | null;
	familyName?: string | null;
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
