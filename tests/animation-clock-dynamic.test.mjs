import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnimationClock } from "../src/animation/clock.js";

function entry(id, expression = 0, timeRate = 1, rest = {}) {
  return { id, expression, timeMode: "unbounded", timeRate, ...rest };
}

function coupled(options = {}) {
  return createAnimationClock({
    entries: [entry("a", 1, "b"), entry("b", 2, "a")],
    evaluate: (expression, values) => values.get(expression),
    ...options
  });
}

function close(actual, expected, epsilon = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test("all cross-dependent next values use the same previous state", () => {
  const clock = coupled({ stepSeconds: 0.25 });
  assert.equal(clock.info.mode, "fixed-step");
  assert.deepEqual([...clock.valuesAt(0)], [["a", 1], ["b", 2]]);
  assert.deepEqual([...clock.valuesAt(0.25)], [["a", 1.5], ["b", 2.25]]);
  assert.deepEqual([...clock.valuesAt(0.5)], [["a", 2.0625], ["b", 2.625]]);
  assert.deepEqual([...clock.valuesAt(0.375)], [["a", 1.78125], ["b", 2.4375]]);
  assert.deepEqual([...clock.valuesAt(0.5)], [["a", 2.0625], ["b", 2.625]], "partial seek must not change future lattice state");
});

test("declaration order does not change mutual rates or the previous-state map", () => {
  const entries = [entry("a", 1, "b"), entry("b", 2, "a"), entry("c", 5, "a+b")];
  const evaluate = (expression, values) => expression === "a+b" ? values.get("a") + values.get("b") : values.get(expression);
  const expected = coupled({ entries, evaluate }).valuesAt(3.7);
  for (const order of [[2, 0, 1], [1, 2, 0], [1, 0, 2], [2, 1, 0]]) {
    assert.deepEqual(coupled({ entries: order.map((index) => entries[index]), evaluate }).valuesAt(3.7), expected);
  }
});

test("30/60 FPS sampling, random seeks and a single seek produce identical values", () => {
  const thirty = coupled();
  const sixty = coupled();
  const random = coupled();
  for (const second of [0.013, 3.219, 0.071, 1.111, 2.001, 0, 0.58]) random.valuesAt(second);
  for (let frame = 0; frame <= 120; frame += 1) {
    const state = sixty.valuesAt(frame / 60);
    if (frame % 2 === 0) {
      assert.deepEqual(thirty.valuesAt((frame / 2) / 30), state);
      assert.deepEqual(random.valuesAt(frame / 60), state);
      assert.deepEqual(coupled().valuesAt(frame / 60), state);
    }
  }
});

test("checkpoint eviction, disabled checkpoints and reset preserve bit-identical results", () => {
  const cached = coupled({ maxCheckpoints: 3, checkpointInterval: 7 });
  const uncached = coupled({ maxCheckpoints: 1 });
  for (const time of [2, 8, 1.2, 12, 0.2, 9, 4.117, 12, 0]) {
    assert.deepEqual(cached.valuesAt(time), uncached.valuesAt(time));
    assert.ok(cached.info.checkpointCount <= 3);
    assert.equal(uncached.info.checkpointCount, 1);
  }
  const expected = cached.valuesAt(3.52);
  cached.reset();
  assert.equal(cached.info.checkpointCount, 1);
  assert.deepEqual(cached.valuesAt(3.52), expected);
});

test("a long chain of seeks is equivalent to the explicit discrete solution", () => {
  const h = 1 / 120;
  const clock = createAnimationClock({ entries: [entry("t", 2, "t")], evaluate: (expression, values) => values.get(expression) });
  for (let frame = 0; frame <= 300; frame += 1) clock.valuesAt(frame / 30);
  close(clock.valuesAt(10).get("t"), 2 * (1 + h) ** 1200, 2e-8);
});

test("constant clocks stay closed-form even inside a dynamic clock group", () => {
  const clock = createAnimationClock({
    entries: [entry("steady", 10000, 0.001), entry("dependent", 0, "steady")],
    evaluate: (expression, values) => values.get(expression)
  });
  assert.equal(clock.valuesAt(100, { maxSteps: 12000 }).get("steady"), 10000.1);
  assert.equal(clock.valuesAt(0.121).get("steady"), 10000 + 0.001 * 0.121);
});

test("inactive clocks remain frozen when active clocks have dependent speeds", () => {
  const clock = coupled({ selected: ["a"] });
  close(clock.valuesAt(3).get("a"), 1 + 3 * 2);
  assert.equal(clock.valuesAt(3).get("b"), 2);
  // Constant rates can use the parent's dependency callback to bypass integration altogether.
  const optimized = coupled({ selected: ["a"], dependsOnTime: (expression, active) => active.has(expression) });
  assert.equal(optimized.info.mode, "closed-form");
  close(optimized.valuesAt(3).get("a"), clock.valuesAt(3).get("a"));
});

test("all properties of all clocks receive the same read-only prior values", () => {
  const snapshots = [];
  const clock = createAnimationClock({
    entries: [entry("a", 1, "b"), entry("b", 2, "a")], stepSeconds: 0.25,
    evaluate(expression, values) {
      assert.equal(values.set, undefined);
      assert.equal(values.delete, undefined);
      assert.ok(Object.isFrozen(values));
      assert.equal(values.size, 2);
      assert.deepEqual([...values.keys()], ["a", "b"]);
      assert.equal(values.has("missing"), false);
      assert.equal(values.get("missing"), undefined);
      const copy = [];
      values.forEach((value, id, map) => { assert.equal(map, values); copy.push([id, value]); });
      assert.deepEqual(copy, [...values]);
      snapshots.push([...values.values()]);
      return values.get(expression);
    }
  });
  snapshots.length = 0;
  clock.valuesAt(0.5);
  assert.deepEqual(snapshots, [[1, 2], [1, 2], [1.5, 2.25], [1.5, 2.25]]);
});

test("time-varying bounce and wrap bounds are sampled from the prior state", () => {
  for (const mode of ["bounded", "bounded_looped"]) {
    const clock = createAnimationClock({
      entries: [entry("driver"), entry("moving", 0.5, 0.25, { timeMode: mode, sliderMin: "driver", sliderMax: "driver+1" })],
      stepSeconds: 1,
      evaluate: (expression, values) => expression === "driver" ? values.get("driver") : values.get("driver") + 1
    });
    assert.equal(clock.valuesAt(1).get("moving"), 0.75);
    assert.equal(clock.valuesAt(2).get("moving"), mode === "bounded" ? 1.25 : 1);
    assert.equal(clock.valuesAt(3).get("moving"), 2.25);
  }
});

test("shrinking ranges, collapse and reopening have explicit, deterministic behaviour", () => {
  const clock = createAnimationClock({
    entries: [entry("driver"), entry("bounce", 4, 1, { timeMode: "bounded", sliderMin: 0, sliderMax: "ceiling" })],
    stepSeconds: 1,
    evaluate: (_expression, values) => [5, 2, 0, 3][Math.min(3, values.get("driver"))]
  });
  assert.equal(clock.valuesAt(1).get("bounce"), 5);
  assert.equal(clock.valuesAt(2).get("bounce"), 1);
  assert.equal(clock.valuesAt(3).get("bounce"), 0);
  assert.equal(clock.valuesAt(4).get("bounce"), 1);
});

test("signed and zero dynamic rates bounce correctly after a rate reversal", () => {
  const clock = createAnimationClock({
    entries: [entry("driver"), entry("bounce", 0, "rate", { timeMode: "bounded", sliderMin: 0, sliderMax: 1 })],
    stepSeconds: 0.5,
    evaluate: (_expression, values) => values.get("driver") < 1 ? -2 : values.get("driver") < 2 ? 0 : 2
  });
  assert.equal(clock.valuesAt(0).get("bounce"), 0);
  assert.equal(clock.valuesAt(0.5).get("bounce"), 1);
  assert.equal(clock.valuesAt(1).get("bounce"), 0);
  assert.equal(clock.valuesAt(1.5).get("bounce"), 0);
  assert.equal(clock.valuesAt(2).get("bounce"), 0);
  assert.equal(clock.valuesAt(2.5).get("bounce"), 1);
  assert.equal(clock.valuesAt(3).get("bounce"), 0);
});

test("invalid ranges or non-finite rates mid-animation fail rather than silently freeze", () => {
  const invalidRange = createAnimationClock({
    entries: [entry("driver"), entry("moving", 0, 1, { timeMode: "bounded", sliderMin: 0, sliderMax: "1-driver" })],
    stepSeconds: 1, evaluate: (_expression, values) => 1 - values.get("driver")
  });
  assert.throws(() => invalidRange.valuesAt(3), (error) => error.code === "INVALID_RANGE" && error.entryId === "moving");
  const invalidRate = createAnimationClock({
    entries: [entry("t", 0, "rate")], stepSeconds: 1,
    evaluate: (_expression, values) => values.get("t") >= 1 ? NaN : 1
  });
  assert.throws(() => invalidRate.valuesAt(2), (error) => error.code === "INVALID_SCALAR" && error.property === "timeRate");
  assert.equal(invalidRate.valuesAt(1).get("t"), 1);
});

test("fractional frame queries and unsafe fixed-step times respect budgets", () => {
  const clock = coupled({ stepSeconds: 0.125, maxSyncSteps: 1 });
  assert.throws(() => clock.valuesAt(0.2), (error) => error.code === "STEP_BUDGET" && error.requiredSteps === 2);
  assert.equal(clock.info.checkpointCount, 1, "preflight budget failure does not perform work");
  assert.equal(clock.valuesAt(0.2, { maxSteps: 2 }).get("a"), 1.409375);
  assert.throws(() => clock.valuesAt(1e100), (error) => error.code === "TIME_RESOLUTION");
  // A genuinely tiny positive time must not be snapped to frame zero.
  const tiny = coupled().valuesAt(1e-15);
  assert.ok(tiny.get("a") > 1);
});

test("async evaluation yields, reports progress and matches synchronous calculation", async () => {
  const clock = coupled({ maxSyncSteps: 2, maxAsyncSteps: 1000 });
  assert.throws(() => clock.valuesAt(1), (error) => error.code === "STEP_BUDGET");
  const progress = [];
  let yields = 0;
  const result = await clock.valuesAtAsync(1.001, {
    yieldEverySteps: 7,
    yieldControl: async () => { yields += 1; },
    onProgress: (update) => progress.push(update)
  });
  assert.ok(yields >= 18);
  assert.deepEqual(result, coupled().valuesAt(1.001));
  assert.equal(progress[0].completedSteps, 0);
  assert.equal(progress.at(-1).completedSteps, progress.at(-1).totalSteps);
  assert.equal(progress.at(-1).secondsCompleted, 1.001);
  assert.ok(progress.every((item, index) => index === 0 || item.completedSteps >= progress[index - 1].completedSteps));
});

test("default async yielding releases the event loop instead of only microtasks", async () => {
  let timerRan = false;
  const timer = setTimeout(() => { timerRan = true; }, 0);
  try {
    await coupled().valuesAtAsync(0.1, { yieldEverySteps: 2 });
    assert.equal(timerRan, true);
  } finally { clearTimeout(timer); }
});

test("wall-time budget can yield before the maximum number of steps", async () => {
  let count = 0;
  await coupled().valuesAtAsync(0.1, {
    yieldEverySteps: 1000, yieldAfterMs: Number.MIN_VALUE,
    yieldControl: async () => { count += 1; }
  });
  assert.equal(count, 12);
});

test("async budgets reject excessive durations without iterating", async () => {
  let yields = 0;
  const clock = coupled({ maxAsyncSteps: 3 });
  await assert.rejects(clock.valuesAtAsync(1, { yieldControl: () => { yields += 1; } }), (error) => error.code === "STEP_BUDGET");
  assert.equal(yields, 0);
  assert.equal(clock.info.checkpointCount, 1);
  assert.deepEqual(await clock.valuesAtAsync(0.1, { maxSteps: 12 }), coupled().valuesAt(0.1));
});

test("async cancellation, retry and reset do not change the animation trajectory", async () => {
  const clock = coupled({ checkpointInterval: 3, maxCheckpoints: 4 });
  const controller = new AbortController();
  let yields = 0;
  await assert.rejects(clock.valuesAtAsync(2, {
    signal: controller.signal, yieldEverySteps: 4,
    yieldControl: async () => { yields += 1; if (yields === 4) controller.abort(); }
  }), (error) => error.code === "ABORTED");
  assert.deepEqual(await clock.valuesAtAsync(2), coupled().valuesAt(2));
  await assert.rejects(clock.valuesAtAsync(1, { signal: controller.signal }), (error) => error.code === "ABORTED");
  clock.reset();
  await assert.rejects(clock.valuesAtAsync(3, { yieldControl: () => clock.reset() }), (error) => error.code === "RESET");
  assert.equal(clock.info.checkpointCount, 1);
  assert.deepEqual(clock.valuesAt(0.1), coupled().valuesAt(0.1));
});

test("concurrent async/sync seeks have independent state and bounded shared checkpoints", async () => {
  const clock = coupled({ maxCheckpoints: 3 });
  const [later, earlier] = await Promise.all([
    clock.valuesAtAsync(3.57, { yieldEverySteps: 17 }),
    clock.valuesAtAsync(0.51, { yieldEverySteps: 13 })
  ]);
  assert.deepEqual(later, coupled().valuesAt(3.57));
  assert.deepEqual(earlier, coupled().valuesAt(0.51));
  assert.deepEqual(clock.valuesAt(1), coupled().valuesAt(1));
  assert.ok(clock.info.checkpointCount <= 3);
});

test("returned states and progress objects cannot poison checkpoints", async () => {
  const clock = coupled({ checkpointInterval: 1 });
  const state = await clock.stateAtAsync(1, { onProgress: (update) => { update.completedSteps = -99; } });
  state.values.clear();
  state.directions.set("a", -1);
  assert.deepEqual(clock.valuesAt(2), coupled().valuesAt(2));
});

test("constant async seeks are immediate and frame-zero APIs agree", async () => {
  const clock = createAnimationClock({ entries: [entry("t", 2, -0.25)] });
  assert.deepEqual(await clock.stateAtAsync(0), clock.stateAt(0));
  let yielded = false;
  assert.equal((await clock.valuesAtAsync(1e6, { maxSteps: 0, yieldControl: () => { yielded = true; } })).get("t"), -249998);
  assert.equal(yielded, false);
});

test("bad async options and dependency classifiers fail explicitly", async () => {
  const clock = coupled();
  for (const options of [{ yieldEverySteps: 0 }, { yieldAfterMs: 0 }, { yieldControl: null }, { onProgress: 1 }]) {
    await assert.rejects(clock.valuesAtAsync(1, options), (error) => error.code === "INVALID_OPTION");
  }
  assert.throws(() => coupled({ dependsOnTime: () => undefined }), (error) => error.code === "INVALID_DEPENDENCY");
});

test("transitive formula aliases must participate in dynamic dependency classification", () => {
  const clock = createAnimationClock({
    entries: [entry("a", 0, "alias"), entry("b", 2, 1)], stepSeconds: 0.5,
    evaluate: (_expression, values) => 2 * values.get("b"),
    dependsOnTime: (expression, active) => expression === "alias" && active.has("b")
  });
  assert.equal(clock.info.mode, "fixed-step");
  assert.equal(clock.valuesAt(0.5).get("a"), 2);
  assert.equal(clock.valuesAt(1).get("a"), 4.5);
});

test("a reset from an evaluator cannot insert a state into the new cache generation", () => {
  let clock;
  let resetDuringEvaluation = false;
  clock = coupled({
    checkpointInterval: 1,
    evaluate(expression, values) {
      if (resetDuringEvaluation) { resetDuringEvaluation = false; clock.reset(); }
      return values.get(expression);
    }
  });
  resetDuringEvaluation = true;
  assert.throws(() => clock.valuesAt(1), (error) => error.code === "RESET");
  assert.equal(clock.info.checkpointCount, 1);
  assert.deepEqual(clock.valuesAt(1), coupled().valuesAt(1));
  resetDuringEvaluation = true;
  assert.throws(() => clock.valuesAt(0.001), (error) => error.code === "RESET");
  assert.equal(clock.info.checkpointCount, 1);
});

test("a failed scheduler or progress callback can be retried deterministically", async () => {
  const clock = coupled({ checkpointInterval: 1 });
  await assert.rejects(clock.valuesAtAsync(1, { yieldControl: () => { throw new Error("scheduler failed"); } }), /scheduler failed/);
  await assert.rejects(clock.valuesAtAsync(1, { onProgress: () => { throw new Error("progress failed"); } }), /progress failed/);
  assert.deepEqual(await clock.valuesAtAsync(1), coupled().valuesAt(1));
});
