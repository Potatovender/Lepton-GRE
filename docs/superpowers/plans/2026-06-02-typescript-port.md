# TypeScript Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python/Pygame function grid plotter with a full-screen TypeScript browser app and push it to `Potatovender/Lepton-GRE`.

**Architecture:** Build a Vite + TypeScript app with a Desmos-style expression panel on the left and a canvas renderer filling the right side. Keep expression parsing/evaluation, registries, import/export, settings, and CPU canvas rendering in focused modules so the renderer can later move to GLSL/WebGL without rewriting the UI or math model.

**Tech Stack:** TypeScript, Vite, Vitest, HTML, CSS, Canvas 2D.

---

## File Structure

- Create `package.json`: scripts and dev dependencies.
- Create `tsconfig.json`: strict TypeScript app configuration.
- Create `vite.config.ts`: Vite + Vitest configuration.
- Create `index.html`: app mount point.
- Create `src/main.ts`: bootstraps the app.
- Create `src/styles.css`: full-screen Desmos-style layout.
- Create `src/math/equation.ts`: tokenization, AST construction, evaluation, AST display strings.
- Create `src/model/color.ts`: RGB equation wrapper and clamping.
- Create `src/model/boundary.ts`: restriction equation wrapper.
- Create `src/model/scene.ts`: functions/colors/restrictions/draw registries, settings, import/export, validation.
- Create `src/render/canvasRenderer.ts`: CPU grid renderer for `<canvas>`.
- Create `src/ui/app.ts`: DOM rendering, expression rows, settings controls, import/export, render triggers.
- Create `src/types.ts`: shared app types.
- Create `tests/equation.test.ts`: expression engine behavior.
- Create `tests/scene.test.ts`: import/export and registry behavior.
- Create `tests/color-boundary.test.ts`: color clamping and restriction checks.
- Create `tests/canvasRenderer.test.ts`: coordinate grid and render helper behavior.
- Delete `Entryfield.py`, `boundary.py`, `color.py`, `equation.py`, `main.py`, `requirements.txt`, `discussion_file`, `project_report.tex`, and `project_report.pdf` after the TypeScript replacement passes checks.

## Task 1: Scaffold Vite TypeScript Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `src/types.ts`

- [ ] **Step 1: Create project metadata and scripts**

Write `package.json`:

```json
{
  "name": "lepton-gre",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vite config**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

Write `vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "node",
    globals: true
  }
});
```

- [ ] **Step 3: Create app entry files**

Write `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lepton-GRE</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Write `src/types.ts`:

```ts
export type AngleMode = "radians" | "degrees";

export type NumericResult = number | "nan" | "invalid";

export interface GridSettings {
  xMin: number;
  xMax: number;
  xPoints: number;
  yMin: number;
  yMax: number;
  yPoints: number;
  maxRecursion: number;
  angleMode: AngleMode;
}

export interface RegistryEntry {
  id: string;
  expression: string;
}

export interface DrawEntry {
  equationId: string;
  colorId: string;
  restrictionId: string;
}

export interface RenderStatus {
  message: string;
  level: "idle" | "success" | "warning" | "error";
}
```

Write `src/main.ts`:

```ts
import "./styles.css";
import { createApp } from "./ui/app";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element");
}

createApp(root);
```

Write `src/styles.css` with this initial shell:

```css
* {
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f8fafc;
  color: #182033;
}

button,
input,
textarea,
select {
  font: inherit;
}

.app-shell {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-columns: minmax(320px, 380px) 1fr;
  overflow: hidden;
}

.expression-panel {
  background: #ffffff;
  border-right: 1px solid #d7dce5;
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
}

.panel-header,
.panel-footer {
  padding: 12px;
  border-bottom: 1px solid #eceff4;
}

.panel-footer {
  border-top: 1px solid #eceff4;
  border-bottom: 0;
}

.tab-row {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid #eceff4;
}

.tab-button,
.toolbar-button {
  border: 0;
  border-radius: 5px;
  padding: 8px 10px;
  background: #eef1f5;
  color: #4c5668;
  cursor: pointer;
}

.tab-button[aria-selected="true"],
.toolbar-button.primary {
  background: #182033;
  color: #ffffff;
}

.entry-list {
  overflow: auto;
}

.expression-row {
  min-height: 76px;
  display: grid;
  grid-template-columns: 34px 1fr 34px;
  gap: 10px;
  align-items: start;
  padding: 12px 10px;
  border-bottom: 1px solid #eceff4;
}

.entry-status {
  width: 12px;
  height: 12px;
  margin-top: 13px;
  border-radius: 999px;
  background: #9aa3b2;
  box-shadow: 0 0 0 3px #edf0f4;
}

.entry-status.valid {
  background: #3a9f63;
  box-shadow: 0 0 0 3px #dcefe4;
}

.entry-status.invalid {
  background: #c9473f;
  box-shadow: 0 0 0 3px #f5d9d7;
}

.math-box {
  width: 100%;
  min-height: 46px;
  resize: vertical;
  border: 1px solid #cfd5df;
  border-radius: 6px;
  padding: 10px 12px;
  background: #ffffff;
  color: #202938;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 17px;
  line-height: 1.25;
}

.renderer-pane {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #f8fafc;
}

.grid-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.render-overlay {
  position: absolute;
  left: 14px;
  bottom: 12px;
  padding: 7px 9px;
  border: 1px solid #cfd5df;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.94);
  color: #4d5768;
  font-size: 12px;
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and dependencies install. If network access is blocked, rerun with approval.

- [ ] **Step 5: Verify scaffold**

Run: `npm run build`

Expected: TypeScript compiles and Vite produces `dist/`.

- [ ] **Step 6: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts src/styles.css src/types.ts
git commit -m "Scaffold TypeScript browser app"
```

## Task 2: Port Expression Engine With Tests

**Files:**
- Create: `src/math/equation.ts`
- Create: `tests/equation.test.ts`

- [ ] **Step 1: Write failing expression tests**

Write `tests/equation.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { Equation } from "../src/math/equation";

describe("Equation", () => {
  test("evaluates arithmetic, implicit multiplication, constants, and variables", () => {
    expect(new Equation("2x + y + pi").evaluate(3, 4)).toBeCloseTo(6 + 4 + Math.PI);
  });

  test("evaluates trig in radians and degrees", () => {
    expect(new Equation("sin(pi/2)").evaluate(0, 0, "radians")).toBeCloseTo(1);
    expect(new Equation("sin(90)").evaluate(0, 0, "degrees")).toBeCloseTo(1);
  });

  test("supports custom variable references like ~eq~", () => {
    const env = { eq: new Equation("x*y") };
    expect(new Equation("~eq~ + 2").evaluate(3, 5, "radians", env)).toBeCloseTo(17);
  });

  test("returns nan for division by zero and unknown custom variables", () => {
    expect(new Equation("1/0").evaluate(0, 0)).toBe("nan");
    expect(new Equation("~missing~").evaluate(0, 0)).toBe("nan");
  });

  test("round-trips a parsed tree into a readable expression string", () => {
    expect(new Equation("2(x+y)").astToString()).toBe("(2*(x+y))");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/equation.test.ts`

Expected: FAIL because `src/math/equation.ts` does not exist.

- [ ] **Step 3: Implement the TypeScript expression engine**

Write `src/math/equation.ts` as a direct TypeScript translation of `equation.py` with these public APIs:

```ts
import type { AngleMode, NumericResult } from "../types";

export type EquationEnvironment = Record<string, Equation>;

type Operator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "^"
  | "%"
  | "exp"
  | "frac"
  | "sin"
  | "cos"
  | "tan"
  | "sec"
  | "csc"
  | "cot"
  | "arcsin"
  | "arccos"
  | "arctan"
  | "arcsec"
  | "arccsc"
  | "arccot"
  | "sinh"
  | "cosh"
  | "tanh"
  | "sech"
  | "csch"
  | "coth"
  | "arcsinh"
  | "arccosh"
  | "arctanh"
  | "arcsech"
  | "arccsch"
  | "arccoth"
  | "log"
  | "ln"
  | "sqrt"
  | "cbrt"
  | "abs"
  | "sign"
  | "floor"
  | "ceil"
  | "round"
  | "min"
  | "max"
  | "clamp"
  | "pi"
  | "e";

const PRECEDENCE: Record<Operator, [number, number]> = {
  "+": [1, 2],
  "-": [1, 2],
  "*": [2, 2],
  "/": [2, 2],
  "^": [3, 2],
  "%": [2, 2],
  exp: [4, 1],
  frac: [2, 2],
  sin: [4, 1],
  cos: [4, 1],
  tan: [4, 1],
  sec: [4, 1],
  csc: [4, 1],
  cot: [4, 1],
  arcsin: [4, 1],
  arccos: [4, 1],
  arctan: [4, 1],
  arcsec: [4, 1],
  arccsc: [4, 1],
  arccot: [4, 1],
  sinh: [4, 1],
  cosh: [4, 1],
  tanh: [4, 1],
  sech: [4, 1],
  csch: [4, 1],
  coth: [4, 1],
  arcsinh: [4, 1],
  arccosh: [4, 1],
  arctanh: [4, 1],
  arcsech: [4, 1],
  arccsch: [4, 1],
  arccoth: [4, 1],
  log: [4, 2],
  ln: [4, 1],
  sqrt: [4, 1],
  cbrt: [4, 1],
  abs: [4, 1],
  sign: [4, 1],
  floor: [4, 1],
  ceil: [4, 1],
  round: [4, 1],
  min: [4, 2],
  max: [4, 2],
  clamp: [4, 3],
  pi: [5, 0],
  e: [5, 0]
};

const REPLACEABLE: Record<string, Operator> = {
  cdot: "*",
  times: "*"
};

const isOperator = (token: string): token is Operator => token in PRECEDENCE;
const isNumberToken = (token: string) => /^(\d+\.?\d*|\.\d+)$/.test(token);
const isCustomVariable = (token: string) => token.startsWith("~") && token.endsWith("~");

export class Equation {
  private readonly tree: Node;

  constructor(source: string) {
    const parsed = buildTree(tokenize(source));
    this.tree = parsed ?? new Node("invalid");
  }

  evaluate(
    x: number,
    y: number,
    angleMode: AngleMode = "radians",
    env: EquationEnvironment = {},
    depth = 50
  ): NumericResult {
    if (depth < 0) {
      return Math.sqrt(x * x + y * y);
    }

    const result = this.tree.evaluate(x, y, angleMode === "radians", env, depth);
    return Number.isFinite(result as number) ? result : result === "invalid" ? "invalid" : "nan";
  }

  size(env: EquationEnvironment = {}, depth = 50): number {
    return this.tree.size(env, depth);
  }

  astToString(): string {
    return this.tree.astToString();
  }
}
```

In the same file, add the missing private functions and class from the Python source: `tokenize(source: string): string[]`, `buildTree(tokens: string[]): Node | null`, and `class Node`. These must be direct translations of the existing Python `tokenize`, shunting-yard parser, `Node.size`, `Node.ast_to_string`, and `Node.evaluate` methods. Preserve the Python grammar and function names. Fix the Python hyperbolic guard typos during translation by checking `vals[0]` instead of the outer `x` coordinate for `arccosh`, `arcsech`, `arctanh`, and `arccoth`.

- [ ] **Step 4: Run equation tests to verify GREEN**

Run: `npm test -- tests/equation.test.ts`

Expected: PASS for all five tests.

- [ ] **Step 5: Commit expression engine**

```bash
git add src/math/equation.ts tests/equation.test.ts
git commit -m "Port expression engine to TypeScript"
```

## Task 3: Port Color, Boundary, and Scene Model

**Files:**
- Create: `src/model/color.ts`
- Create: `src/model/boundary.ts`
- Create: `src/model/scene.ts`
- Create: `tests/color-boundary.test.ts`
- Create: `tests/scene.test.ts`

- [ ] **Step 1: Write failing model tests**

Write `tests/color-boundary.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { Boundary } from "../src/model/boundary";
import { ColorMapping } from "../src/model/color";
import { Equation } from "../src/math/equation";

describe("ColorMapping", () => {
  test("clamps RGB equation results into 8-bit channel values", () => {
    const color = new ColorMapping(new Equation("-10"), new Equation("128.8"), new Equation("999"));
    expect(color.getColorTuple(0)).toEqual([0, 128, 255]);
  });
});

describe("Boundary", () => {
  test("checks positive and negative restriction directions", () => {
    expect(new Boundary(new Equation("x-1"), false).inBounds(2, 0)).toBe(true);
    expect(new Boundary(new Equation("x-1"), true).inBounds(0, 0)).toBe(true);
  });
});
```

Write `tests/scene.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { createDefaultScene, exportScene, importScene } from "../src/model/scene";

const sample = `F:eq~x+y
~~~~~
C:rgb~255~0~128
~~~~~
R:rest~x^2+y^2-4~0
~~~~~
D~eq~rgb~rest
~~~~~
S:x_min~-2
S:x_points~20
S:x_max~2
S:y_min~-3
S:y_points~30
S:y_max~3
S:max_recursion~12
S:angle_mode~degrees`;

describe("scene import/export", () => {
  test("imports functions, colors, restrictions, draw rows, and settings", () => {
    const scene = importScene(sample);
    expect(scene.functions).toEqual([{ id: "eq", expression: "x+y" }]);
    expect(scene.colors).toEqual([{ id: "rgb", red: "255", green: "0", blue: "128" }]);
    expect(scene.restrictions).toEqual([{ id: "rest", expression: "x^2+y^2-4", checkSmaller: false }]);
    expect(scene.draws).toEqual([{ equationId: "eq", colorId: "rgb", restrictionId: "rest" }]);
    expect(scene.settings.angleMode).toBe("degrees");
    expect(scene.settings.maxRecursion).toBe(12);
  });

  test("exports a scene using the legacy text sections", () => {
    const scene = importScene(sample);
    expect(exportScene(scene)).toContain("F:eq~x+y");
    expect(exportScene(scene)).toContain("D~eq~rgb~rest");
    expect(exportScene(scene)).toContain("S:angle_mode~degrees");
  });

  test("creates a default scene with one drawable equation", () => {
    const scene = createDefaultScene();
    expect(scene.functions[0].id).toBe("eq");
    expect(scene.colors[0].id).toBe("rgb");
    expect(scene.draws.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run model tests to verify RED**

Run: `npm test -- tests/color-boundary.test.ts tests/scene.test.ts`

Expected: FAIL because model files do not exist.

- [ ] **Step 3: Implement color and boundary modules**

Write `src/model/color.ts`:

```ts
import { Equation, type EquationEnvironment } from "../math/equation";
import type { AngleMode } from "../types";

export type RgbTuple = [number, number, number];

const clampChannel = (value: number): number => Math.max(0, Math.min(255, Math.trunc(value)));

export class ColorMapping {
  constructor(
    private readonly red: Equation = new Equation("x"),
    private readonly green: Equation = new Equation("x"),
    private readonly blue: Equation = new Equation("x")
  ) {}

  getColorTuple(
    zValue: number,
    angleMode: AngleMode = "radians",
    env: EquationEnvironment = {},
    depth = 0
  ): RgbTuple | [-1, -1, -1] {
    const values = [
      this.red.evaluate(zValue, 0, angleMode, env, depth),
      this.green.evaluate(zValue, 0, angleMode, env, depth),
      this.blue.evaluate(zValue, 0, angleMode, env, depth)
    ];

    if (values.some((value) => value === "invalid" || value === "nan")) {
      return [-1, -1, -1];
    }

    return values.map((value) => clampChannel(value as number)) as RgbTuple;
  }
}
```

Write `src/model/boundary.ts`:

```ts
import { Equation, type EquationEnvironment } from "../math/equation";
import type { AngleMode } from "../types";

export class Boundary {
  constructor(
    private readonly equation: Equation = new Equation("1"),
    private readonly checkSmaller = false
  ) {}

  inBounds(
    x: number,
    y: number,
    angleMode: AngleMode = "radians",
    env: EquationEnvironment = {},
    depth = 0
  ): boolean {
    const value = this.equation.evaluate(x, y, angleMode, env, depth);

    if (value === "invalid" || value === "nan") {
      return false;
    }

    return this.checkSmaller ? value <= 0 : value >= 0;
  }
}
```

- [ ] **Step 4: Implement scene module**

Write `src/model/scene.ts` with these exported shapes:

```ts
import { Equation, type EquationEnvironment } from "../math/equation";
import type { AngleMode, DrawEntry, GridSettings, RegistryEntry } from "../types";

export interface ColorEntry {
  id: string;
  red: string;
  green: string;
  blue: string;
}

export interface RestrictionEntry {
  id: string;
  expression: string;
  checkSmaller: boolean;
}

export interface SceneState {
  functions: RegistryEntry[];
  colors: ColorEntry[];
  restrictions: RestrictionEntry[];
  draws: DrawEntry[];
  settings: GridSettings;
}

export const defaultSettings = (): GridSettings => ({
  xMin: -15,
  xMax: 15,
  xPoints: 100,
  yMin: -15,
  yMax: 15,
  yPoints: 100,
  maxRecursion: 100,
  angleMode: "radians"
});

export const createDefaultScene = (): SceneState => ({
  functions: [{ id: "eq", expression: "sin(x)+cos(y)" }],
  colors: [{ id: "rgb", red: "128+127*sin(x)", green: "128+127*cos(x)", blue: "180" }],
  restrictions: [{ id: "rest", expression: "1", checkSmaller: false }],
  draws: [{ equationId: "eq", colorId: "rgb", restrictionId: "rest" }],
  settings: defaultSettings()
});

export const buildEquationEnvironment = (scene: SceneState): EquationEnvironment =>
  Object.fromEntries(scene.functions.filter((entry) => entry.id).map((entry) => [entry.id, new Equation(entry.expression)]));

export const sanitizeInput = (text: string): string => text.replace(/\r\n/g, "\n").trim();

export function importScene(rawText: string): SceneState {
  const scene = createDefaultScene();
  scene.functions = [];
  scene.colors = [];
  scene.restrictions = [];
  scene.draws = [];
  scene.settings = defaultSettings();

  for (const line of sanitizeInput(rawText).split("\n")) {
    if (!line || line === "~~~~~") continue;

    if (line.startsWith("F:")) {
      const [id, expression] = splitFirst(line.slice(2), "~");
      scene.functions.push({ id, expression });
      continue;
    }

    if (line.startsWith("C:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [red, green, blue] = rest.split("~");
      scene.colors.push({ id, red: red ?? "0", green: green ?? "0", blue: blue ?? "0" });
      continue;
    }

    if (line.startsWith("R:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [expression, flag] = rest.split("~");
      scene.restrictions.push({ id, expression: expression ?? "1", checkSmaller: flag === "1" });
      continue;
    }

    if (line.startsWith("D~")) {
      const [, equationId, colorId, restrictionId] = line.split("~");
      scene.draws.push({ equationId, colorId, restrictionId });
      continue;
    }

    if (line.startsWith("S:")) {
      applySetting(scene.settings, line.slice(2));
    }
  }

  return scene;
}

export function exportScene(scene: SceneState): string {
  return [
    ...scene.functions.map((entry) => `F:${entry.id}~${entry.expression}`),
    "~~~~~",
    ...scene.colors.map((entry) => `C:${entry.id}~${entry.red}~${entry.green}~${entry.blue}`),
    "~~~~~",
    ...scene.restrictions.map((entry) => `R:${entry.id}~${entry.expression}~${entry.checkSmaller ? 1 : 0}`),
    "~~~~~",
    ...scene.draws.map((entry) => `D~${entry.equationId}~${entry.colorId}~${entry.restrictionId}`),
    "~~~~~",
    `S:x_min~${scene.settings.xMin}`,
    `S:x_points~${scene.settings.xPoints}`,
    `S:x_max~${scene.settings.xMax}`,
    `S:y_min~${scene.settings.yMin}`,
    `S:y_points~${scene.settings.yPoints}`,
    `S:y_max~${scene.settings.yMax}`,
    `S:max_recursion~${scene.settings.maxRecursion}`,
    `S:angle_mode~${scene.settings.angleMode}`
  ].join("\n");
}

function splitFirst(text: string, delimiter: string): [string, string] {
  const index = text.indexOf(delimiter);
  return index === -1 ? [text, ""] : [text.slice(0, index), text.slice(index + delimiter.length)];
}

function applySetting(settings: GridSettings, raw: string): void {
  const [key, value] = splitFirst(raw, "~");
  const numberValue = Number(value);

  if (key === "angle_mode" && (value === "radians" || value === "degrees")) {
    settings.angleMode = value as AngleMode;
    return;
  }

  if (!Number.isFinite(numberValue)) return;

  const map: Record<string, keyof GridSettings> = {
    x_min: "xMin",
    x_points: "xPoints",
    x_max: "xMax",
    y_min: "yMin",
    y_points: "yPoints",
    y_max: "yMax",
    max_recursion: "maxRecursion"
  };

  const mapped = map[key];
  if (mapped) {
    (settings[mapped] as number) = numberValue;
  }
}
```

- [ ] **Step 5: Run model tests to verify GREEN**

Run: `npm test -- tests/color-boundary.test.ts tests/scene.test.ts`

Expected: PASS for all model tests.

- [ ] **Step 6: Commit model modules**

```bash
git add src/model/color.ts src/model/boundary.ts src/model/scene.ts tests/color-boundary.test.ts tests/scene.test.ts
git commit -m "Port scene model to TypeScript"
```

## Task 4: Add Canvas Renderer

**Files:**
- Create: `src/render/canvasRenderer.ts`
- Create: `tests/canvasRenderer.test.ts`

- [ ] **Step 1: Write failing renderer helper tests**

Write `tests/canvasRenderer.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildAxisPoints, getDrawBounds } from "../src/render/canvasRenderer";

describe("canvas renderer helpers", () => {
  test("builds evenly spaced axis points including endpoints", () => {
    expect(buildAxisPoints(-1, 1, 3)).toEqual([-1, 0, 1]);
  });

  test("keeps draw bounds matched to graph aspect ratio", () => {
    expect(getDrawBounds(1000, 800, 30, 30)).toEqual({ x: 100, y: 0, width: 800, height: 800 });
    expect(getDrawBounds(1000, 800, 30, 15)).toEqual({ x: 0, y: 150, width: 1000, height: 500 });
  });
});
```

- [ ] **Step 2: Run renderer tests to verify RED**

Run: `npm test -- tests/canvasRenderer.test.ts`

Expected: FAIL because `src/render/canvasRenderer.ts` does not exist.

- [ ] **Step 3: Implement renderer helpers and CPU render path**

Write `src/render/canvasRenderer.ts`:

```ts
import { Boundary } from "../model/boundary";
import { ColorMapping } from "../model/color";
import { buildEquationEnvironment, type SceneState } from "../model/scene";
import { Equation } from "../math/equation";

export interface DrawBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const buildAxisPoints = (min: number, max: number, count: number): number[] => {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
};

export const getDrawBounds = (canvasWidth: number, canvasHeight: number, xRange: number, yRange: number): DrawBounds => {
  const graphRatio = xRange / yRange;
  const canvasRatio = canvasWidth / canvasHeight;

  if (canvasRatio > graphRatio) {
    const width = Math.round(canvasHeight * graphRatio);
    return { x: Math.round((canvasWidth - width) / 2), y: 0, width, height: canvasHeight };
  }

  const height = Math.round(canvasWidth / graphRatio);
  return { x: 0, y: Math.round((canvasHeight - height) / 2), width: canvasWidth, height };
};

export function renderScene(canvas: HTMLCanvasElement, scene: SceneState): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = rect.width;
  const height = rect.height;
  context.clearRect(0, 0, width, height);
  drawGrid(context, width, height);

  const env = buildEquationEnvironment(scene);
  const xPoints = buildAxisPoints(scene.settings.xMin, scene.settings.xMax, scene.settings.xPoints);
  const yPoints = buildAxisPoints(scene.settings.yMin, scene.settings.yMax, scene.settings.yPoints);
  const bounds = getDrawBounds(
    width,
    height,
    scene.settings.xMax - scene.settings.xMin,
    scene.settings.yMax - scene.settings.yMin
  );
  const pixelWidth = bounds.width / Math.max(1, xPoints.length - 1);
  const pixelHeight = bounds.height / Math.max(1, yPoints.length - 1);

  for (const draw of scene.draws) {
    const functionEntry = scene.functions.find((entry) => entry.id === draw.equationId);
    const colorEntry = scene.colors.find((entry) => entry.id === draw.colorId);
    const restrictionEntry = scene.restrictions.find((entry) => entry.id === draw.restrictionId);
    if (!functionEntry || !colorEntry || !restrictionEntry) continue;

    const equation = new Equation(functionEntry.expression);
    const color = new ColorMapping(new Equation(colorEntry.red), new Equation(colorEntry.green), new Equation(colorEntry.blue));
    const boundary = new Boundary(new Equation(restrictionEntry.expression), restrictionEntry.checkSmaller);

    yPoints.forEach((yValue, yIndex) => {
      xPoints.forEach((xValue, xIndex) => {
        if (!boundary.inBounds(xValue, yValue, scene.settings.angleMode, env, scene.settings.maxRecursion)) return;
        const zValue = equation.evaluate(xValue, yValue, scene.settings.angleMode, env, scene.settings.maxRecursion);
        if (zValue === "invalid" || zValue === "nan") return;
        const rgb = color.getColorTuple(zValue, scene.settings.angleMode, env, scene.settings.maxRecursion);
        if (rgb[0] < 0) return;
        context.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        context.fillRect(bounds.x + xIndex * pixelWidth, bounds.y + (yPoints.length - 1 - yIndex) * pixelHeight, Math.ceil(pixelWidth), Math.ceil(pixelHeight));
      });
    });
  }
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#e1e5ec";
  context.lineWidth = 1;

  for (let x = 0; x <= width; x += 28) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y <= height; y += 28) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}
```

- [ ] **Step 4: Run renderer tests to verify GREEN**

Run: `npm test -- tests/canvasRenderer.test.ts`

Expected: PASS for renderer helper tests.

- [ ] **Step 5: Commit renderer**

```bash
git add src/render/canvasRenderer.ts tests/canvasRenderer.test.ts
git commit -m "Add canvas grid renderer"
```

## Task 5: Build Desmos-Style UI

**Files:**
- Create: `src/ui/app.ts`
- Modify: `src/styles.css`
- Modify: `src/main.ts`

- [ ] **Step 1: Implement DOM app controller**

Write `src/ui/app.ts`:

```ts
import { exportScene, importScene, createDefaultScene, type SceneState } from "../model/scene";
import { renderScene } from "../render/canvasRenderer";

type ActiveTab = "functions" | "colors" | "restrictions" | "draws" | "settings";

const tabs: Array<[ActiveTab, string]> = [
  ["functions", "Functions"],
  ["colors", "Colors"],
  ["restrictions", "Bounds"],
  ["draws", "Draw"],
  ["settings", "Settings"]
];

export function createApp(root: HTMLDivElement): void {
  let scene = createDefaultScene();
  let activeTab: ActiveTab = "functions";

  const render = () => {
    root.innerHTML = `
      <main class="app-shell">
        <section class="expression-panel" aria-label="Expression editor">
          <header class="panel-header">
            <div class="brand-row">
              <strong>Lepton-GRE</strong>
              <button class="toolbar-button primary" data-action="render">Render</button>
            </div>
          </header>
          <nav class="tab-row" aria-label="Editor sections">
            ${tabs.map(([id, label]) => `<button class="tab-button" data-tab="${id}" aria-selected="${id === activeTab}">${label}</button>`).join("")}
          </nav>
          <div class="entry-list">${renderActivePanel(scene, activeTab)}</div>
          <footer class="panel-footer">
            <button class="toolbar-button" data-action="import">Import</button>
            <button class="toolbar-button" data-action="export">Export</button>
          </footer>
        </section>
        <section class="renderer-pane" aria-label="Grid renderer">
          <canvas class="grid-canvas"></canvas>
          <div class="render-overlay">${scene.settings.xPoints} x ${scene.settings.yPoints} · ${scene.settings.angleMode} · depth ${scene.settings.maxRecursion}</div>
        </section>
      </main>
    `;

    bindEvents();
    const canvas = root.querySelector<HTMLCanvasElement>(".grid-canvas");
    if (canvas) renderScene(canvas, scene);
  };

  const bindEvents = () => {
    root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        activeTab = button.dataset.tab as ActiveTab;
        render();
      });
    });

    root.querySelector<HTMLButtonElement>('[data-action="render"]')?.addEventListener("click", render);
    root.querySelector<HTMLButtonElement>('[data-action="export"]')?.addEventListener("click", () => {
      window.prompt("Copy exported scene", exportScene(scene));
    });
    root.querySelector<HTMLButtonElement>('[data-action="import"]')?.addEventListener("click", () => {
      const raw = window.prompt("Paste exported scene");
      if (raw) {
        scene = importScene(raw);
        render();
      }
    });

    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-field]").forEach((field) => {
      field.addEventListener("change", () => {
        scene = updateSceneFromField(scene, field);
        render();
      });
    });
  };

  window.addEventListener("resize", render);
  render();
}
```

In the same file, implement `renderActivePanel` and `updateSceneFromField` with explicit branches for each tab. Expression rows must render as full `.expression-row` boxes with `.math-box` textareas. The field names must use stable `data-field` values like `functions.0.expression`, `colors.0.red`, `settings.xPoints`, and `draws.0.colorId`.

- [ ] **Step 2: Extend CSS for full-screen Desmos layout**

Update `src/styles.css` to include:

```css
.brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.math-box:focus {
  outline: 2px solid #4f7dd9;
  outline-offset: 1px;
}

.compact-field {
  width: 100%;
  border: 1px solid #cfd5df;
  border-radius: 5px;
  padding: 8px 9px;
  background: #ffffff;
}

.settings-grid {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.settings-row {
  display: grid;
  gap: 6px;
}

.settings-row label {
  font-size: 12px;
  color: #596273;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: TypeScript compiles and Vite builds the app.

- [ ] **Step 4: Run app locally**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL. If binding or network is blocked, rerun with approval.

- [ ] **Step 5: Browser QA**

Open the local URL. Verify:

- app fills the whole browser viewport
- left panel uses full expression boxes
- right renderer covers all remaining screen space
- Render button redraws the canvas
- Import/Export preserves the legacy text format
- changing a function expression updates the rendered result

- [ ] **Step 6: Commit UI**

```bash
git add src/ui/app.ts src/styles.css src/main.ts
git commit -m "Build Desmos-style browser UI"
```

## Task 6: Remove Legacy Python Artifacts

**Files:**
- Delete: `Entryfield.py`
- Delete: `boundary.py`
- Delete: `color.py`
- Delete: `equation.py`
- Delete: `main.py`
- Delete: `requirements.txt`
- Delete: `discussion_file`
- Delete: `project_report.tex`
- Delete: `project_report.pdf`
- Modify: `.gitignore`

- [ ] **Step 1: Delete legacy files**

Run:

```bash
git rm Entryfield.py boundary.py color.py equation.py main.py requirements.txt discussion_file project_report.tex project_report.pdf
```

Expected: only legacy Python/report files are removed from Git.

- [ ] **Step 2: Confirm `.gitignore` covers local artifacts**

Ensure `.gitignore` contains:

```gitignore
__pycache__/
*.py[cod]
*.pyo
.venv/
venv/
env/
.DS_Store
.idea/
.superpowers/
node_modules/
dist/
```

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: all Vitest tests pass.

Run: `npm run build`

Expected: TypeScript and Vite build pass.

- [ ] **Step 4: Commit cleanup**

```bash
git add .gitignore
git commit -m "Remove legacy Python implementation"
```

## Task 7: Publish to GitHub Repository

**Files:**
- Modify local Git remote configuration only.

- [ ] **Step 1: Add target remote**

Run:

```bash
git remote add origin https://github.com/Potatovender/Lepton-GRE.git
```

Expected: `git remote -v` shows `origin` fetch and push URLs for `Potatovender/Lepton-GRE`.

- [ ] **Step 2: Push main**

Run:

```bash
git push -u origin main
```

Expected: branch `main` pushes to the empty GitHub repository. If network access is blocked, rerun with approval.

- [ ] **Step 3: Confirm remote state**

Run:

```bash
git status --short --branch
```

Expected: `## main...origin/main` with no uncommitted tracked changes.

## Final Verification Checklist

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Browser UI fills the full screen.
- [ ] Expression panel uses full Desmos-style boxes.
- [ ] Grid renderer fills the full right side.
- [ ] Legacy import/export format works.
- [ ] `~eq~` custom variables evaluate through the environment.
- [ ] PythonTA, doctest, Pygame, and Python files are absent from the final committed app.
- [ ] `origin` points at `https://github.com/Potatovender/Lepton-GRE.git`.
- [ ] `main` is pushed to GitHub.
