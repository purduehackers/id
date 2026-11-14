import { verifyJwsAccessToken } from 'better-auth/oauth2';
import { auth } from '$lib/server/auth';
import { issuerFor } from '$lib/server/origin';

const jwksCacheKey = {};

export type AccessToken = {
	subject: string | undefined;
	clientId: string;
	scopes: Set<string>;
	issuedAt: number;
};

export function bearerToken(request: Request) {
	return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export async function verifyAccessToken(
	token: string,
	url: URL,
	audience: string
): Promise<AccessToken | null> {
	let payload;
	try {
		payload = await verifyJwsAccessToken(token, {
			jwksFetch: () => auth.api.getJwks(),
			jwksCacheKey,
			verifyOptions: {
				audience,
				issuer: [...new Set([issuerFor(url), `${url.origin}/api/auth`])]
			}
		});
	} catch {
		return null;
	}

	const clientId = payload.azp ?? payload.client_id;
	if (typeof clientId !== 'string' || !clientId) return null;

	return {
		subject: payload.sub,
		clientId,
		scopes: new Set(
			String(payload.scope ?? '')
				.split(' ')
				.filter(Boolean)
		),
		issuedAt: payload.iat ?? 0
	};
}
