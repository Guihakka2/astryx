---
'@astryxdesign/core': patch
---

[fix] Default buttons now visibly change on hover and on press. The primary, secondary and destructive Button paint hover and press as a tint of their own label colour over the fill, so the change shows on any fill: a dark fill lightens and a light fill darkens. Before, the page's one-way overlay vanished on near-black, pale or saturated fills. A theme's own button rule for `--color-overlay-hover` or `--color-overlay-pressed` still wins; ghost buttons keep the page overlay.

@josephfarina
