---
'@astryxdesign/cli': patch
---

[fix] `astryx doctor` now warns when the app's default theme is drawn for only one mode and nothing paints the page. Without `AppShell`, a body background of the page color, or a fixed mode on the root `Theme` (`mode={themeModes[defaultThemeSlug]}`, or a literal `light` or `dark`), the theme's text sits on the browser's own page color in the other OS mode. The fix says to wrap the page in `AppShell`, or else to add `body { background: var(--color-background-body) }` to global CSS.

@josephfarina
