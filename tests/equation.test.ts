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

  test("keeps inverse aliases and scalar functions aligned with the live renderer", () => {
    expect(new Equation("asin(0.5)").evaluate(0, 0)).toBeCloseTo(new Equation("arcsin(0.5)").evaluate(0, 0) as number);
    expect(new Equation("acos(0.5)").evaluate(0, 0)).toBeCloseTo(new Equation("arccos(0.5)").evaluate(0, 0) as number);
    expect(new Equation("atan(1)").evaluate(0, 0)).toBeCloseTo(new Equation("arctan(1)").evaluate(0, 0) as number);
    expect(new Equation("log(e)").evaluate(0, 0)).toBeCloseTo(1);
    expect(new Equation("clamp(10,0,3)+min(2,3)+max(2,3)").evaluate(0, 0)).toBeCloseTo(8);
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
