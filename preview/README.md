# Standalone NFC preview

Run `npm run preview:dev` or `npm run preview:build` from the repository root.
The static build is emitted to `dist/`. It renders the actual scan page and
PassportEntrance component with a fictional holder, without a database, OAuth,
or real passport credentials.

Write the hosted origin followed by `/?secret=passport-flip-9907-a6e81d3b` as a
URL record on an NFC tag. Each page load replays the entrance. Form submissions
are intercepted: this demo cannot sign anyone in or approve another device.

The preview key is a demo selector, not an authentication credential; the sample
identity and key are in this public repository. Real scans continue to validate
passport secrets on the server before showing holder information.
