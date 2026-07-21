# Lepton GRE

[![CI](https://github.com/Potatovender/Lepton-GRE/actions/workflows/ci.yml/badge.svg)](https://github.com/Potatovender/Lepton-GRE/actions/workflows/ci.yml)

Lepton GRE (Lepton Graph Rendering Interface) is a browser-based mathematical field renderer. A scene combines expressions, parameterized functions, sliders, colours, boundaries, transparency, points, and ordered draw layers, then evaluates the result as a per-pixel GLSL graph.

- Live site: [potatovender.github.io/Lepton-GRE](https://potatovender.github.io/Lepton-GRE/)
- Grapher: [potatovender.github.io/Lepton-GRE/app.html](https://potatovender.github.io/Lepton-GRE/app.html)
- Language reference: [docs/LEPTON_LANGUAGE.md](docs/LEPTON_LANGUAGE.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Development and releases: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## Features

- Unified visual workspace and one-to-one Lepton text representation.
- MathQuill-backed structured equation editing and LaTeX clipboard input.
- Expressions, parameterized functions, sliders, animated time values, colours, boundaries, transparency, points, folders, and comments.
- Piecewise expressions, recursive references with a configurable depth, and dependency-focused workspace filtering.
- Full-canvas WebGL rendering, coordinate-grid controls, pan/zoom, local saves, PNG export, and sample scenes.
- Live diagnostics for syntax, naming, recursion size, dependencies, channels, settings, and draw components.

## Quick Start

Lepton is a static site. Node.js 24 is recommended for development.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The landing page is `index.html`; the editor is `app.html`.

Run the complete local verification suite before committing:

```sh
npm run verify
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
boundary visible = 1~False
draw(wave,colour=ocean,boundary=visible)
```

Only the first argument to `draw` is required. Missing colour, boundary, and transparency components use Lepton's virtual defaults.

## Repository Map

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page, metadata, samples, and blank-graph links. |
| `app.html` | Grapher HTML shell and production script/style entry points. |
| `src/browser-preview-live.js` | Production state, UI, text import/export, diagnostics, expression compilation, animation, and WebGL rendering. |
| `src/math/expression-syntax.js` | Shared implicit-multiplication and power-precedence transformations. |
| `src/landing.js` | Landing-page sample source and launch URL generation. |
| `src/styles.css` | Landing and grapher styles. |
| `src/libs/mathquill/` | Vendored equation editor assets. |
| `src/assets/` | Logo, favicon, hero, and sample images. |
| `scripts/build.mjs` | Dependency-free repository and runtime verification entry point. |
| `scripts/check-editor-symbols.mjs` | Executable grammar, parser, model, UI-contract, and GLSL regression suite. |
| `tests/` | Focused Vitest tests for the standalone syntax module. |
| `sample code/` | Copyable current-language scenes used by tests and documentation. |
| `docs/` | Architecture, language, development, and design references. |

The production app intentionally has one runtime entry point. Older parallel model/UI implementations were removed so grammar and rendering changes cannot diverge between unused and live code paths.

## Browser Support

Lepton requires a modern browser with ES modules, Canvas, and WebGL. WebGL is the primary renderer; a CPU renderer remains as a compatibility fallback. PNG export uses the same GLSL scene and configured viewport as the live graph.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing grammar or rendering behavior. Every language feature must remain aligned across text import/export, editor display, validation, CPU evaluation, GLSL generation, tests, samples, help text, and documentation.

## License

No open-source license has been selected. Unless a license is added, the repository remains under the copyright holder's default rights.
