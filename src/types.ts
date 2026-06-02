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
