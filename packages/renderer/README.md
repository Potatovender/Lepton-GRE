# Lepton Renderer

The reusable GPU rendering driver for Lepton. This package owns GLSL compilation,
program caching, uniform updates, fullscreen drawing, GPU limits, and resource
cleanup. It has no dependency on MathQuill, the GRE interface, or browser storage.
Its JavaScript ES module ships with TypeScript declarations.

The Lepton-language compiler and scene model still live in the GRE's
`src/browser-preview-live.js`. They produce GLSL for this driver. This package
does not parse Lepton text, draw coordinate labels, or manage point interaction.

## Use

```js
import { renderFrame, disposeRenderer } from "./packages/renderer/src/index.js";

renderFrame(canvas, {
  width: 640,
  height: 480,
  dpr: 1,
  bounds: { xMin: -10, xMax: 10, yMin: -7.5, yMax: 7.5 },
  shaderKey: "example-v1",
  floats: { u_time: 2 },
  fragmentSource: `
    precision highp float;
    uniform vec2 u_resolution;
    uniform vec4 u_bounds;
    uniform float u_time;
    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float x = mix(u_bounds.x, u_bounds.y, uv.x);
      float y = mix(u_bounds.z, u_bounds.w, uv.y);
      float value = 0.5 + 0.5 * sin(x + y + u_time);
      gl_FragColor = vec4(value, 0.25, 1.0 - value, 1.0);
    }
  `
});

// Call when permanently replacing a canvas.
disposeRenderer(canvas, { loseContext: true });
```

The supplied shader uses GLSL ES 1.00 syntax. The driver requests WebGL 2 then
WebGL 1, and provides six vertices covering the canvas. Increment `shaderKey`
when source structure changes. Numeric time, bounds, and background changes
reuse the existing program. A `fragmentSource` factory runs only on cache misses.

Available uniforms are `u_resolution` (physical pixels), `u_bounds` and
`u_clip_bounds` (`xMin, xMax, yMin, yMax`), `u_clip_enabled` (integer),
`u_background` (RGB 0..1), and the scalar entries in `floats`. The fragment shader
is responsible for applying clipping and compositing. Unused uniforms are fine.

The return value reports support, whether compilation happened, compile time,
and source. Invalid dimensions, context loss, or shader errors throw
`RendererError`; unavailable WebGL returns `supported: false` for a caller's
fallback. Set `synchronous: true` only for immediate image readback, never live
animation. Dimensions are bounded by the device's renderbuffer limit; the
default generated-source budget is 1,500,000 characters.

## Tests and Export

From the repository root:

```sh
npm run test:renderer
npm pack ./packages/renderer --pack-destination /tmp
```

Tests run with Node's built-in test runner and a mock GPU, with no installation
required. GRE browser checks additionally exercise this exact driver on real
WebGL contexts. To transfer its complete history-aware folder:

```sh
git archive --format=tar HEAD packages/renderer > /tmp/lepton-renderer.tar
```

Keep changes here in the same commit as affected GRE adapter changes. A separate
repository can be split out once the language/compiler API is stable; keeping
this package here currently avoids incompatible editor/renderer releases.

Lepton's owner has not selected an open-source license. `UNLICENSED` records that
fact; packaging does not grant additional reuse rights.
