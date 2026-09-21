# 🦑 squid

The new Purdue Hackers ID, an OICD provider that other apps can sign in.

## Setup

You need Deno, Docker, and Node 22 or `direnv allow` with Nix to host the project itself. After cloning:

```sh
cp .env.example .env
deno install
docker compose up -d
deno task db:push
deno task dev
```

## Usage

To create a client that uses ID as a way of logging in, first go to ID's dashboard and create an application. There, you will input your application's name, scopes and redirect url.

In turn, you will receive a client id to use it in whatever client you are using. Even if you are not using external dependencies, it is also fairly easy to setup. This is an example with BetterAuth in a Svelte website:

```ts
// auth.ts
import { betterAuth } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';

export const auth = betterAuth({
	database: /* yours */,
	plugins: [
		genericOAuth({
			config: [
				{
					providerId: 'purduehackers',
					clientId: 'my-app',
					discoveryUrl: 'https://id.purduehackers.com/api/auth/.well-known/openid-configuration',
					scopes: ['openid', 'profile', 'email'],
					pkce: true
				}
			]
		})
	]
});
```

```ts
// anywhere on the client
await authClient.signIn.social({ provider: 'purduehackers', callbackURL: '/' });
```

There's another example in `examples/demo-client` that doesn't rely on external dependencies, although it is significantly larger (200+ LOC) than this.
