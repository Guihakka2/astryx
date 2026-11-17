---
'@astryxdesign/cli': patch
---

[fix] A palette config made with a newer Astryx CLI, whose recipe this CLI does not know yet, is refused with the recipe it uses, the recipes this CLI knows, and the command that updates the CLI, by `astryx theme palette generate` and by the theme editor. The refusal keeps its error code.

@josephfarina
