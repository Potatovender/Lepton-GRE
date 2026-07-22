# Lepton Architecture

## Runtime Flow

Lepton is a static browser application. `app.html` loads vendored MathQuill, `src/styles.css`, and the production ES module `src/browser-preview-live.js`.

```text
URL / saved graph / text input
              |
              v
        importScene + normalization
              |
              v
     canonical in-memory scene + dataOrder
        |             |              |
        v             v              v
 visual rows     exportScene     validateScene
        |                            |
        +---------- edits -----------+
                                     |
                                     v
                           expressionToGlsl
                                     |
                                     v
                        cached WebGL program + uniforms
```

The canonical scene stores collections for values, colours, boundaries, transparency, draws, points, and folders. `dataOrder` owns root/nested ordering independently of the storage collections. Comments are entries or inline metadata so text and Standard views can round-trip without losing placement.

## Ownership Boundaries

- **HTML shells:** `index.html` and `app.html` contain metadata and initial loading states only.
- **Landing behavior:** `src/landing.js` owns bundled sample text and generated sample links.
- **Live runtime:** `src/browser-preview-live.js` owns scene state, UI rendering, interaction, import/export, validation, CPU evaluation, GLSL generation, animation, save/load, and export.
- **Syntax primitives:** `src/math/expression-syntax.js` owns implicit multiplication and right-associative power lowering used by both CPU and GLSL paths.
- **Styles:** `src/styles.css` owns all responsive layout and component states.

Do not introduce another scene model or parser alongside the live runtime. A future modularization should move cohesive helpers out of the runtime while preserving one canonical call path and executable regression suite.

## Expression Pipeline

1. Editor or text input is normalized by `normalizeExpressionDisplayText` and `normalizeExpressionText`.
2. LaTeX forms, fractions, stretchy delimiters, point selectors, implicit multiplication, and powers become canonical compiler text.
3. `validateExpression` resolves identifiers, arity, recursion, and syntax.
4. `compileExpression` produces the CPU fallback evaluator.
5. `expressionToGlsl` recursively expands references and produces GLSL-safe expressions.

Parameterized function locals shadow outer values. Expressions and sliders resolve by ID. Point selectors support `point.x`, `point.y`, `point[0]`, and `point[1]`. Recursive expansion returns the configured base value `0` at maximum depth.

## Rendering

The primary renderer draws a full-screen triangle and evaluates each visible draw layer in the fragment shader. Viewport bounds, clipping, random seed, background colour, resolution, and animated time values are uniforms.

The WebGL cache key contains graph structure but replaces current time values with a stable marker. Consequently:

- ordinary animation frames update uniforms and issue a draw;
- expression, layer, colour, boundary, transparency, or angle-mode edits rebuild the shader;
- viewport, seed, background, and time-value changes do not recompile the program;
- obsolete programs and buffers are deleted on replacement;
- `gl.finish()` is reserved for image export, where synchronous completion is required.

The CPU renderer is a compatibility fallback and intentionally samples at the configured point density. It should not be used as the performance reference for normal WebGL scenes.

## Diagnostics

`validateScene` returns per-collection diagnostics and a scene summary. Red prevents affected output, yellow reports a recoverable concern, and blue reports potentially expensive recursion. A broken layer should not suppress unrelated valid layers.

Animation reuses the latest structural diagnostics because changing a numeric time value cannot change syntax, names, arity, or dependency structure. Any editor render refreshes the diagnostic snapshot.

## Persistence and Compatibility

- URL scenes use the `scene` query parameter.
- up to 60 saved graphs live in browser `localStorage` under `lepton-saved-graphs-v1`; each stores canonical scene text and a compressed 160×100 preview capped at 24,000 characters;
- legacy PNG previews are displayed while they are compacted, and missing legacy previews are regenerated lazily from scene text only when their library rows become visible;
- loading a saved graph retains its local identity, so Save immediately replaces that entry; an unsaved graph prompts for a new name;
- current exports use keyword grammar;
- legacy `F:`, `C:`, `R:`, `D~`, and `S:` lines remain import-only compatibility paths;
- folders and comments are preserved in current text exports.

## Performance Rules

- Never validate, generate, compile, or link a structurally unchanged shader per animation frame.
- Pass frequently changing scalar values as uniforms.
- Keep CPU parsing and DOM reconstruction out of the animation loop.
- Avoid synchronous GPU waits except before readback/export.
- Treat large expanded recursive expressions and many procedural octaves as real graph-computation cost; report them through diagnostics rather than hiding them with UI work.
- Profile both JavaScript frame time and GPU shader cost before optimizing either layer.
