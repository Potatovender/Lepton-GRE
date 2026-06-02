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
