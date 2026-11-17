---
'@astryxdesign/core': patch
---

[feat] Themes can draw Pagination's controls as one joined strip. The control row carries `pagination-list`, each of its Button controls carries `pagination-item` (the current page's reflects `data-selected`), and the ellipsis carries `pagination-ellipsis`. A theme's `button` entries keyed on variant, size or elevation still outrank `pagination-item` on the cells, so a cell entry takes effect where those leave the property unset. The default look does not change.

@josephfarina
