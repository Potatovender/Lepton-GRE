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
  xMin: -10,
  xMax: 10,
  xPoints: 100,
  yMin: -10,
  yMax: 10,
  yPoints: 100,
  maxRecursion: 100,
  angleMode: "radians",
  backgroundColor: "0",
  ensureSquareGrid: true,
  aspectRatio: "1:1",
  drawOnlyInsideBoundary: false,
  unboundedDecimalPlaces: 3,
  unboundedIntegerDigits: 1
});

export const createDefaultScene = (): SceneState => ({
  functions: [{ id: "eq", kind: "variable", expression: "sin(x)+cos(y)" }],
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
      scene.functions.push({ id, kind: "variable", expression });
      continue;
    }

    const variableMatch = line.match(/^variable\s+([A-Za-z_]\w*)\s*=\s*(.*)$/i);
    if (variableMatch) {
      scene.functions.push({ id: variableMatch[1], kind: "variable", expression: variableMatch[2] });
      continue;
    }

    const sliderMatch = line.match(/^(slider|time)\s+([A-Za-z_]\w*)\s*=\s*(.*)$/i);
    if (sliderMatch) {
      const range = splitSliderRange(sliderMatch[3]);
      scene.functions.push({
        id: sliderMatch[2],
        kind: "slider",
        expression: range.expression,
        sliderMin: range.sliderMin,
        sliderMax: range.sliderMax,
        time: sliderMatch[1].toLowerCase() === "time"
      });
      continue;
    }

    const timedSliderMatch = line.match(/^time\s+(bounded_looped|bounded looped|bounded|unbounded)\s+([A-Za-z_]\w*)\s*=\s*(.*)$/i);
    if (timedSliderMatch) {
      const range = splitSliderRange(timedSliderMatch[3]);
      scene.functions.push({
        id: timedSliderMatch[2],
        kind: "slider",
        expression: range.expression,
        sliderMin: range.sliderMin,
        sliderMax: range.sliderMax,
        time: true,
        timeMode: normalizeTimeMode(timedSliderMatch[1])
      });
      continue;
    }

    const functionMatch = line.match(/^function\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?\s*=\s*(.*)$/i);
    if (functionMatch) {
      const params = (functionMatch[2] ?? "").split(",").map((param) => param.trim()).filter(Boolean);
      scene.functions.push({
        id: functionMatch[1],
        kind: params.length ? "function" : "variable",
        expression: functionMatch[3],
        params
      });
      continue;
    }

    if (line.startsWith("C:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [red, green, blue] = rest.split("~");
      scene.colors.push({ id, red: red ?? "0", green: green ?? "0", blue: blue ?? "0" });
      continue;
    }

    const colorMatch = line.match(/^(?:colour|color)\s+([A-Za-z_]\w*)\s*=\s*(.*)$/i);
    if (colorMatch) {
      const [red, green, blue] = colorMatch[2].split("~");
      scene.colors.push({ id: colorMatch[1], red: red ?? "0", green: green ?? "0", blue: blue ?? "0" });
      continue;
    }

    if (line.startsWith("R:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [expression, flag] = rest.split("~");
      scene.restrictions.push({ id, expression: expression ?? "1", checkSmaller: flag === "1" });
      continue;
    }

    const restrictionMatch = line.match(/^(?:boundary|restriction)\s+([A-Za-z_]\w*)\s*=\s*(.*)$/i);
    if (restrictionMatch) {
      const [expression, flag] = restrictionMatch[2].split("~");
      scene.restrictions.push({
        id: restrictionMatch[1],
        expression: expression ?? "1",
        checkSmaller: /^(?:1|true)$/i.test(flag ?? "")
      });
      continue;
    }

    if (line.startsWith("D~")) {
      const [, equationId, colorId, restrictionId] = line.split("~");
      scene.draws.push({ equationId, colorId, restrictionId });
      continue;
    }

    const drawMatch = line.match(/^draw\((.*)\)$/i);
    if (drawMatch) {
      const [equationId, colorId, restrictionId] = drawMatch[1].split(",").map((part) => part.trim());
      scene.draws.push({ equationId: equationId ?? "", colorId: colorId ?? "", restrictionId: restrictionId ?? "" });
      continue;
    }

    if (line.startsWith("S:")) {
      applySetting(scene.settings, line.slice(2));
      continue;
    }

    const settingMatch = line.match(/^set\s+([A-Za-z_]\w*)\s*=\s*(.*)$/i);
    if (settingMatch) {
      applySetting(scene.settings, `${settingMatch[1]}~${settingMatch[2]}`);
    }
  }

  return scene;
}

export function exportScene(scene: SceneState): string {
  return [
    `set x_min = ${scene.settings.xMin}`,
    `set x_max = ${scene.settings.xMax}`,
    `set y_min = ${scene.settings.yMin}`,
    `set y_max = ${scene.settings.yMax}`,
    `set max_recursion = ${scene.settings.maxRecursion}`,
    `set angle_mode = ${scene.settings.angleMode}`,
    `set background_color = ${scene.settings.backgroundColor}`,
    `set ensure_square_grid = ${scene.settings.ensureSquareGrid ? "True" : "False"}`,
    `set aspect_ratio = ${scene.settings.aspectRatio}`,
    `set draw_only_inside_boundary = ${scene.settings.drawOnlyInsideBoundary ? "True" : "False"}`,
    `set unbounded_decimal_places = ${scene.settings.unboundedDecimalPlaces}`,
    `set unbounded_integer_digits = ${scene.settings.unboundedIntegerDigits}`,
    ...scene.functions.map(exportRegistryEntry),
    ...scene.colors.map((entry) => `colour ${entry.id} = ${entry.red}~${entry.green}~${entry.blue}`),
    ...scene.restrictions.map((entry) => `boundary ${entry.id} = ${entry.expression}~${entry.checkSmaller ? "True" : "False"}`),
    ...scene.draws.map((entry) => `draw(${entry.equationId},${entry.colorId},${entry.restrictionId},False)`)
  ].join("\n");
}

function exportRegistryEntry(entry: RegistryEntry): string {
  if (entry.kind === "slider") {
    const range = entry.time && (entry.timeMode ?? "bounded") === "unbounded" ? "" : ` range ${entry.sliderMin ?? "0"}~${entry.sliderMax ?? "10"}`;
    return entry.time ? `time ${entry.timeMode ?? "bounded"} ${entry.id} = ${entry.expression}${range}` : `slider ${entry.id} = ${entry.expression}${range}`;
  }
  if (entry.kind === "function") {
    return `function ${entry.id}(${(entry.params ?? []).join(",")}) = ${entry.expression}`;
  }
  return `variable ${entry.id} = ${entry.expression}`;
}

function splitSliderRange(source: string): { expression: string; sliderMin: string; sliderMax: string } {
  const match = source.match(/^(.*?)(?:\s+range\s+(.+?)\s*~\s*(.+))?$/i);
  return {
    expression: (match?.[1] ?? source).trim(),
    sliderMin: (match?.[2] ?? "0").trim(),
    sliderMax: (match?.[3] ?? "10").trim()
  };
}

function normalizeTimeMode(value: string): "bounded" | "unbounded" | "bounded_looped" {
  const mode = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (mode === "unbounded" || mode === "bounded_looped") return mode;
  return "bounded";
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
    max_recursion: "maxRecursion",
    unbounded_decimal_places: "unboundedDecimalPlaces",
    unbounded_integer_digits: "unboundedIntegerDigits"
  };

  const mapped = map[key];
  if (mapped) {
    (settings[mapped] as number) = numberValue;
  }
}
