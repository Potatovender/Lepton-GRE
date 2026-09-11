# Lepton GRE

[![CI](https://github.com/Potatovender/Lepton-GRE/actions/workflows/ci.yml/badge.svg)](https://github.com/Potatovender/Lepton-GRE/actions/workflows/ci.yml)

Lepton GRE (Lepton Graph Rendering Interface) is a browser-based mathematical field renderer. A scene combines expressions, parameterized functions, sliders, colours, boundaries, transparency, points, and ordered draw layers, then evaluates the result as a per-pixel GLSL graph.

- Live site: [potatovender.github.io/Lepton-GRE](https://potatovender.github.io/Lepton-GRE/)
- Grapher: [potatovender.github.io/Lepton-GRE/app.html](https://potatovender.github.io/Lepton-GRE/app.html)
- Language reference: [docs/LEPTON_LANGUAGE.md](docs/LEPTON_LANGUAGE.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Development and releases: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- Extension guide and proposed web/desktop roadmap: [docs/EXTENDING_LEPTON.md](docs/EXTENDING_LEPTON.md)

## Features

- Unified visual workspace and one-to-one Lepton text representation.
- MathQuill-backed structured equation editing and LaTeX clipboard input.
- Expressions, parameterized functions, sliders, animated time values, colours, boundaries, transparency, points, folders, and comments.
- More data catalog for supported entry types, including points and HSV colours
  with looping hue and clamped saturation/brightness. RGB and HSV share colour references.
- Piecewise expressions, recursive references with a configurable depth, and dependency-focused workspace filtering.
- Scalar lists, indexed access, element-wise arithmetic, list comprehensions,
  summation/products with editable LaTeX limits, and ordered list drawing.
- Full-canvas WebGL rendering, coordinate-grid controls, pan/zoom, local saves, PNG export, and sample scenes.
- Live diagnostics for syntax, naming, recursion size, dependencies, channels, settings, and draw components.
- Phone layout with the graph above the editor, adapting to the visible viewport while typing.
- A separately packaged, dependency-free [GPU renderer](packages/renderer/README.md) with TypeScript declarations.

## Quick Start

Lepton is a static site. Node.js 24 is recommended for development.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The landing page is `index.html`; the editor is `app.html`.
To inspect the exact deployable artifact, run `npm run build` then `npm run preview`.

Run the complete local verification suite before committing:

```sh
npm run verify
npx playwright install chromium
npm run test:browser
```

The dependency-free production check can also run without installing packages:

```sh
node scripts/build.mjs
```

## Minimal Scene

```text
set x_min = -10
set x_max = 10
set y_min = -10
set y_max = 10
expression wave = sin(x)+cos(y)
colour ocean = 40+20*wave~120+35*wave~210
boundary visible = 1
draw(wave) {colour=ocean, boundary=visible}
```

Only the first argument to `draw` is required. Missing colour, boundary, and transparency components use Lepton's virtual defaults.

## Repository Map

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page, metadata, samples, and blank-graph links. |
| `app.html` | Grapher HTML shell and production script/style entry points. |
| `src/browser-preview-live.js` | Production state, UI, text import/export, diagnostics, expression compilation, animation, and WebGL rendering. |
| `packages/renderer/` | Reusable WebGL driver, typed API, isolated Node tests, and packaging instructions. No dependency on the GRE UI. |
| `src/math/expression-syntax.js` | Shared implicit-multiplication and power-precedence transformations. |
| `src/math/builtins.js` | Shared built-in names, arity, display aliases, LaTeX commands, and MathQuill operator suggestions. |
| `src/math/colour.js` | Colour channel definitions and matching CPU/GLSL HSV conversion. |
| `src/math/collections.js` | Typed collection plans, scoped bindings, broadcasting, reductions, and lazy GLSL element evaluation. |
| `src/landing.js` | Landing-page sample source and launch URL generation. |
| `src/styles.css` | Landing and grapher styles. |
| `src/libs/mathquill/` | Vendored equation editor assets. |
| `src/assets/` | Logo, favicon, hero, and sample images. |
| `scripts/build.mjs` | Dependency-free verification followed by staging the public build in `dist/`. |
| `scripts/site-files.mjs`, `scripts/stage-site.mjs` | Explicit public-file list and release metadata generation. |
| `scripts/check-editor-symbols.mjs` | Executable grammar, parser, model, UI-contract, and GLSL regression suite. |
| `scripts/check-editor-browser.mjs` | Actual typing, caret/selection scrolling, and repeated editor-mount checks against the staged release. |
| `scripts/check-collections-browser.mjs` | Collection CPU/GPU cases, real sum/product typing, list editing and round trips. |
| `tests/` | Focused Vitest tests for the standalone expression-syntax module. |
| `sample code/` | The single source of truth for copyable landing-page samples. `npm run migrate:samples` upgrades recognized legacy forms after grammar changes. |
| `docs/` | Architecture, language, development, and design references. |
| `THIRD_PARTY_NOTICES.md` | Library attribution, exact MathQuill source/version, and license references. |

The production app intentionally has one runtime entry point. Older parallel model/UI implementations were removed so grammar and rendering changes cannot diverge between unused and live code paths.

## Browser Support

See the [release-readiness audit](docs/RELEASE_READINESS.md) for current validation,
tested workflows and remaining device-specific checks.

Lepton requires a modern browser with ES modules, Canvas, and WebGL. WebGL is the primary renderer; a CPU renderer remains as a compatibility fallback. PNG export uses the same GLSL scene and configured viewport as the live graph.

Collection/reduction rendering requires WebGL 2. Very large lists or nested sums can
still exceed GPU resources; blue complexity warnings are not an execution budget.

At phone widths (760 CSS pixels or less), the graph fills the upper half and the
editor fills the lower half. The layout follows the visible viewport as the
native keyboard opens; the focused math field scrolls into view. Desktop Safari
has been checked by the maintainer. Automated Chromium checks include narrow
layouts, keyboard-resize simulation, all gallery scenes, and GPU pixel readback.
Real iOS/Android keyboard behavior and low-end GPU throughput still need device
testing; large procedural scenes can compile or render slowly.

## Saving and Releases

Saved graphs stay in the current browser and website origin, not a cloud account.
The library supports up to 60 graphs with compact 160 x 100 previews; browser
storage quotas can still limit this. Copy the complete Text view as a backup.
Clearing site data or changing domain does not transfer saves automatically.

GitHub Pages deploys only after verification of the same commit passes. The
public artifact comes from `dist/`, not the full repository. Public
[release metadata](https://potatovender.github.io/Lepton-GRE/release.json) records
the version and deployed commit, so cache-busting links are not the only way to
check freshness. Sample links load their source files from that same build.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing grammar or rendering behavior. Every language feature must remain aligned across text import/export, editor display, validation, CPU evaluation, GLSL generation, tests, samples, help text, and documentation.

## License

No open-source license has been selected. Unless a license is added, the repository remains under the copyright holder's default rights.

Third-party software retains its own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
