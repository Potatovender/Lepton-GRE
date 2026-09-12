# Release Readiness

Checked on 2026-09-12 for `20260912-enter-folder-lines`. This supersedes the
initial desktop-only audit. It is a bounded validation record, not a guarantee
that every GPU, browser, expression, or editing sequence is bug-free.

## Deployment

The public homepage is <https://potatovender.github.io/Lepton-GRE/> and the editor
is <https://potatovender.github.io/Lepton-GRE/app.html>. The authoritative deployed
version/commit is in [release.json](https://potatovender.github.io/Lepton-GRE/release.json).
A query string alone does not publish new code.

The Pages workflow now installs locked dependencies and runs verification before
uploading an explicit 38-file public artifact. Deploy depends on that build of the
same commit. Tests, development documents, node_modules, local saves, audit
screenshots, and unrelated ItGE experiments are not deployed.

## Corrections

- Pressing Enter after editing a Standard-mode data row creates a blank
  expression immediately after that row, inherits its folder membership, focuses
  the new editor, and leaves all existing mixed data in place. Graphs opened from
  URLs, samples, imports, or local saves start with every folder closed; opening
  and closing folders remains UI state and does not alter exported Lepton text.
- Lists, comprehensions, summation, and products use typed collection plans
  shared by CPU and GLSL. Lists broadcast scalars, index from zero, and draw in
  element order. Limits accept coordinates and have lexical loop bindings.
  MathQuill provides editable sum/product limits; collection data and comments
  survive repeated editor and local-save round trips. The maximum list size
  defaults to 10,000, with blue size warnings and no silent truncation.
- Collection/reduction shaders use GLSL ES 3.00, with a matching vertex shader.
  WebGL 1 retains scalar-graph support and reports an explicit error for dynamic
  collection shaders. Large reductions are not given an additional hard iteration cap.
  Explicit undefined-value handling avoids a WebKit/Chromium discrepancy for
  negative square roots used as coordinate-dependent reduction bounds.
- The type chooser has a More data catalog, including points and HSV colours.
  HSV supports wrapping hue in degrees and clamped saturation/brightness, across
  CPU/GLSL rendering, point colours, backgrounds, previews, and export. It shares
  the RGB colour namespace and reference controls.
- Reselecting a colour type no longer resets its formulas. RGB/HSV switching
  keeps channel formulas in order; changing models reinterprets their units.
- Empty expression/function/slider/boundary/transparency entries and standalone
  comments survive text import. Comments before points/folders and at folder
  endings retain their position. Unknown background/point colour IDs stay in the
  source and are flagged instead of silently being replaced with defaults.
- Horizontal equation scrolling no longer follows MathQuill's offscreen hidden
  textarea on every input. It stays fixed while a caret has room, and only moves
  enough to reveal an out-of-view caret. Pointer drag-scroll handlers no longer
  run several times for the same mouse movement.
- Grouped power bases retain parentheses across all serializers and CPU/GLSL
  compilation. `(2^3)^2` evaluates to 64, not 512.
- Empty custom-function input slots are rejected for scalar calls, point
  expansion, and component selectors. Point literals keep internal commas.
- Bare callable built-in names produce an error rather than a green status and
  an undeclared shader identifier. Local scalar parameters are not replaced by
  built-in constants/functions before CPU evaluation.
- Failed first renders can release an acquired WebGL context even when no GPU
  program was cached. Disposal/retry cases have standalone tests.
- Public function metadata is centralized in `src/math/builtins.js`. No second
  parser, engine, or editor was introduced.
- The development server serves extensionless sample files as plain text instead
  of appending JavaScript source-map comments that appear as extra data rows.
- Mobile now uses equal upper graph/lower editor regions. It follows the visible
  viewport when the keyboard opens and scrolls the active field into view without
  rebuilding its MathQuill state. Compact controls keep Text mode editable on
  short viewports; the custom-keyboard toggle no longer covers its action buttons.
- Status priority is **red > yellow > blue > green** on rows, folders, and the
  scene summary. Real syntax/dependency errors are checked before recursion-size
  warnings. Point errors also propagate to containing folders.
- Point-function arithmetic validation uses source-level component selectors
  instead of exposing CPU-only helper calls to the GLSL compiler.
- Degree-mode CPU evaluation and nested GLSL references now agree. Circular trig
  inputs and inverse outputs follow angle mode; hyperbolic functions do not.
- Piecewise single equality now compares instead of becoming an assignment.
- Invalid builtin input counts are diagnosed through references and both
  compilers. A broken layer does not prevent unrelated valid layers.
- Legacy boundary/value pairs with the same ID no longer introduce recursion.
- Saving graph 61 reports the library limit without silently evicting graph 1.
  Updating an existing save remains possible; thumbnail recovery preserves all
  scene records.
- Clean Text drafts refresh from Standard edits. Loading another graph clears
  the prior draft; unapplied drafts remain protected.
- Export releases menu focus. Shader errors report failure rather than ready.
  Malformed points no longer abort the complete point overlay.
- Coordinate ticks use bounded screen-space counts per axis, preventing excessive
  work with very different x/y ranges.
- The WebGL driver is isolated in `packages/renderer` with a typed API, tests,
  explicit cleanup, and no GRE/MathQuill dependency. The Lepton compiler remains
  in the GRE; this is not a second language implementation.
- MathQuill's existing assets were matched to version 2026.4.21 and pinned with
  hashes, origin, archive integrity, and the MPL license. No editor upgrade was
  slipped into this release.
- The prior Nano ID/PostCSS fixes are retained. A new development-only Vitest
  advisory was resolved by upgrading to patched 4.1.11 and using its typed
  configuration import. Playwright 1.62.1 is pinned for browser regressions;
  neither test package is deployed. npm audit reports zero known vulnerabilities.

## Verification

- **167** runtime/model/grammar checks, **17** syntax unit tests, and **13**
  standalone GPU-driver tests passed.
- All **9** maintained sample files passed current-syntax migration checks.
- Collection checks include independent GPU pixels for nested reductions,
  element-wise operations, point-function composition, coordinate-dependent
  bounds, exact list limits, and 10,000-term workloads. Browser flows cover
  actual sum/product/comprehension typing, mobile creation, maximum-list settings,
  ordered draw counts, and saved folders/comments/previews.
- All nine sample sources remain canonically identical after repeated import/export
  cycles, with no dropped declarations. Mixed RGB/HSV scenes retain comments,
  folders, references, and incomplete entries through round trips and local saves.
- HSV reference tests cover all six hue sectors, negative/multiple-turn hue,
  saturation/brightness clamping, mapped draw coordinates, and backgrounds.
- Build, tests, and TypeScript declaration/configuration checks passed. Production JavaScript is
  exercised by tests; this does not claim a full `checkJs` type check.
- Chromium: landing, blank editor, all **8** gallery scenes, favicon URLs, sample
  links, and nonblank graph output passed the load smoke checks.
- Three Text Apply/Reload/Standard cycles preserved fractions and comments and
  remounted MathQuill. Keyboard edits in the middle retained the caret position.
- Browser interaction checks confirm that Enter places and focuses a new line
  beneath a root or nested-folder row, while URL and saved-graph loads keep nested
  folder contents intact and initially collapsed.
- The checked-in Playwright suite measures scroll offsets, not just saved text:
  middle typing/backspace, arrows, Home/End, and both drag-selection directions
  pass at 380/760/1100 px desktop sidebars and a 390 px phone viewport. Additional
  checks cover all mathematical row types, grouped exponents, and GPU pixels.
  Both CI and Pages run this suite against the staged files before publishing.
- Background selection beyond the first colour, grid switches, and boundary
  inequality controls persisted and round-tripped.
- GPU pixel readback agreed with independent JavaScript calculations for nested
  fractions, negative exponents, circular/hyperbolic trig, inverse hyperbolic
  functions, roots, clamps, and piecewise conditions, within 8-bit image
  quantization tolerance. Separate checks covered nested degree-mode references.
  The same independent calculations also passed with WebGL 1 forced.
- Water save/load produced a decodable, nonuniform 160 x 100 WebP preview of about
  3.6 KB. Export produced a nonblank 1000 x 1000 PNG matching settings.
- Water animation advanced time without recompiling the unchanged shader.
- Phone tests: 390 x 844 gives 422 px to each pane. With a keyboard-sized visible
  viewport of 390 x 500, both panes become 250 px and the focused last field stays
  visible. Text remains scrollable and editable. 360 px portrait, 760 px landscape,
  and 820 px tablet layouts retain reachable graph/editor regions.
- Final desktop and mobile flow runs recorded no uncaught page errors. Browser
  tests used isolated profiles, not the user's saved-graph library.

Local screenshots/results live in `output/playwright/release-audit/`, excluded
from Git and deployment. Focused caret screenshots are in
`output/playwright/editor-regression/`.

## Remaining Checks and Owner Decisions

- The maintainer reports desktop Safari working. WebKit 26.5 passes the focused
  editor and GPU regression suite as well. An earlier local-port timeout was
  resolved by using the staged server's automatic port instead of restricted
  port 4190. These are engine tests, not physical-device testing. Real iPhone/Android keyboard
  behavior and Firefox still deserve a physical-device check. Keyboard-resize
  simulation is not the same as testing an operating system's software keyboard.
- Correct independent pixel calculations do not prove performance on low-powered
  GPUs. High-detail scenes can still compile slowly or render at low FPS.
- Coordinate-dependent list sizes and sum/product bounds can change at each
  pixel. Complexity is estimated, not a guaranteed frame-time limit. Huge or
  nested reductions may stall the page or fail on GPU limits; blue warnings are
  not a reliable automatic hang-prevention mechanism.
- Saves are local to an origin and browser, not cloud backups. Copy Lepton text
  before clearing website data, moving domains, or deleting saved graphs.
- Select a Lepton license if open-source reuse is intended. No license has been
  chosen on the owner's behalf. Third-party license notices are included.
- Branch protection, a release tag, and a formal supported-device policy can be
  added when announcing a stable release. These are not required to serve this
  verified public build.

## Performance Notes

Sample compile indicators in this environment ranged from a few milliseconds
for simple scenes to roughly 165 ms for Sky, 538 ms for Tree, and 625 ms for
Marble. Tree generated about 539 KB of GLSL. These are single-run compile
indicators, not frame-time or cross-device benchmarks.

Normal animation uses uniforms and cached GPU programs; synchronous GPU waits
are restricted to readback/export. Future profiling should measure CPU and GPU
time separately. CPU reference evaluation still recompiles formulas and GLSL
still expands repeated references; caching CPU evaluators and shared GLSL
subexpressions remain worthwhile focused performance work.
