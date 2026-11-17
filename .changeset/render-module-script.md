---
'@astryxdesign/cli': patch
---

[experimental] A rendered page's script is a module script, so it runs once the file is parsed: a browser paints the page before the script draws it, and a small page shows its first paint about 200 ms sooner on a slow phone. The page is ready as soon as before.

@josephfarina
