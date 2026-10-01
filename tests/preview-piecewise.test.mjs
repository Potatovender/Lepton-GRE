import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SCENE, createSceneRuntime } from "../src/compiler/scene-runtime.js";

function fixture(source) {
  const scene = structuredClone(DEFAULT_SCENE);
  scene.functions = [
    { id: "inner", kind: "function", params: ["aa"], expression: "{aa>0:aa}" },
    { id: "outer", kind: "function", params: ["aa"], expression: "{aa<2:inner(aa)}" },
    { id: "withFallback", kind: "function", params: ["aa"], expression: "{aa>0:aa,4}" },
    { id: "doubleValue", kind: "function", params: ["aa"], expression: "2*aa" },
    { id: "gate", kind: "variable", expression: "{x>0:x}" },
    { id: "image", kind: "variable", expression: source }
  ];
  scene.draws = [{ equationId: "image", components: [] }];
  const runtime = createSceneRuntime();
  runtime.setScene(scene);
  return runtime;
}

for (const [source, expected] of [
  ["{x>0:x}", [NaN, 1, 3]],
  ["inner(x)", [NaN, 1, 3]],
  ["outer(x)", [NaN, 1, NaN]],
  ["inner(x)+1", [NaN, 2, 4]],
  ["doubleValue(inner(x))", [NaN, 2, 6]],
  ["withFallback(x)", [4, 1, 3]],
  ["{x<2:{x>0:x}}", [NaN, 1, NaN]],
  ["[inner(x)][0]", [NaN, 1, 3]],
  ["gate", [NaN, 1, 3]]
]) {
  test(`piecewise composition retains CPU semantics and emits a complete shader: ${source}`, () => {
    const runtime = fixture(source), env = runtime.sceneFunctionEnv(true);
    const evaluate = runtime.compileExpression(source);
    assert.deepEqual([-1, 1, 3].map(x => evaluate(x, 0, runtime.buildRuntimeEnv(env))), expected);
    assert.match(runtime.expressionToGlsl(source, env), /\?/);
    const diagnostics = runtime.validateScene();
    assert.equal(diagnostics.hasErrors, false, diagnostics.summary);
    const issues = [];
    assert.match(runtime.buildFragmentShader(issues), /void main/);
    assert.deepEqual(issues, [], "A rejected conditional must not silently omit its draw layer");
  });
}

test("generated-output validation still rejects statement delimiters", () => {
  assert.throws(() => fixture("x").scalarExpressionToGlsl("1;2"), /Unsupported GLSL expression/);
});
