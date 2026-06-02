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
