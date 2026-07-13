export type AngleMode = "radians" | "degrees";

export type NumericResult = number | "nan" | "invalid";

export interface GridSettings {
  xMin: number | string;
  xMax: number | string;
  xPoints: number;
  yMin: number | string;
  yMax: number | string;
  yPoints: number;
  maxRecursion: number;
  angleMode: AngleMode;
  backgroundColor: string;
  ensureSquareGrid: boolean;
  aspectRatio: string;
  drawOnlyInsideBoundary: boolean;
  unboundedDecimalPlaces: number;
}

export interface RegistryEntry {
  id: string;
  kind?: "variable" | "slider" | "function";
  expression: string;
  params?: string[];
  sliderMin?: string;
  sliderMax?: string;
  time?: boolean;
  timeMode?: "bounded" | "unbounded" | "bounded_looped";
  timeRate?: string;
}

export interface ColorEntry {
  id: string;
  red: string;
  green: string;
  blue: string;
}

export interface BoundaryEntry {
  id: string;
  expression: string;
  lessThan: boolean;
}

export interface TransparencyEntry {
  id: string;
  expression: string;
}

export type DrawComponent =
  | { type: "color"; id: string }
  | { type: "boundary"; id: string }
  | { type: "transparency"; id: string };

export interface DrawEntry {
  equationId: string;
  components?: DrawComponent[];
  /** Legacy model fields retained for the older TypeScript scene helpers. */
  colorId?: string;
  restrictionId?: string;
  hidden?: boolean;
}

export interface RenderStatus {
  message: string;
  level: "idle" | "success" | "warning" | "error";
}
