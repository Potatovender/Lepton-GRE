# Extending Lepton

## Current Extension Points

This section describes existing code. The product roadmap below is a proposal,
not a claim that desktop builds or importable libraries already exist.

| Concern | Owner | Required checks |
| --- | --- | --- |
| Built-in names, argument counts, display aliases, LaTeX commands, MathQuill operator suggestions | `src/math/builtins.js` | Every definition must have working CPU and GLSL forms; the runtime regression suite iterates the registry. |
| Scalar syntax and precedence | `src/math/expression-syntax.js`, live-runtime AST parsing/serialization | Text and LaTeX round trips, left/right associativity, nested calls, malformed input, CPU/GPU agreement. |
| Data model, UI, validation, import/export | `src/browser-preview-live.js` | Ordering, folders, comments, references, history, persistence, diagnostics, both editor modes. |
| Lists, element-wise operations, comprehensions, sums/products | `src/math/collections.js`, runtime AST/host adapter | Local scope, length matching, identities, dynamic bounds, size warnings, list draw order, CPU/GLSL pixel agreement. |
| Data chooser and colour models | Runtime `DATA_TYPE_CATALOG`, `src/math/colour.js` | Quick/More data menus, colour channel diagnostics, shared IDs, CPU/GLSL pixel agreement, save/load and text round trips. |
| GPU resource lifecycle and drawing | `packages/renderer` | Standalone Node tests plus actual GPU pixel/readback tests. No DOM editor or scene dependencies belong in this package. |
| Browser interaction | `src/styles.css`, live-runtime event handlers | `npm run test:browser` against the staged release; test long equations and different panel widths. |
| Public artifact | `scripts/site-files.mjs` | Explicitly include new runtime modules/assets; inspect `release.json` after deployment. |

The function registry eliminates repeated name/arity/display lists. It does not
implement functions automatically: add the CPU evaluator and GLSL implementation
and test the same numeric cases through both. Special syntactic forms such as
fractions and roots also need parser coverage. Do not edit vendored MathQuill to
add a Lepton feature.

### A New Data Type

Use this checklist until data handlers have been extracted into modules:

1. Define its normalized data, defaults, stable UID, and output type.
2. Add its collection to the scene and `DATA_ENTRY_KINDS`; preserve `dataOrder`
   rather than sorting collections when serializing or displaying them.
3. Implement import/export, retaining folder membership, standalone comments,
   inline comments, and intentional blank lines.
4. Add validation, dependency traversal, reference renaming/deletion, and
   red/yellow/blue status propagation to folders and affected draw layers.
5. Add the row editor, creation/type/filter menus, accessible labels, keyboard
   behavior, and any draw integration. Update the tutorial and language reference.
6. Test default/invalid/valid values, mixed nested folders, undo/redo, save/load,
   repeated Text/Standard edits, and unsupported output types.

New render methodologies should consume a typed intermediate representation,
not a second parser of Lepton text. Until that representation is extracted, keep
the existing compiler as the single source of language semantics.

## Recommended Product Direction

**One language and engine, optional libraries, configurable workspaces, and an
optional desktop host.** Do not maintain separate Beginner, Developer, and
Analyst applications with different compilers or file formats.

| Option | Assessment |
| --- | --- |
| Separate downloadable versions | Useful experiences, but implement them as profiles in one application. Forks multiply migration, release, and regression work. |
| Browser-importable libraries | Recommended first. Reusable mathematical modules reduce repeated code without adding controls to every user's interface. |
| Everything in the browser UI | Keep a common engine, but lazy-load advanced panels. More capabilities need not mean more default buttons. Native file/process integration still needs a host. |
| Shared web/desktop application | Recommended long-term. The web remains shareable and approachable; desktop adds local projects, offline jobs, and privileged tools behind explicit permissions. |

Workspace profiles should change panels and shortcuts, not mathematical results:

- **Standard:** current visual rows, samples, guided help, and direct manipulation.
- **Developer:** a full text editor with completion, source diagnostics, find,
  go-to-definition, module files, tests, and a dependency inspector.
- **Analysis:** datasets, tables, plots, units, statistics/fitting, and export.
  Lists/arrays and an explicit numeric/type model should precede these tools.
- **Render:** material tools, animation curves, render passes, profiling, image
  sequences, and queued exports. Shared project data remains editable elsewhere.

An installable web app could add offline access before a desktop release, but it
would still have browser permissions and resource constraints.

## Libraries Versus Plugins

Start with libraries of Lepton functions and data, with no arbitrary JavaScript
execution. Give each library a namespace, exact version, source/license,
dependencies, input/output signatures, and tests. Persist resolved versions in
the project so reopening it cannot silently change its output. Begin with local
file imports; URL imports can follow with explicit approval and a cached copy.

Libraries should later support vectors/lists, reusable materials, noise,
coordinate transforms, and user-authored presets. Imports need predictable
resolution, duplicate/cycle errors, and documented recursion behavior.

Treat privileged plugins separately. A plugin that accesses files, launches a
process, or uses a native library needs declared permissions and an isolated
process/API. Opening someone else's scene must never grant those permissions.
Keep unknown plugin data intact and report unsupported capabilities, rather than
silently dropping it when a project moves between hosts.

## Desktop Host Choice

My first prototype would use **Electron** to reuse the editor with a consistent
Chromium runtime. Electron bundles Chromium and Node.js, which increases its
distribution/update footprint but avoids depending on different system webviews.
[Electron documentation](https://www.electronjs.org/docs/latest/).

Keep renderer processes sandboxed, Node integration disabled, and expose narrow
validated IPC operations for native work. Put heavy jobs in workers or isolated
processes, not in the editor's event loop.
[Electron sandbox model](https://www.electronjs.org/docs/latest/tutorial/sandbox).

**Tauri** is a reasonable alternative if small distribution size and a Rust
native core become priorities. It uses the operating system's webview, so we
would retain cross-webview editor testing. Choose after comparing the actual
Lepton editor and one native export workload, not a generic framework demo.
[Tauri architecture](https://v2.tauri.app/concept/architecture/),
[webview versions](https://v2.tauri.app/reference/webview-versions/).

A desktop wrapper alone will not make the existing fragment shader faster.
Native advantage requires concrete capabilities such as persistent local
projects, background rendering, large-file streaming, native numerical
libraries, hardware-specific compute, or video encoding.

Browser GPU compute is also an option through WebGPU, using WGSL and a separate
backend. Feature detection and capability reporting are required; existing GLSL
code cannot simply be renamed to WGSL.
[WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).

## Implementation Order

1. **Core contract.** Incrementally extract scene normalization, parsing, typed
   AST, diagnostics, and evaluation from the live runtime into a DOM-free
   TypeScript package. Keep the GPU driver separate. Reuse current tests at each
   extraction; do not replace the complete parser and editor simultaneously.
2. **Versioned project and modules.** Preserve source/comments alongside semantic
   data, with migration tests and resolved library versions. Ship one useful
   library and verify identical results in Standard, Text, and headless tests.
3. **Developer workspace.** Add the richer text/dependency workflow as an optional
   profile. Long-running compilation should expose progress and cancellation;
   stale results must not overwrite newer edits.
4. **Desktop vertical slice.** Open a project folder, edit with the same core,
   render a deterministic image sequence in a background job, cancel/resume it,
   and reopen the project on the web without losing compatible data.
5. **Rendering/analysis extensions.** Add typed lists, complex numbers or wider
   vectors as needed, then render graphs, cached intermediate textures, compute
   kernels, analysis tools, and controlled plugin APIs. Prioritize from real
   workloads, measuring both CPU and GPU time.

Keep these packages in the current repository initially. Independent repositories
would make atomic grammar/compiler/editor changes harder before the contracts
stabilize. A separate engine release becomes useful once there are at least two
real consumers with compatibility tests. Select an explicit project license
before distributing the engine for third-party reuse.

## Acceptance Criteria

- A project produces matching results across profiles and supported backends,
  with explicit precision and unsupported-feature diagnostics.
- Adding a scalar function requires one metadata definition and tested backend
  implementations; editor names and arity must not drift independently.
- New data types are isolated handlers once extracted, not copies of scene
  normalization or language parsers.
- Slow calculations can be cancelled without corrupting saved work or blocking
  typing. Repeated immutable expressions can be shared/cached with coordinate
  and local-parameter scope included in cache keys.
- Modules and privileged plugins have different trust boundaries. Merely opening
  a scene cannot execute unrestricted native code.
- Beginner workflows remain compact, and libraries/profiles can be disabled
  without destroying their stored project data.
