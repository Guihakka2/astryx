---
'@astryxdesign/cli': patch
---

[fix] `astryx search` finds the guides for sharing a page as one HTML file. A search for words like "share", "single file", "static html", "snapshot" or "artifact" now returns the experimental shareable-page guides, which say they are experimental; every other experimental doc still stays out of search.
