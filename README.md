# 🦑 squid

The new Purdue Hackers ID, an OIDC provider that other apps can sign in.

## Setup

You can run and build with **Deno**:

```sh
cp .env.example .env

deno install
deno task db:push
deno task dev
```

### Profile pictures

Profile pictures are in a public Vercel Blob store. To upload pictures, do these steps:

1. Create a public Blob store and connect it to the Vercel project.
2. For local development, set `BLOB_READ_WRITE_TOKEN` to the read-write token of the store.

If there are no credentials, the upload shows an error. All other functions continue to operate.

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

### Member Directory & Profiles

- **Profile Scopes**:
  - `profile`: returns `name`, `given_name`, `family_name`, `picture`, and `graduation_year`.
  - `picture` is the URL of the picture that the user uploaded, or of a generated pixel avatar. When the user changes or removes the picture, the old URL stops working in one day or less. Do not keep this URL for a long time.
  - `phone`: returns `phone_number` in E.164 format, like `+17655550123`.
- **Directory API**:
  - Query team members via `GET /api/directory/users?role=organizer,alumni`.
  - Requires OAuth 2.0 `client_credentials` with scopes `directory:roles` and optionally `directory:contact` (for email and phone number).
  - See [`examples/demo-client/directory.ts`](./examples/demo-client/directory.ts) for a full runnable example.
