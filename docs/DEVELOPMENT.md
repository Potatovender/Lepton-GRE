# Development Guide

## Requirements

- Node.js 24
- npm 10 or newer
- A browser with WebGL

```sh
npm ci
npm run dev
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite for local development. |
| `npm run preview` | Serve the staged `dist/` build locally after building. |
| `npm run build` | Run dependency-free checks and stage the explicit public file list in `dist/`. |
| `npm run test` | Run focused Vitest syntax tests and isolated renderer tests. |
| `npm run test:renderer` | Test GPU resource lifecycle, cache reuse, dimensions, and failures without a browser. |
| `npm run test:browser` | Run real keyboard/selection and MathQuill remount checks against `dist/` (build first; install Chromium with `npx playwright install chromium`). |
| `npm run typecheck` | Validate TypeScript declarations and test configuration. |
| `npm run verify` | Run build, unit tests, and type checking. |
| `npm run update:mathquill` | Restore the pinned MathQuill assets, verifying hashes before replacement. |

For a deliberate MathQuill upgrade, inspect the upstream release, update
`src/libs/mathquill/vendor.json` with its exact version and verified hashes, then
run the updater and editor browser checks. Never use `@latest` for production
vendor files. The build verifies the current pin offline.

## Adding or Changing Expression Syntax

Update every applicable layer:

1. The function definition in `src/math/builtins.js`; names, display command maps,
   argument counts, and MathQuill operator suggestions derive from it.
2. Text/LaTeX normalization and parser arity.
3. Generated GLSL helper names, when introducing a new helper. Public names are
   reserved automatically by the metadata module.
4. CPU evaluation in `compileExpression`.
5. GLSL substitutions and helper implementation in `expressionToGlsl`/`buildFragmentShader`.
6. Validation and naming diagnostics.
7. Keyboard/autocomplete controls and help text.
8. `scripts/check-editor-symbols.mjs` round-trip, CPU, and GLSL cases.
9. `docs/LEPTON_LANGUAGE.md`, tutorial copy, and affected samples.

Never add a display-only symbol without a compiler form, or a CPU built-in without a GLSL equivalent.

See [Extending Lepton](EXTENDING_LEPTON.md) for ownership boundaries, the new-data
checklist, and the proposed shared web/desktop architecture. Those future features
are not yet implemented.

## Adding a Data Type

Update the default scene collection, normalization, UID/order handling, row renderer, type menu/filter, diagnostics, dependencies, import/export, folder behavior, deletion and rename references, draw integration where applicable, text highlighting, tests, and documentation. Confirm mixed-order and nested-folder round trips.

## Adding a Setting

Add the default, text key mapping, import/export conversion, UI control and help text, validation, scene snapshot/history behavior, rendering use, tests for omitted/default/invalid forms, and language documentation.

## Runtime Performance

Animated time values are uniforms. The renderer caches the WebGL program and full-screen buffer by structural graph key. A normal animation frame should update uniforms, clear, draw, and paint overlays; it must not validate the entire scene or compile/link a shader.

When investigating low FPS:

1. Check whether `window.__leptonShaderBuildCount` rises while only time changes. It should remain stable.
2. Profile JavaScript separately from GPU draw time.
3. Check expanded expression size, repeated draw layers, recursion depth, procedural octave count, and transcendental calls.
4. Confirm the app is using WebGL rather than the CPU fallback.
5. Keep `gl.finish()` out of live rendering; it is allowed only for export/readback.

Changing expressions or render structure should invalidate the cache. Viewport, time, random seed, clipping bounds, and background colour are uniforms and should not.

## Browser Regression Matrix

Before release, verify:

- blank graph on landing and direct `app.html`;
- favicon on landing, blank, URL scene, and all sample links;
- Standard/Text/Standard round trip with folders, standalone and inline comments, fractions, exponents, piecewise expressions, and custom functions;
- expression, slider, time slider, parameterized function, colour, boundary, transparency, point, folder, comment, and draw rows;
- rename reference propagation, duplicate/reserved-name diagnostics, dependency filtering, sorting, nested drag/drop, and dropdown creation;
- animated time playback, live slider-bound edits, FPS output, pan/zoom, coordinate-grid switches, settings return, and sidebar resize;
- save/load/new/export and an export whose aspect ratio differs from the visible renderer;
- Mandelbrot recursion and at least one high-detail animated sample;
- no console errors at desktop and narrow widths.
- on mobile, equal upper graph/lower editor regions, focused field visibility
  when the keyboard reduces the viewport, and text-editor scrolling in both axes.

`npm run test:browser` creates isolated profiles and checks stable horizontal
scroll positions during middle edits, minimal edge movement, both selection
directions, four panel/viewport sizes, and three Apply/Reload cycles. It serves
the exact staged build and closes that server on completion. Set `LEPTON_TEST_URL`
to a local or public base URL to verify a deployment. Optional
`LEPTON_TEST_BROWSER=webkit` uses WebKit after `npx playwright install webkit`;
`LEPTON_BROWSER_EXECUTABLE` selects a preinstalled test browser.
The same suite checks that Vite serves sample source files byte-for-byte without
injecting source-map comments. Use the URL printed by Vite or its automatic port;
some otherwise unused ports (including 4190) are blocked by browser networking.

## Release Checklist

1. Run `npm run verify` and `npm run test:browser`.
2. Update `APP_VERSION` in both runtime modules and every matching `?v=` reference in `index.html`, `app.html`, and tests.
3. Update sample source and thumbnails together when a sample changes.
4. Update `sitemap.xml` dates for public-page changes.
5. Review `git diff --check`, dead imports, TODO/FIXME markers, and generated/vendor churn.
6. Commit and push `main`.
7. Confirm the GitHub Actions Node 24 CI run passes.
8. Confirm both Pages build/deploy jobs passed and public `release.json` matches
   the pushed commit. Check both public URLs and all sample links return `200`.

The Pages build runs `npm ci` and `npm run verify` before uploading `dist/`.
Deployment depends on that exact build, not the result of a different CI run.
`scripts/site-files.mjs` is the complete public-file allowlist. Add new public
assets there deliberately; do not deploy the repository root.
The Pages upload action includes hidden files explicitly so the staged
`.nojekyll` marker is retained. The allowlist ensures no private hidden files
enter that artifact.

For a rollback, revert the faulty commit, verify, and push the revert so Pages
publishes a traceable replacement. Do not force-push release history. Branch
protection and an open-source license remain repository-owner choices.

## Repository Policy

CI uses Node 24 and dependency caching through `package-lock.json`. Do not commit
secrets, local IDE files, generated caches, browser storage, or audit screenshots.
Vendored MathQuill files and their MPL license are intentionally tracked.
Independent experiments must not be swept into a release with `git add .`.
