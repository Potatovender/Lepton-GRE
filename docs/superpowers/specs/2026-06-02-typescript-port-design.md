# TypeScript Port Design

## Goal

Port the current Python/Pygame function grid plotter into a browser-based TypeScript app and publish it to `Potatovender/Lepton-GRE`.

## Scope

The first TypeScript version preserves the current behavior:

- expression parsing and evaluation, including `~eq~` custom variables
- function, color, restriction, and draw registries
- import/export text format
- settings for axis ranges, grid point counts, recursion depth, angle mode, and screen/render sizing
- CPU canvas rendering for now, with renderer code isolated for a future GLSL/WebGL renderer

The port removes Python-only and course tooling:

- no PythonTA
- no doctest harnesses
- no Pygame UI classes
- no generated Python bytecode or IDE metadata

## User Interface

The app is a full-screen browser workbench inspired by Desmos:

- the left side is a fixed-width expression panel
- expression entries are full-width row boxes with math-looking text for now
- real LaTeX visualization is not required in this phase, but the entry model should leave room for it later
- tabs or segmented controls switch between Functions, Colors, Restrictions, Draw, and Settings/Import
- the right side is entirely occupied by the grid renderer
- status and render controls can overlay the renderer without shrinking it

## Architecture

Use Vite + TypeScript for a small browser app without a heavy UI framework. Keep backend math logic in focused TypeScript modules and keep DOM/controller code separate from rendering code.

Core modules:

- `src/math/equation.ts`: tokenizer, AST node, parser, evaluator, AST-to-string
- `src/model/color.ts`: RGB equation mapping and clamping
- `src/model/boundary.ts`: restriction equation wrapper
- `src/model/scene.ts`: registries, settings, validation, import/export, draw mapping
- `src/render/canvasRenderer.ts`: CPU canvas grid renderer
- `src/ui/app.ts`: DOM state, expression rows, settings controls, event binding
- `src/styles.css`: full-screen Desmos-style layout

## Testing

Use Vitest for math/model tests. Test the expression engine first, then scene import/export, then renderer helpers. Browser UI is verified with a local dev server and screenshots after implementation.

## Open Decisions

No further design choices are blocked. The first implementation should prioritize faithful behavior and a clean TypeScript structure over advanced visual polish. Real LaTeX rendering and GLSL are future phases.
