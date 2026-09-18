import { test } from "node:test";
import assert from "node:assert/strict";
import { createSceneClock } from "../src/animation/scene-clock.js";
import { createSceneRuntime, DEFAULT_SCENE } from "../src/compiler/scene-runtime.js";

function time(id = "t", expression = "0", timeRate = "1", rest = {}) {
  return { id, kind: "slider", time: true, timeMode: "unbounded", expression, timeRate, ...rest };
}
function variable(id, expression) { return { id, expression, kind: "variable" }; }
function fn(id, params, expression, rest = {}) { return { id, params, expression, kind: "function", ...rest }; }
function scene(functions, rest = {}) {
  return { ...structuredClone(DEFAULT_SCENE), ...rest, functions, settings: { ...DEFAULT_SCENE.settings, ...rest.settings } };
}
function close(actual, expected, epsilon = 1e-10) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
}
function isCoordinateError(error) {
  return error.code === "EVALUATION_FAILED" && /depend on coordinates/.test(error.message);
}

test("scene adapter advances actual time sliders, including clocks in closed folders", () => {
  const input = scene([
    time("t", "2", "3", { _uid: "time-one" }),
    { ...time("plain"), time: false }, variable("notTime", "8"),
    { type: "comment", text: "time hidden = 9" }
  ], { folders: [{ id: "Closed", _uid: "folder", collapsed: true }], dataOrder: [{ kind: "functions", uid: "time-one", parentUid: "folder" }] });
  const clock = createSceneClock(input);
  assert.deepEqual([...clock.valuesAt(2)], [["t", 8]]);
});

test("scene snapshot, starts, selection and direction are independent of later editing", () => {
  const input = scene([time("t", "2", "rate"), variable("rate", "0.125")]);
  const before = structuredClone(input);
  const starts = { t: "sqrt(16)" };
  const clock = createSceneClock(input, { starts });
  assert.deepEqual(input, before);
  input.functions[1].expression = "100";
  input.settings.angleMode = "degrees";
  starts.t = "12";
  assert.equal(clock.valuesAt(8).get("t"), 5);
  assert.equal(clock.info.mode, "closed-form");
});

test("cross-clock starts and overridden aliases resolve lazily", () => {
  const input = scene([time("a", "alias+1"), time("b", "2"), variable("alias", "2*b")]);
  const clock = createSceneClock(input, { starts: { b: "sqrt(16)" } });
  assert.deepEqual([...clock.valuesAt(0)], [["a", 9], ["b", 4]]);
  assert.deepEqual([...clock.valuesAt(1)], [["a", 10], ["b", 5]]);
});

test("dependent rates use time overrides transitively through expressions and functions", () => {
  const input = scene([
    time("a", "1", "rateB"), time("b", "2", "rateA"),
    variable("rateB", "twice(b)/2"), variable("rateA", "a"), fn("twice", ["n"], "2*n")
  ]);
  const clock = createSceneClock(input, { stepSeconds: 0.25 });
  assert.equal(clock.info.mode, "fixed-step");
  assert.deepEqual([...clock.valuesAt(0.5)], [["a", 2.0625], ["b", 2.625]]);
  const reordered = createSceneClock({ ...input, functions: [...input.functions].reverse() }, { stepSeconds: 0.25 });
  assert.deepEqual(reordered.valuesAt(2), clock.valuesAt(2));
});

test("frozen clock references allow direct evaluation of otherwise dependent rates", () => {
  const input = scene([time("a", "1", "twice(b)"), time("b", "2"), fn("twice", ["n"], "2*n")]);
  const clock = createSceneClock(input, { selected: ["a"], starts: new Map([["b", 3]]) });
  assert.equal(clock.info.mode, "closed-form");
  assert.deepEqual([...clock.valuesAt(1e6, { maxSteps: 0 })], [["a", 6000001], ["b", 3]]);
});

test("function-local x/y or time-named parameters do not become free dependencies", () => {
  const input = scene([
    time("t", "0", "rate(2,3,4)"),
    fn("rate", ["x", "y", "t"], "x+y+t")
  ]);
  const clock = createSceneClock(input);
  assert.equal(clock.info.mode, "closed-form");
  assert.equal(clock.valuesAt(1).get("t"), 9);
});

test("free x/y are rejected in starts, rates, bounds and transitive function bodies", () => {
  for (const property of ["expression", "timeRate", "sliderMin", "sliderMax"]) {
    const input = scene([time("t", "1", "1", { timeMode: "bounded", sliderMin: "0", sliderMax: "10", [property]: "x+1" })]);
    assert.throws(() => createSceneClock(input), isCoordinateError);
  }
  for (const expression of ["x", "y", "sin(x)", "alias", "free(2)", "bare", "free(x)", "{x>0:1,2}"]) {
    const input = scene([time("t", expression), variable("alias", "x+2"), fn("free", ["a"], "a+y"), fn("bare", ["x", "y"], "x+y")]);
    assert.throws(() => createSceneClock(input), isCoordinateError, expression);
  }
});

test("global definitions keep their own scope when accessed inside a local function", () => {
  const input = scene([time("t", "use(2)"), variable("globalValue", "x"), fn("use", ["x"], "globalValue+x")]);
  assert.throws(() => createSceneClock(input), isCoordinateError);
});

test("scoped reductions and comprehensions distinguish locals from time bounds", () => {
  const local = createSceneClock(scene([time("t", "0", "sum(x=1~3){x}+prod(t=1~3){t}")]));
  assert.equal(local.info.mode, "closed-form");
  assert.equal(local.valuesAt(1).get("t"), 12);
  const dynamic = createSceneClock(scene([
    time("a", "0", "sum(i=1~b){i}"), time("b", "2", "2")
  ]), { stepSeconds: 0.5 });
  assert.equal(dynamic.info.mode, "fixed-step");
  assert.equal(dynamic.valuesAt(1).get("a"), 4.5);
  const comprehension = createSceneClock(scene([
    time("t", "0", "items[1]"),
    variable("alias", "t+1")
  ], { lists: [{ id: "items", expression: "[alias+c for(c=1,3)]" }] }), { stepSeconds: 0.5 });
  assert.equal(comprehension.valuesAt(1).get("t"), 3.75);
});

test("list indexing, lengths and nested reductions retain scalar semantics", () => {
  const input = scene([time("t", "0", "values[1]+sum(i=1~2){prod(j=1~i){j}}")], {
    lists: [{ id: "values", expression: "[2,4,6]" }]
  });
  assert.equal(createSceneClock(input).valuesAt(1).get("t"), 7);
  const lengths = createSceneClock(scene([time("t", "0", "values.length")], { lists: [{ id: "values", expression: "[x,t,y]" }] }));
  assert.equal(lengths.info.mode, "closed-form");
  assert.equal(lengths.valuesAt(1).get("t"), 3);
  const dynamicLength = createSceneClock(scene([time("t", "0", "values.length"), time("n", "2")], { lists: [{ id: "values", expression: "[c for(c=1,n)]" }] }), { stepSeconds: 1 });
  assert.equal(dynamicLength.info.mode, "fixed-step");
  assert.equal(dynamicLength.valuesAt(2).get("t"), 5);
});

test("list and reduction coordinate dependencies are rejected", () => {
  for (const rate of ["sum(i=1~x){i}", "sum(i=1~3){y+i}", "values[0]", "[i for(i=1,y)].length"]) {
    assert.throws(() => createSceneClock(scene([time("t", "0", rate)], { lists: [{ id: "values", expression: "[x,2]" }] })), isCoordinateError, rate);
  }
});

test("point selectors use scalar time overrides without treating .x as a free coordinate", () => {
  for (const selector of ["p.x", "p[0]"]) {
    const input = scene([time("t", "0", selector), time("u", "2")], { points: [{ id: "p", x: "u+1", y: "0" }] });
    const clock = createSceneClock(input, { stepSeconds: 0.5 });
    assert.equal(clock.info.mode, "fixed-step");
    assert.equal(clock.valuesAt(1).get("t"), 3.25);
  }
  const independent = createSceneClock(scene([time("t", "0", "p.x")], { points: [{ id: "p", x: "2", y: "y" }] }));
  assert.equal(independent.valuesAt(1).get("t"), 2);
});

test("point-returning functions, scalar receiving functions and local parameters work", () => {
  const input = scene([
    time("t", "0", "add(pair(2,3))"),
    fn("pair", ["x", "y"], "[x,y]", { outputType: "point" }), fn("add", ["a", "b"], "a+b")
  ]);
  assert.equal(createSceneClock(input).valuesAt(1).get("t"), 5);
  for (const selector of ["pair(2,3).x", "pair(2,3)[1]"]) {
    input.functions[0].timeRate = selector;
    assert.equal(createSceneClock(input).valuesAt(1).get("t"), selector.endsWith(".x") ? 2 : 3);
  }
});

test("time bounds follow aliased moving ranges using one previous state", () => {
  const input = scene([
    time("driver"), time("moving", "0.5", "0.25", { timeMode: "bounded", sliderMin: "driver", sliderMax: "upper" }),
    variable("upper", "driver+1")
  ]);
  const clock = createSceneClock(input, { stepSeconds: 1 });
  assert.equal(clock.valuesAt(1).get("moving"), 0.75);
  assert.equal(clock.valuesAt(2).get("moving"), 1.25);
});

test("piecewise boundary conditions participate in dependency and coordinate checks", () => {
  const input = scene([time("t", "0", "{gate:2,1}"), time("u", "0")], {
    restrictions: [{ id: "gate", expression: "u-1" }]
  });
  const clock = createSceneClock(input, { stepSeconds: 1 });
  assert.equal(clock.info.mode, "fixed-step");
  assert.equal(clock.valuesAt(2).get("t"), 3);
  input.restrictions[0].expression = "y-1";
  assert.throws(() => createSceneClock(input), isCoordinateError);
});

test("LaTeX, negative powers, angle modes and random seed use the shared runtime", () => {
  const input = scene([time("t", "\\frac{1}{2}", "sin(90)+e^(-2)+random()")], { settings: { angleMode: "degrees", randomSeed: 12345 } });
  const runtime = createSceneRuntime();
  runtime.setScene(structuredClone(input));
  const expectedRate = runtime.compileExpression(input.functions[0].timeRate)(0, 0, runtime.buildRuntimeEnv(runtime.sceneFunctionEnv(true)));
  const clock = createSceneClock(input);
  input.settings.randomSeed = 456;
  close(clock.valuesAt(1).get("t"), 0.5 + expectedRate);
  assert.equal(clock.info.mode, "closed-form");
  assert.equal(clock.valuesAt(1).get("t"), clock.valuesAt(1).get("t"));
});

test("invalid scalar results, unknown references and invalid starts do not silently default", () => {
  for (const expression of ["1/0", "sqrt(-1)", "missing+1", "[1,2]", "values", "pointValue", "{1<0:2}"]) {
    const input = scene([time("t", expression)], { lists: [{ id: "values", expression: "[1,2]" }], points: [{ id: "pointValue", x: "1", y: "2" }] });
    assert.throws(() => createSceneClock(input), (error) => error.code === "EVALUATION_FAILED", expression);
  }
  assert.throws(() => createSceneClock(scene([time("t", "0", "1", { timeMode: "bounded" })]), { starts: { t: "sqrt(121)" } }), (error) => error.code === "START_OUT_OF_RANGE");
});

test("circular start references through user functions are diagnosed", () => {
  const input = scene([time("a", "twice(b)"), time("b", "a"), fn("twice", ["n"], "2*n")]);
  assert.throws(() => createSceneClock(input), (error) => error.code === "CIRCULAR_START");
  assert.deepEqual([...createSceneClock(input, { starts: { b: 3 } }).valuesAt(0)], [["a", 6], ["b", 3]]);
});

test("ambiguous time IDs cannot be shadowed by expressions, functions or lists", () => {
  for (const extra of [variable("t", "2"), fn("t", ["a"], "a"), time("t", "2")]) {
    assert.throws(() => createSceneClock(scene([time(), extra])), (error) => error.code === "DUPLICATE_ID");
  }
  assert.throws(() => createSceneClock(scene([time()], { lists: [{ id: "t", expression: "[1,2]" }] })), (error) => error.code === "DUPLICATE_ID");
});

test("adapter exposes deterministic async seeking and cancellation to the video worker", async () => {
  const input = scene([time("t", "1", "alias"), variable("alias", "t/10")]);
  const clock = createSceneClock(input, { maxCheckpoints: 3, maxSyncSteps: 10 });
  let yielded = false;
  const result = await clock.valuesAtAsync(1.01, { yieldControl: () => { yielded = true; } });
  assert.equal(yielded, true);
  assert.deepEqual(result, createSceneClock(input).valuesAt(1.01));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(clock.valuesAtAsync(4, { signal: controller.signal }), (error) => error.code === "ABORTED");
  clock.reset();
  assert.equal(clock.info.checkpointCount, 1);
});
