# Standalone NFC preview

Run `npm run preview:dev` or `npm run preview:build` from the repository root.
The static build is emitted to `dist/`. It renders the actual scan page and
PassportEntrance and shared IdCard components with a complete fictional holder, without a database, OAuth,
or real passport credentials.

Write the hosted origin followed by `/?secret=passport-flip-9907-a6e81d3b` as a
URL record on an NFC tag. Each page load replays the entrance. Form submissions
are intercepted: this demo cannot sign anyone in or approve another device.

The preview key is a demo selector, not an authentication credential; the sample
identity and key are in this public repository. Real scans continue to validate
passport secrets on the server before showing holder information.

The square cover hinges upward and rests 40 degrees above fully open. The ID
page uses the same component and fields as the account dashboard. On iOS, use
Add to Home Screen for a standalone view; Safari itself clips off-viewport
content. Safe-area padding and a black toolbar theme soften that boundary.

For a stationary cover review, append `&view=cover` to the same preview URL.
This uses `PassportCover.svelte` independently of the animation. The animated scan
page uses the reusable `Passport.svelte`; its props and Purdue Hackers UI audit
are documented in `src/lib/components/Passport.md`.

Hold Space while reloading to keep the cover closed for inspection. Release
Space after loading; the cover stays closed until the next normal reload.
The `&view=cover` URL also provides a stationary cover view, including on phones.
