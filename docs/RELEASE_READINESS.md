# Release Readiness

Updated on 2026-10-03 for `20261003-folder-apply-view`. The focused compiler, recursion,
and video-export checks below supplement the 2026-09-16 baseline audit. This is a bounded
validation record, not a guarantee
that every GPU, browser, expression, or editing sequence is bug-free.

## Deployment

The public homepage is <https://potatovender.github.io/Lepton-GRE/> and the editor
is <https://potatovender.github.io/Lepton-GRE/app.html>. The authoritative deployed
version/commit is in [release.json](https://potatovender.github.io/Lepton-GRE/release.json).
A query string alone does not publish new code.

The Pages workflow now installs locked dependencies and runs verification before
uploading an explicit 63-file public artifact. Deploy depends on that build of the
same commit. Tests, development documents, node_modules, local saves, audit
screenshots, and unrelated ItGE experiments are not deployed.

## Applying Folders in Sorted Views (2026-10-03)

- Follow-up reproduction used actual clipboard paste into a blank graph on the
  public site. In-order view hid children, but alphabetical and grouped views
  flattened the tree even though every folder was marked collapsed. The earlier
  closed-folder checks missed those view modes.
- All unfiltered sorts now retain folder structure and order siblings only.
  New, Load and either Apply action reset temporary view filters and dependency
  selections to the unfiltered in-order view. Source and saved order are unchanged.
- Regression coverage checks visible rows, not only the collapsed property:
  real paste, New after stale filters, both Apply buttons, every sort, nested
  expansion, comments and source round trips. Saved-graph Load is also checked
  after stale sorting and filters.
- Build/model checks, 297 unit tests, TypeScript, and the editor, collection and
  status browser suites passed locally in native Chrome. The deployment workflow
  runs all nine browser suites before publishing.

## Unary Signs, Points and Folder Presentation (2026-10-03)

- Reproduced `-(-x)` becoming `--x` (a decrement) and subtraction producing
  adjacent minus signs. Text, LaTeX, CPU and GLSL serialization now preserve
  unary grouping, including powers, fractions and nested calls.
- Reproduced named points failing argument expansion and nested point selectors
  leaking `leptonpointselector` placeholders. Selectors now retain AST structure;
  named points expand consistently, and nested calls respect scalar local scope.
  A related LaTeX sum/product routing bug found by the new tests is also fixed.
- Reproduced HTTP 500 for both extensionless bundled `LICENSE` files under Vite.
  The development middleware serves these exact allowlisted files as plain text;
  production staging and licence contents are unchanged.
- URL loads, saved graphs and repeated Apply already close nested folders in the
  current version; the reported open-on-load behavior did not reproduce.
  Folding did request an unnecessary render and reset flags to pending. It is
  now a UI-only update using cached diagnostics and existing graph canvases.
  Reopened draw rows also retain their cached list counts without requiring a
  fresh frame; the count lookup uses the row index, not a normalized object copy.
- Regression tests cover CPU results, repeated editor serialization, actual GPU
  pixels, closed-folder imports, fold request counts, and raw licence responses.
- Local build/model checks, 17 syntax tests, 52 renderer tests, 228 runtime tests,
  TypeScript and all nine native-Chrome browser suites passed. The GPU editing
  stress check retained all input without a runtime failure; its optional
  presentation-latency target was not met, so this is not a new performance claim.

## Text Layout and Folder Diagnostics (2026-10-02)

- Reproduced the Apply confirmation taking a 259-pixel grid row that belonged
  to the editor. The Text panel now gives only the editor flexible height;
  Apply/Reload notices and unapplied-draft warnings stay compact. Long notices
  wrap and scroll instead of displacing the editor or overflowing its sidebar.
- Reproduced `Folder contains: Folder contains:` in nested folders. Folder-name
  diagnostics now stay separate from aggregated child diagnostics, so repeated
  compilation/FPS updates neither duplicate the prefix nor retain stale child
  errors. Red/yellow/blue priority and own-name errors are preserved.
- Regression coverage includes Apply, Reload, long import notices, and draft
  warnings at desktop and phone sizes; nested folders, repeated aggregation,
  child recovery, and own-name errors are checked in the runtime and browser.
- The previously reported GPU stress failures did not recur in two isolated
  Chrome 154.0.8037.93 runs on this M4 Max. Both phases retained all 96 key edits,
  observed background compilation, and reported no runtime error or main-thread
  long task. Input-delay p95 was 0.2-0.5 ms; DOM mutation p95 was 1.5-1.6 ms.
  Presentation-inclusive Event Timing p95 during compilation remained 272-280 ms,
  above the optional 50 ms target. Passing correctness is not a claim that this
  presentation target or every GPU is covered. No renderer limits were relaxed.
- Build/model checks, 17 syntax tests, 52 renderer tests, 185 runtime tests,
  TypeScript, and all nine browser suites passed locally. The patched build also
  passed a third GPU editing stress run with no timeout or correctness failure.

## Piecewise Function Composition (2026-10-01)

- Fixed generated-output validation rejecting the `?` and `:` emitted when a
  piecewise function or variable is expanded into another expression. This was
  an application compiler rejection before WebGL compilation; CPU evaluation
  and direct nested piecewise blocks already worked.
- Both editor and generated worker compilers accept these generated ternaries.
  Variable-name flagging and statement-delimiter rejection are unchanged.
- Ten runtime regressions cover direct and nested calls, arithmetic, functions
  receiving conditional results, explicit fallbacks, variables, inline nesting,
  collection indexing, and retained rejection of statement delimiters.
- The native browser suite checks actual pixels for seven forms of piecewise
  composition, including the regions where an unmatched condition is undefined.
- Local build, syntax/renderer/runtime tests and TypeScript checks passed. Editor,
  status, collection, reference/gallery, snapshot, cooperative-renderer and both
  video browser checks passed. Reference/gallery required ANGLE Metal on this Mac;
  the default software renderer timed out waiting for a gallery preview.
- In that audit, the preview-latency stress check was a local limitation: the software
  renderer hit a GPU fence timeout. Metal rendered the fixture without a runtime
  error, but the editing phase did not observe background compilation and failed
  that assertion. This is not recorded as a clean full browser-suite run.

## Recursion and Folder Follow-up (2026-10-01)

- Apply to graph now uses the same closed-folder import policy as URLs, samples,
  and local saves, including nested folders. New folders created while editing
  remain open. Closing folders does not rewrite or remove source content.
- Scalar size warnings move from 4,096 to 16,384 estimated expanded tokens.
  The obsolete `x+y` base-case contribution was removed from the estimator.
  Actual low-FPS warnings use completed frames, separately from compilation.
- Oversized shader expressions no longer disappear without an explanation.
  Draw flags expose the reason, unaffected layers render, and export rejects
  incomplete graphs. The per-expression and total shader safety budgets remain.
- The device-specific depth sweep, exact audit AST counts, caveats, and next
  optimization options are in [Recursion Performance](RECURSION_PERFORMANCE.md).
- Local build/model checks, 17 syntax tests, 52 renderer tests, 172 runtime tests,
  TypeScript, and desktop/mobile editor/status browser suites pass. The warning
  suite deliberately delays completed frames to verify the two-second rule and
  clickable blue status without depending on a slow test GPU. The audit records
  82 native-browser depth/resolution cases separately from these regressions.

## Video Export Follow-up (2026-09-29)

- Reproduced Safari 18.6's one-microsecond `VideoFrame` timestamp truncation:
  requested 4,033,333 us became 4,033,332 us. The previous packet lookup rejected
  otherwise valid MP4/WebM exports at common frame rates. Matching actual input
  frame timestamps fixes the join; output retains the original requested timeline.
  This is not a graph complexity, playback-FPS, or intentional export-limit error.
- Native Safari main-thread and module-worker exports pass at 24, 30, 60, 29.97,
  and 12.5 FPS in MP4 and WebM. The worker runs verify all packet counts, first/
  middle/last decoded pixels, and a 10.035-second duration with a partial last frame.
  Native Chrome passes the same format/rate matrix. Local reproduction reports
  are in ignored `output/playwright/video-timestamp/`.
- The exporter still rejects unknown/duplicate output, dropped frames, and input
  timestamp mutations larger than one microsecond. It does not return a partial
  video. Error messages suggest the other format or an updated browser.
- Export errors appear at the bottom of the dialog in red with `role="alert"`,
  scroll into view on small screens, and remain accessible after minimizing.
  A retry clears the error state. The app integration suite covers cancellation,
  retries, snapshot isolation, editor drafts, photo export, and desktop/mobile UI.
- Current local checks: build/model regressions, 17 syntax tests, 52 renderer
  tests, 168 runtime/clock/preview/video tests, and TypeScript checks pass. The
  exporter tests include simulated construction rounding and real native codecs.
  This does not expand the supported-device claims of the baseline audit.

## Corrections

- All row, colour-channel, and grid-settings flags open their current diagnostic
  immediately on click or Enter/Space. Messages remain visible until dismissed,
  fit the viewport, and update with validation. Clicks do not reorder data or
  start the surrounding drag grip. Dedicated browser regression checks cover
  red/yellow/blue/green flags, live channel edits, hover, keyboard dismissal,
  dragging, and mobile positioning.

- Added atan2, hypot, log2/log10, step, smoothstep, and mix/lerp throughout parsing,
  validation, CPU and GLSL evaluation, MathQuill input, and the keyboard. The
  existing pow call is now included in the public function registry as well.
- The new reference page covers supported data types, settings, editing,
  storage, and math functions. Its 60 built-in entries are checked against the
  registry; examples are evaluated on both CPU and GPU. The production build
  embeds the catalogue in HTML so reading it does not depend on JavaScript.
- Keyboard wheel events no longer bubble into graph zoom. A scrollable keyboard
  body keeps the close control visible on desktop and phone-sized viewports.
- Public names are Lepton and Lepton Grapher. Existing repository URLs are
  unchanged. Homepage copy now describes the actual block/text workflow and
  removes the earlier claims of a node graph and artifact-free sampling.

- `mod(value,base)` now has matching floor-modulo behavior in CPU evaluation and
  GLSL. The function registry, arity checks, MathQuill operator list, keyboard,
  and language reference all derive from the same definition.
- Declared references display upright in Standard math fields without changing
  copied Lepton source. Exact names reused across distinct data classes receive
  yellow convention warnings; true same-namespace ambiguity remains red.
- One-letter IDs remain upright without being passed to MathQuill's two-letter
  auto-operator registry, preventing a short ID from aborting later editor mounts.
- Saving renders the current scene directly into the compact preview, avoiding a
  stale or blank thumbnail when the visible canvas has not finished repainting.
- Pressing Enter after editing a Standard-mode data row creates a blank
  expression immediately after that row, inherits its folder membership, focuses
  the new editor, and leaves all existing mixed data in place. Graphs opened from
  URLs, samples, imports, or local saves start with every folder closed; opening
  and closing folders remains UI state, does not alter exported Lepton text, and
  does not mark an otherwise unchanged graph as unsaved.
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
  explicit cleanup, and no grapher/MathQuill dependency. The Lepton compiler remains
  in the browser runtime; this is not a second language implementation.
- MathQuill's existing assets were matched to version 2026.4.21 and pinned with
  hashes, origin, archive integrity, and the MPL license. No editor upgrade was
  slipped into this release.
- The prior Nano ID/PostCSS fixes are retained. A new development-only Vitest
  advisory was resolved by upgrading to patched 4.1.11 and using its typed
  configuration import. Playwright 1.62.1 is pinned for browser regressions;
  neither test package is deployed. npm audit reports zero known vulnerabilities.

## Baseline Verification (2026-09-16)

- **172** runtime/model/grammar checks, **17** syntax unit tests, and **13**
  standalone GPU-driver tests passed.
- All **9** maintained sample files passed current-syntax migration checks.
- All 60 reference examples have independently expected numerical results checked
  on CPU and against rendered GPU pixels. New-function checks include actual typing,
  reload, continued edits/backspace, list use and quadrant-aware angles in degrees.
  The reference and keyboard suite passes in Chromium and WebKit, with a Chromium
  touch-swipe check as well as wheel scrolling at desktop and mobile sizes.
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
- Save/load produced decodable, nonuniform 160 x 100 JPEG previews below the
  24 KB storage ceiling. Export produced a nonblank PNG matching settings.
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
