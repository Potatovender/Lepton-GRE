import { describe, expect, test } from "vitest";
import { convertPowers, normalizeMathSyntax } from "../src/math/expression-syntax.js";

describe("live expression syntax", () => {
  test.each([
    ["2(x+1)", "2*(x+1)"],
    ["(x+1)(y-1)", "(x+1)*(y-1)"],
    ["2sin(x)", "2*sin(x)"],
    ["x(y+1)", "x*(y+1)"],
    ["2clamp(x,0,1)", "2*clamp(x,0,1)"],
    ["f2(x)+x2", "f2(x)+x2"],
  ])("normalizes implicit multiplication in %s", (source, expected) => {
    expect(normalizeMathSyntax(source)).toBe(expected);
  });

  test.each([
    ["clamp3(x,0,1)", "clamp3(x,0,1)"],
    ["leptonRandom(vec2(x,y))", "leptonRandom(vec2(x,y))"],
    ["pow(x,2)", "pow(x,2)"],
    ["sinh1(cosh1(x))", "sinh1(cosh1(x))"],
  ])("does not reinterpret generated helper call %s", (source, expected) => {
    expect(normalizeMathSyntax(source)).toBe(expected);
  });

  test.each([
    ["x^2", "pow(x,2)"],
    ["-x^2", "-pow(x,2)"],
    ["(-x)^2", "pow((-x),2)"],
    ["2^3^2", "pow(2,pow(3,2))"],
    ["e^(-x^2)", "pow(e,(-pow(x,2)))"],
    ["sin(cos(x)^2)^3", "pow(sin(pow(cos(x),2)),3)"],
    ["frac(x^2,y^3)", "frac(pow(x,2),pow(y,3))"],
  ])("lowers nested power expression %s right-associatively", (source, expected) => {
    expect(convertPowers(source)).toBe(expected);
  });
});
