# 🦑 squid

The new Purdue Hackers ID, an OICD provider that other apps can sign in.

## Setup

You can run and build with **Deno** (default) or **Bun**:

```sh
cp .env.example .env

# Using Deno
deno install
deno task db:push
deno task dev

# Using Bun
bun install
bun run db:push
bun run dev
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

### Member Directory & Profiles

- **Profile Scopes**:
  - `profile`: returns `name`, `given_name`, `family_name`, `picture`, `github`, and `graduation_year`.
  - `phone`: returns `phone_number` in E.164 format, like `+17655550123`.
- **Directory API**:
  - Query team members via `GET /api/directory/users?role=organizer,alumni`.
  - Requires OAuth 2.0 `client_credentials` with scopes `directory:roles` and optionally `directory:contact` (for email and phone number) or `directory:discord` (for `discord_id` and `discord_username`).
  - See [`examples/demo-client/directory.ts`](./examples/demo-client/directory.ts) for a full runnable example.
- **Roster Import**:
  - Backfill existing Notion rosters using `deno run -A scripts/import-roster.ts roster.csv` (or `bun run scripts/import-roster.ts roster.csv`).
