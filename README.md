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

## Passport UI

The scan page uses the reusable `Passport` component with the same `IdCard` as the
account page:

```svelte
<script lang="ts">
	import Passport from '$lib/components/Passport.svelte';
</script>

<Passport {passportId} {profile} animate />
```

`passportId` is required; `profile` is the shared `IdCardData`. Unclaimed passports
can use `name` and `username` instead. `animate` defaults to false; `onstart`,
`onfinish`, and the outer `class` are optional. Reserve space above the component
for the open cover: AuthShell supplies `--cover-strip-height` (56px on phones,
64px on desktop), or pass `headerStripHeight` in pixels. Passport width is capped
at 440px and the card retains its credit-card ratio.

Both card views share proportional `cqw` sizing and Tailwind layout utilities.
Embedded mode disables tilt/flipping and omits the flip icon and back face.
Scoped CSS handles artwork, 3D projection, shadows, and keyframes; motion respects
reduced-motion preferences. `PassportCover` is independently reusable and uses
`static/passport-seal.svg` for the gold mask. Reflections follow the cover pose
and slide-in translation rather than a separate animation.

For scan data, use `idCardFromOwner` when the owner is already loaded;
`idCardForScan` fetches by user ID otherwise. Both share one mapping and selected
field set. Non-owner views pass through `censorIdCard` on the server so private
contact details and graduation year never reach the browser. The user ID remains
available to keep the identicon consistent.
