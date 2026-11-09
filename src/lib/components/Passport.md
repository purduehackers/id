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
`coverTitle` and `coverCountry` customize the curved artwork labels. `class`
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
container, and uses instance-scoped SVG IDs. Its gold isometric mark, lettering,
and leather grain are vector/procedural artwork; no reference photograph is used.

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
- Foil face shading, navy leather, and curved lettering are confined to the cover
  artwork requested in the reference. They are not new application theme tokens
  or gradient UI controls. Header typography still uses `ph-headline`.
- Motion retains reduced-motion behavior. The explicitly requested arrival,
  opening, parallax, and shadow timing remain synchronized.
