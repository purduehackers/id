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
`name` and `username` props. `animate` defaults to false; `onfinish` is optional.
`inspectOnSpace` defaults to true. Hold Space while loading/reloading to latch
the cover closed for inspection; releasing Space does not start the animation.
Reload without Space to return to the normal opening. The small
`/passport-inspection.js` head script captures held-key state before hydration
and carries it across a reload. Consumers can set `inspectOnSpace={false}`.

`coverTitle` and `coverCountry` supply accessible artwork labels; the exact Figma
lettering is outlined in the SVG asset. `class`
customizes the outer wrapper.

Reserve space above the component for the visible cover strip. `headerStripHeight`
overrides that space in pixels; otherwise the component inherits AuthShell's
`--cover-strip-height` (56px on phones, 64px on desktop). The component's width is
capped at 440px and its ID page retains the credit-card ratio.

The card has no flip control in embedded passport mode. The normal account card
retains its existing interaction. Animation respects reduced motion and waits for
the primary fonts declared by the existing theme; font URLs are unchanged.

`PassportEntrance.svelte` is a compatibility alias. New consumers should import
`Passport.svelte`. `PassportCover.svelte` is independently reusable, fills its
container, and masks its foil with `static/passport-seal.svg`: the exact supplied
Figma paths and outlined lettering, with only the solid black background removed
so the reflection stays inside the gold. No reference photograph is used.
The complete seal is rotated 90° clockwise. The gold reflection samples the actual eased cover pose during opening and the
normalized slide-in translation, using the same foil material for logo and lettering.
There are no timers, pointer/touch controls, or device orientation listeners.
Freezing the cover for debugging also freezes its reflection.

## Purdue Hackers UI skill check

Reviewed against the supplied `purdue-hackers-ui` skill and the official registry
at <https://components.purduehackers.com/r/index.json>.

- Official palette/font-family values were compared with the current registry
  theme; they match (font quote formatting differs only). Existing official theme
  tokens and hosted fonts remain the source of UI colors
  and typography. No replacement fonts or tokens are added.
- Standard UI still uses the existing Svelte adapters (`Glider`, `Button`,
  `DitherButton`, `Field`, `Input`, `Notice`, and HackerNoon pixel icons). The
  registry currently provides Astro/React, not a Svelte installation target.
- The reusable `Passport` owns behavior; `PassportCover` owns illustration;
  `IdCard` remains shared with the logged-in dashboard. Routes provide data.
- The modified UI has square corners, no pill or glass treatments, and no gray
  secondary text on cream. The preview status message now uses `Notice`.
- Foil face shading, black leather, and curved lettering are confined to the cover
  artwork requested in the reference. They are not new application theme tokens
  or gradient UI controls. Header typography still uses `ph-headline`.
- Motion retains reduced-motion behavior. The explicitly requested arrival,
  opening, parallax, and shadow timing remain synchronized.
