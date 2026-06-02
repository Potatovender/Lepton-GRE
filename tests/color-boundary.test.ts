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
