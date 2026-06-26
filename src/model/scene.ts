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
  angleMode: "radians",
  backgroundColor: "0",
  ensureSquareGrid: true,
  aspectRatio: "1:1",
  drawOnlyInsideBoundary: false
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
  const scene: SceneState = {
    functions: [],
    colors: [],
    restrictions: [],
    draws: [],
    settings: defaultSettings()
  };

  for (const line of sanitizeInput(rawText).split("\n")) {
    if (!line || line === "~~~~~") {
      continue;
    }

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
    `S:angle_mode~${scene.settings.angleMode}`,
    `S:background_color~${scene.settings.backgroundColor}`,
    `S:ensure_square_grid~${scene.settings.ensureSquareGrid ? 1 : 0}`,
    `S:aspect_ratio~${scene.settings.aspectRatio}`,
    `S:draw_only_inside_boundary~${scene.settings.drawOnlyInsideBoundary ? 1 : 0}`
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

  if (key === "background_color") {
    settings.backgroundColor = value || "0";
    return;
  }

  if (key === "ensure_square_grid") {
    settings.ensureSquareGrid = value === "1" || value.toLowerCase() === "true";
    return;
  }

  if (key === "aspect_ratio") {
    settings.aspectRatio = value || "1:1";
    return;
  }

  if (key === "draw_only_inside_boundary") {
    settings.drawOnlyInsideBoundary = value === "1" || value.toLowerCase() === "true";
    return;
  }

  if (!Number.isFinite(numberValue)) {
    if (key === "x_min") settings.xMin = value;
    if (key === "x_max") settings.xMax = value;
    if (key === "y_min") settings.yMin = value;
    if (key === "y_max") settings.yMax = value;
    return;
  }

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
