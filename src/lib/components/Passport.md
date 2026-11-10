# Passport

Reusable Svelte 5 passport presentation with a shared account `IdCard`, a top-hinged
cover, a projected header, and synchronized paper/shadow motion.

```svelte
<script lang="ts">
	import Passport from '$lib/components/Passport.svelte';
	import type { IdCardData } from '$lib/id-card';
	let { profile }: { profile: IdCardData } = $props();
</script>

<section class="pt-16">
	<Passport passportId={9907} {profile} headerStripHeight={64} animate />
</section>
```

`passportId` is required. `profile` supplies exactly the same fields as the account
card. Without it, the component renders an unclaimed passport using optional
`name` and `username` props. `animate` defaults to false; `onstart` and `onfinish` are optional.

`class` customizes the outer wrapper.

Reserve space above the component for the visible cover strip. `headerStripHeight`
overrides that space in pixels; otherwise the component inherits AuthShell's
`--cover-strip-height` (56px on phones, 64px on desktop). The component's width is
capped at 440px and its ID page retains the credit-card ratio.

The card has no flip control or back face in embedded passport mode. A `profile`
with `censored` set shows redaction bars for anything that is not public; `censorIdCard` builds it on the server so the real values never reach the
page. The normal account card retains its existing interaction. Animation respects reduced motion and waits for
the primary fonts declared by the existing theme; font URLs are unchanged.

`PassportCover.svelte` is independently reusable, fills its
container, and masks its foil with `static/passport-seal.svg`: the exact supplied
Figma paths and outlined lettering, with only the solid black background removed
so the reflection stays inside the gold. No reference photograph is used.
The complete seal is rotated 90° clockwise. The gold reflection samples the actual eased cover pose during opening and the
normalized slide-in translation, using the same foil material for logo and lettering.
There are no timers, pointer/touch controls, or device orientation listeners.
