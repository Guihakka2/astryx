---
'@astryxdesign/core': patch
---

[docs] The README's "Building with an AI agent?" box now installs the CLI at the version of `@astryxdesign/core` you have. It saves it exactly when `package.json` pins Core exactly, and its link to the Astryx CLI section works again. Before, it installed the newest CLI with a `^` range, so the CLI's first command asked for a second install to match Core.

@josephfarina
