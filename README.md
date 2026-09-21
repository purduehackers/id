# 🦑 squid

The new Purdue Hackers ID, an OICD provider that other apps can sign in.

## Setup

You need Deno, Docker, and Node 22 or `direnv allow` with Nix. To run the project:

```sh
cp .env.example .env
deno install
docker compose up -d
deno task db:push
deno task dev
```

## Usage

Example with [Arctic](https://arcticjs.dev) in a Svelte website:

```ts
import { CodeChallengeMethod, OAuth2Client, generateCodeVerifier, generateState } from 'arctic';

const issuer = 'http://localhost:5173/api/auth';

export const id = new OAuth2Client('my-app', null, 'http://localhost:3000/callback');

export const authorize = issuer + '/oauth2/authorize';
export const token = issuer + '/oauth2/token';
export const userinfo = issuer + '/oauth2/userinfo';
export { CodeChallengeMethod, generateCodeVerifier, generateState };
```

```ts
// routes/login/+server.ts
import {
	id,
	authorize,
	CodeChallengeMethod,
	generateCodeVerifier,
	generateState
} from '$lib/server/id';

export function GET({ cookies }) {
	const state = generateState();
	const verifier = generateCodeVerifier();
	cookies.set('state', state, { path: '/', httpOnly: true, maxAge: 300 });
	cookies.set('verifier', verifier, { path: '/', httpOnly: true, maxAge: 300 });

	const url = id.createAuthorizationURLWithPKCE(
		authorize,
		state,
		CodeChallengeMethod.S256,
		verifier,
		['openid', 'profile', 'email']
	);
	return new Response(null, { status: 302, headers: { location: url.toString() } });
}
```

```ts
// routes/callback/+server.ts
import { id, token, userinfo } from '$lib/server/id';

export async function GET({ url, cookies }) {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || state !== cookies.get('state')) return new Response('bad state', { status: 400 });

	const tokens = await id.validateAuthorizationCode(token, code, cookies.get('verifier')!);
	const user = await fetch(userinfo, {
		headers: { authorization: `Bearer ${tokens.accessToken()}` }
	}).then((r) => r.json());

	// user.sub, user.name, user.email
	return new Response(JSON.stringify(user));
}
```

Register the client first from the dashboard.


## Scopes

| Scope                                      | Grants                               |
| ------------------------------------------ | ------------------------------------ |
| `openid`                                   | An `id_token` and access to userinfo |
| `profile`                                  | `name`                               |
| `email`                                    | `email`, `email_verified`            |
| `offline_access`                           | A refresh token                      |
| `user:read`, `user`, `admin:read`, `admin` | Reserved, nothing yet                |