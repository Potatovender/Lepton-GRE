# Lepton GRE

Lepton GRE, the Lepton Graph Rendering Interface, is a browser-based mathematical field renderer. It lets you define values, colors, boundaries, transparency, draw layers, recursion settings, and text-mode scenes, then renders the result as a dense per-pixel graph.

Live site: https://potatovender.github.io/Lepton-GRE/

## Project Structure

- `index.html`: Landing page with launch links, sample cards, SEO metadata, and favicon declarations.
- `app.html`: Main grapher page shell. It loads the MathQuill bundle, shared styles, and the live grapher script.
- `src/browser-preview-live.js`: Main GRE application runtime, including UI rendering, scene import/export, parser helpers, validation, recursion/node checks, MathQuill editing behavior, and GLSL canvas rendering.
- `src/landing.js`: Landing page sample definitions and sample-card launch URL wiring.
- `src/styles.css`: Shared styling for the landing page, grapher layout, editor controls, MathQuill fields, sample cards, and renderer surface.
- `src/assets/`: Logo, favicon source image, landing hero image, and sample graph thumbnails.
- `src/libs/mathquill/`: Vendored MathQuill-compatible editor runtime and CSS used for math entry.
- `src/math/`: Equation evaluation plus the shared live-expression syntax helpers for precedence, power lowering, and implicit multiplication.
- `src/model/`: Older TypeScript scene, color, and boundary model helpers.
- `src/ui/`: Earlier static UI shell code retained as project history/reference.
- `src/types.ts`: Shared TypeScript interfaces for scene data.
- `tests/`: Vitest coverage for equation, scene, color, and boundary behavior.
- `scripts/`: Build and validation utilities, including editor-symbol checks and the npm shim.
- `sample code/`: Copyable Lepton scene examples such as fire, Mandelbrot, and the logo sample.
- `robots.txt` and `sitemap.xml`: Search crawler configuration for the GitHub Pages deployment.
- `vite.config.ts`, `tsconfig.json`, `package.json`: Build, TypeScript, and package scripts.

## Development

Run the local Vite dev server:

```sh
npm run dev
```

Run the validation suite:

```sh
npm run build
```

Run tests directly:

```sh
npm test
```

## Lepton Text Format

Text mode exports settings first, followed by functions, colors, boundaries, and draw layers:

```text
set x_min = -15
set x_max = 15
set y_min = -15
set y_max = 15
set max_recursion = 100
set angle_mode = radians
set background_color = 0
set ensure_square_grid = True
set aspect_ratio = 1:1
set draw_only_inside_boundary = False
expression eq = sin(x)+cos(y)
colour rgb = 120+80sin(eq)~120+80cos(eq)~210
boundary rest = 1~False
transparency glass = clamp(abs(x),0,1)
draw(eq,colour=rgb,boundary=rest,transparency=glass)
```

Only the first draw argument is required. Optional named fields are `colour`, `boundary`, `transparency`, and `visible`. Transparency is evaluated like a colour channel: its `x` input is the selected draw value and its `y` input is the current vertical coordinate. The result is clamped from `0` (opaque) to `1` (transparent). Time sliders may include a coordinate-free speed, for example `time unbounded t = 0 speed 1.5`. While time is playing, the top bar reports the graph's measured rendering FPS.

`random()` is deterministic for each scene seed and takes no arguments. Use the shuffle control below the graph Settings button to generate and save a new seed.

Legacy `F:`, `C:`, `R:`, `D~`, and `S:` scene text is still imported for compatibility, but new exports use the clearer keyword-based format.
