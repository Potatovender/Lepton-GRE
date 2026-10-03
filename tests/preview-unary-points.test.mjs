import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SCENE, createSceneRuntime } from "../src/compiler/scene-runtime.js";

function fixture() {
  const scene = structuredClone(DEFAULT_SCENE);
  scene.functions = [
    { id: "pack", kind: "function", params: ["a", "b"], outputType: "point", expression: "[a,b]" },
    { id: "skew", kind: "function", params: ["a", "b"], outputType: "point", expression: "[2*a,b+1]" },
    { id: "add", kind: "function", params: ["a", "b"], expression: "a+b" },
    { id: "four", kind: "function", params: ["a", "b", "c", "d"], expression: "1000*a+100*b+10*c+d" },
    { id: "shadow", kind: "function", params: ["p"], expression: "add(p,1)" },
    { id: "origin", kind: "function", params: [], outputType: "point", expression: "p" },
    { id: "pointShadow", kind: "function", params: ["p"], outputType: "point", expression: "[p,p+1]" },
    { id: "shift", kind: "function", params: ["a", "b"], outputType: "point", expression: "pack(a+1,b+2)" }
  ];
  scene.points = [{ id: "p", x: "2", y: "3" }, { id: "q", x: "4", y: "5" }, { id: "fixed", x: "x+2", y: "y+3" }];
  const runtime = createSceneRuntime();
  runtime.setScene(scene);
  return { runtime, scene, env: runtime.sceneFunctionEnv(true) };
}

const unaryCases = [
  ["-(-x)", (x) => x], ["-(-(-x))", (x) => -x],
  ["x-(-y)", (x, y) => x + y], ["x--y", (x, y) => x + y],
  ["x+(+y)", (x, y) => x + y], ["+(+x)", (x) => x],
  ["x-(-y)-(-x)", (x, y) => 2 * x + y],
  ["-(-(x-y))", (x, y) => x - y],
  ["-(-x)^2", (x) => -(x ** 2)], ["(-(-x))^2", (x) => x ** 2],
  ["e^(-(-x))", (x) => Math.exp(x)],
  ["frac{-(-x)}{x-(-y)}", (x, y) => x / (x + y)],
  ["sin(-(-x))-(-cos(y))", (x, y) => Math.sin(x) + Math.cos(y)]
];

for (const [source, expected] of unaryCases) {
  test(`unary signs retain semantics across CPU, GLSL and editor serializers: ${source}`, () => {
    const { runtime: r, env } = fixture();
    let spelling = source;
    for (let cycle = 0; cycle < 3; cycle++) {
      const ast = r.parseLeptonText(spelling);
      const versions = [r.astToMathString(ast), r.astToLeptonText(ast), r.astToLatex(ast)];
      for (const text of versions) {
        const evaluate = r.compileExpression(text);
        for (const [x, y] of [[-3, 2], [-1, -2], [0.5, 4]]) {
          assert(Math.abs(evaluate(x, y, r.buildRuntimeEnv(env)) - expected(x, y)) < 1e-10, `${text} at ${x},${y}`);
        }
        assert.doesNotMatch(r.expressionToGlsl(text, env), /--|\+\+/);
        assert.notEqual(r.validateExpression(text, env).status, "invalid");
      }
      spelling = r.normalizeExpressionText(versions[2]);
    }
  });
}

for (const [source, expected] of [
  ["add(p)", 5], ["add(((p)))", 5], ["four(p,q)", 2345],
  ["four(p,4,5)", 2345], ["four(1,p,4)", 1234], ["four(1,2,p)", 1223],
  ["add(p*2)", 10], ["add(p+q)", 14], ["add(p*q)", 23],
  ["add(pack(p))", 5], ["add(skew(pack(p)))", 8], ["add(pack(p)+q)", 14],
  ["add(pointShadow(10))", 21], ["pointShadow(10).y", 11], ["add(shift(p))", 8],
  ["pack(p).x", 2], ["pack(p)[1]", 3],
  ["pack(pack(p).x,4).y", 4], ["pack(pack(2,3).x,4).y", 4],
  ["pack(p.x,pack(2,3).y).x", 2], ["pack(pack(p)[0],pack(q)[1])[1]", 5],
  ["add(pack(p.x,pack(q).y))", 7], ["add(origin())", 5],
  ["shadow(10)", 11], ["add(fixed)", 5],
  ["sum(i=1~2){add(pack(p.x,i))}", 7],
  ["prod(i=1~2){add(pack(p.x,i))}", 12], ["[add(p),pack(q).x][1]", 4]
]) {
  test(`point arguments and nested selectors agree in both compiler paths: ${source}`, () => {
    const { runtime: r, scene, env } = fixture();
    for (const text of [source, r.astToLatex(r.parseLeptonText(source))]) {
      const normalized = r.normalizeExpressionText(text);
      assert.doesNotMatch(normalized, /leptonpointselector/);
      assert.equal(r.compileExpression(text)(9, -7, r.buildRuntimeEnv(env)), expected);
      assert.doesNotMatch(r.expressionToGlsl(text, env), /leptonpointselector|pointcall|\b(?:pack|add|skew)\(/);
      const flag = r.validateExpression(text, env);
      assert.notEqual(flag.status, "invalid", flag.message);
    }
    scene.functions.push({ id: "result", kind: "variable", expression: source });
    scene.draws = [{ equationId: "result", components: [] }];
    const issues = [];
    r.buildFragmentShader(issues);
    assert.deepEqual(issues, [], "Valid point composition must not silently drop its draw layer");
  });
}

test("point expansion still rejects missing, extra and blank function inputs", () => {
  const { runtime: r, env } = fixture();
  for (const source of ["add(p,1)", "four(p)", "pack(,1).x", "add(missingPoint)", "p[2]"]) {
    const flag = r.validateExpression(source, env);
    assert.equal(flag.status, "invalid", source);
    assert.doesNotMatch(flag.message, /leptonpointselector/, source);
  }
});
