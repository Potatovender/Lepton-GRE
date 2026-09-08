# Contributing to Lepton

## Before You Change Code

1. Read `docs/ARCHITECTURE.md` and `docs/DEVELOPMENT.md`.
2. Keep one production path: GRE state/compiler in `src/browser-preview-live.js`, shared syntax in `src/math/`, and GPU lifecycle in `packages/renderer`. Do not add parallel implementations.
3. Preserve text-to-standard round trips. Comments, folders, ordering, draw-component ordering, and settings are user data.
4. Do not silently change sample bounds, aspect ratios, or scene grammar.

## Required Checks

```sh
npm run verify
```

For UI changes, also test the blank graph and at least one static, animated, recursive, and folder-based scene in a browser. Check desktop and narrow sidebars, Standard/Text round trips, drag ordering, error tooltips, favicon loading, and the console.

For mobile changes, check portrait/landscape, the upper-graph/lower-editor split,
and whether a focused field stays visible while the keyboard reduces the visible
viewport. For renderer changes, run its package tests and actual browser pixel
readback in addition to comparing shader source.

## Change Scope

- Add focused tests with behavioral changes.
- Prefer existing helpers over a second parser, serializer, or scene model.
- Avoid unrelated formatting or asset churn.
- Keep vendored code under `src/libs/` unchanged except during an explicit dependency update.
- Update the language reference, tutorial/help copy, samples, and cache-busting version whenever grammar or user-visible behavior changes.

## Pull Requests

Describe the user-visible behavior, parser or rendering effects, tests run, and any remaining performance cost. Screenshots are useful for layout changes; copyable Lepton text is useful for grammar changes.
