# Development Guide

## Requirements

- Node.js 24
- npm 10 or newer
- A browser with WebGL

```sh
npm install
npm run dev
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite for local development. |
| `npm run build` | Run dependency-free production and grammar verification. |
| `npm run test` | Run focused Vitest module tests. |
| `npm run typecheck` | Validate TypeScript declarations and test configuration. |
| `npm run verify` | Run build, unit tests, and type checking. |
| `npm run update:mathquill` | Explicitly refresh vendored MathQuill assets; review the resulting diff. |

## Adding or Changing Expression Syntax

Update every applicable layer:

1. `LATEX_FUNCTIONS` and display command maps.
2. Text/LaTeX normalization and parser arity.
3. `BUILTIN_NAMES` and generated GLSL reserved names.
4. CPU evaluation in `compileExpression`.
5. GLSL substitutions and helper implementation in `expressionToGlsl`/`buildFragmentShader`.
6. Validation and naming diagnostics.
7. Keyboard/autocomplete controls and help text.
8. `scripts/check-editor-symbols.mjs` round-trip, CPU, and GLSL cases.
9. `docs/LEPTON_LANGUAGE.md`, tutorial copy, and affected samples.

Never add a display-only symbol without a compiler form, or a CPU built-in without a GLSL equivalent.

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

## Release Checklist

1. Run `npm run verify`.
2. Update `APP_VERSION` in both runtime modules and every matching `?v=` reference in `index.html`, `app.html`, and tests.
3. Update sample source and thumbnails together when a sample changes.
4. Update `sitemap.xml` dates for public-page changes.
5. Review `git diff --check`, dead imports, TODO/FIXME markers, and generated/vendor churn.
6. Commit and push `main`.
7. Confirm the GitHub Actions Node 24 CI run passes.
8. Confirm GitHub Pages serves the new version and both public URLs return `200`.

## Repository Policy

CI uses Node 24 and dependency caching through `package-lock.json`. The Pages workflow uploads and deploys the static repository with GitHub's supported Pages actions. Do not commit secrets, local IDE files, generated Python caches, or browser storage. Vendored MathQuill files are intentionally tracked.
