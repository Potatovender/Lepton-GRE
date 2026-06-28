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
}

export interface RegistryEntry {
  id: string;
  kind?: "variable" | "slider" | "function";
  expression: string;
  params?: string[];
  sliderMin?: string;
  sliderMax?: string;
  time?: boolean;
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
