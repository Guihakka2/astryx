---
name: astryx
description: "Astryx, a design system and UI library, is available on this computer through the astryx command; use it when building or changing UI, choosing components, layout, styling or theming, working with a design system, or in any project that depends on @astryxdesign packages or mentions Astryx."
---

<!-- ASTRYX:START -->
<!-- astryx-managed sha256:760a5d70cd2df4b5e108fa48d56dafd35d44a8e72e39f4369ca66ec064fe74f5 -->
Astryx, a design system and UI library, is available on this computer.
Inside a project that has its own Astryx text (an `astryx-project` skill, or an Astryx block in AGENTS.md or CLAUDE.md), follow that text: it knows the project's version and setup.
Use it when you build or change UI, pick components, or style or theme an app.
Its docs, components, templates, and themes are all reachable through `astryx`. To make a page, run `astryx build "<what the page is for>"` first, as the WORKFLOW below says. Start with `astryx search '<what you need>'` for anything else.
Then read `astryx component <Name>` or `astryx docs <topic>`, not the package's files.
In a project, the project's version of Astryx answers automatically.
To build UI, work in a project folder (create one if there is none). Add `@astryxdesign/core` and `@astryxdesign/cli` to a new project or one without `@astryxdesign/core`; to a project that already has `@astryxdesign/core`, add `@astryxdesign/cli` at the same version, pinned exactly when Core is (no `^` or `~`). Run `astryx init` there and follow the agent docs it writes.
WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx template <Block>` for parts it lacks; `astryx component <Name>` to read props before using one.
Before you deliver, re-read each file; replace any raw <div>/<span>, imported .css/@apply, or hardcoded #hex/px with the component or a token. Then build the project and deliver that build, not a description of it.
If `astryx` is not found, run `npm i -g @astryxdesign/cli` first.
<!-- ASTRYX:END -->
