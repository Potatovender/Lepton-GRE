import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnimationClock, AnimationClockError } from "../src/animation/clock.js";

function entry(id = "t", extra = {}) {
  return { id, expression: "0", timeMode: "unbounded", timeRate: "1", ...extra };
}

function close(actual, expected, epsilon = 1e-11) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

function errorCode(action, code) {
  assert.throws(action, (error) => error instanceof AnimationClockError && error.code === code);
}

test("frame zero uses an immutable snapshot and returns detached native maps", () => {
  const entries = [entry("t", { expression: "2" })];
  const starts = new Map([["t", "3"]]);
  const directions = { t: -1 };
  const selected = ["t"];
  const clock = createAnimationClock({ entries, starts, directions, selected });
  entries[0].timeRate = "100";
  entries.push(entry("late"));
  starts.set("t", 50);
  directions.t = 1;
  selected.length = 0;
  assert.deepEqual(clock.stateAt(0), { values: new Map([["t", 3]]), directions: new Map([["t", -1]]) });
  const exposed = clock.stateAt(0);
  exposed.values.set("t", 99);
  exposed.directions.set("t", 1);
  assert.equal(clock.valuesAt(1).get("t"), 4);
  assert.equal(clock.stateAt(0).directions.get("t"), -1);
  assert.equal(clock.info.mode, "closed-form");
  assert.equal(clock.info.clockCount, 1);
  assert.ok(Object.isFrozen(clock));
});

test("unbounded values retain full precision beyond 10,000 and on long direct seeks", () => {
  const clock = createAnimationClock({ entries: [entry("t", { expression: 10000, timeRate: 0.001 })] });
  assert.equal(clock.valuesAt(1 / 60).get("t"), 10000 + 0.001 / 60);
  assert.equal(clock.valuesAt(600).get("t"), 10000.6);
  assert.equal(clock.valuesAt(1e9, { maxSteps: 0 }).get("t"), 1010000);
  assert.equal(clock.valuesAt(1 / 60).get("t"), 10000 + 0.001 / 60);
});

test("unbounded rates can be signed or zero; directions apply only to bounce", () => {
  for (const speed of [-2, 0, 2]) {
    const clock = createAnimationClock({ entries: [entry("t", { expression: 4, timeRate: speed })], directions: { t: -1 } });
    assert.equal(clock.valuesAt(5).get("t"), 4 + 5 * speed);
  }
});

test("all or selected clocks advance; stationary clocks are available to dependencies", () => {
  const entries = [entry("a", { expression: 2, timeRate: 3 }), entry("b", { expression: 8, timeRate: -1 })];
  assert.deepEqual([...createAnimationClock({ entries }).valuesAt(2)], [["a", 8], ["b", 6]]);
  assert.deepEqual([...createAnimationClock({ entries, selected: new Set(["b"]) }).valuesAt(2)], [["a", 2], ["b", 6]]);
  assert.deepEqual([...createAnimationClock({ entries, selected: [] }).valuesAt(1e12)], [["a", 2], ["b", 8]]);
  assert.deepEqual([...createAnimationClock({ entries: [] }).valuesAt(100)], []);
});

test("looped clocks preserve frame zero, wrap signed rates and make many crossings", () => {
  const make = (expression, timeRate) => createAnimationClock({ entries: [entry("t", { timeMode: "bounded_looped", sliderMin: -2, sliderMax: 3, expression, timeRate })] });
  assert.equal(make(3, 1).valuesAt(0).get("t"), 3);
  assert.equal(make(3, 1).valuesAt(0.25).get("t"), -1.75);
  assert.equal(make(3, 0).valuesAt(99).get("t"), 3);
  assert.equal(make(-2, -1).valuesAt(0.25).get("t"), 2.75);
  assert.equal(make(0, 2).valuesAt(1.5).get("t"), -2);
  assert.equal(make(0, -2).valuesAt(99).get("t"), 2);
});

test("tiny loop increments are not rounded away by redundant modulo additions", () => {
  const clock = createAnimationClock({ entries: [entry("t", { expression: 0, timeRate: 1e-16, timeMode: "bounded_looped" })] });
  assert.equal(clock.valuesAt(1).get("t"), 1e-16);
});

test("bounce endpoints, signed rates and direction multipliers are consistent", () => {
  for (const rate of [-3, 0, 3]) {
    for (const direction of [-1, 1]) {
      const clock = createAnimationClock({
        entries: [entry("t", { expression: 2, timeRate: rate, timeMode: "bounded", sliderMin: 0, sliderMax: 10 })],
        directions: { t: direction }
      });
      for (const time of [0, 0.5, 1, 2, 10, 1000]) {
        const raw = 2 + time * rate * direction;
        const phase = ((raw % 20) + 20) % 20;
        close(clock.valuesAt(time).get("t"), phase <= 10 ? phase : 20 - phase);
      }
    }
  }
  const bounce = createAnimationClock({ entries: [entry("t", { timeMode: "bounded", timeRate: 2 })] });
  assert.equal(bounce.valuesAt(5).get("t"), 10);
  assert.equal(bounce.stateAt(5).directions.get("t"), -1);
  assert.equal(bounce.valuesAt(10).get("t"), 0);
  assert.equal(bounce.stateAt(10).directions.get("t"), 1);
  const negative = createAnimationClock({ entries: [entry("t", { expression: 10, timeMode: "bounded", timeRate: -2 })] });
  assert.equal(negative.stateAt(5).directions.get("t"), -1);
  assert.equal(negative.valuesAt(5.5).get("t"), 1);
  assert.equal(negative.stateAt(10).directions.get("t"), 1);
});

test("resuming a bounce from any exported value/direction matches uninterrupted motion", () => {
  for (const rate of [-2, 2]) for (const direction of [-1, 1]) for (const start of [0, 3, 10]) {
    const raw = entry("t", { expression: start, timeMode: "bounded", timeRate: rate });
    const clock = createAnimationClock({ entries: [raw], directions: { t: direction } });
    for (const at of [0, 0.5, 1.5, 3.5, 5, 13]) {
      const state = clock.stateAt(at);
      const resumed = createAnimationClock({ entries: [raw], starts: state.values, directions: state.directions });
      close(resumed.valuesAt(3.125).get("t"), clock.valuesAt(at + 3.125).get("t"));
    }
  }
});

test("a zero-width bounded/looped range is stationary, not an unbounded fallback", () => {
  for (const timeMode of ["bounded", "bounded_looped"]) {
    const clock = createAnimationClock({ entries: [entry("t", { expression: 3, timeMode, sliderMin: 3, sliderMax: 3, timeRate: -50 })] });
    assert.equal(clock.valuesAt(100).get("t"), 3);
  }
});

test("start references resolve lazily against overrides regardless of declaration order", () => {
  const raw = [entry("a", { expression: "b+2" }), entry("b", { expression: 1 })];
  const evaluate = (expression, values) => {
    if (expression === "b+2") return values.get("b") + 2;
    if (expression === "sqrt(16)") return 4;
    throw new Error("unexpected expression");
  };
  for (const entries of [raw, [...raw].reverse()]) {
    const clock = createAnimationClock({ entries, starts: { b: "sqrt(16)" }, evaluate });
    assert.deepEqual([...clock.valuesAt(0)], [["a", 6], ["b", 4]]);
    assert.deepEqual([...clock.valuesAt(2)], [["a", 8], ["b", 6]]);
  }
  assert.equal(raw[1].expression, 1);
});

test("a start override breaks an otherwise circular start dependency", () => {
  const entries = [entry("a", { expression: "b" }), entry("b", { expression: "a" })];
  const evaluate = (expression, values) => values.get(expression);
  errorCode(() => createAnimationClock({ entries, evaluate }), "CIRCULAR_START");
  errorCode(() => createAnimationClock({ entries: [entry("a", { expression: "a" })], evaluate }), "CIRCULAR_START");
  assert.deepEqual([...createAnimationClock({ entries, evaluate, starts: { b: 7 } }).valuesAt(0)], [["a", 7], ["b", 7]]);
});

test("parent evaluator handles scalar expressions and frozen, transitive dependencies", () => {
  let calls = 0;
  const entries = [entry("a", { timeRate: "twiceB" }), entry("b", { expression: 4 })];
  const clock = createAnimationClock({
    entries, selected: ["a"],
    evaluate(expression, values) { calls += 1; assert.equal(expression, "twiceB"); return 2 * values.get("b"); },
    dependsOnTime(expression, selected) { assert.equal(expression, "twiceB"); return selected.has("b"); }
  });
  assert.equal(clock.info.mode, "closed-form");
  assert.equal(clock.valuesAt(1e6).get("a"), 8e6);
  assert.equal(calls, 1, "constant rate is evaluated only once");
});

test("invalid starts, rates, modes, directions, IDs and ranges are actionable errors", () => {
  const cases = [
    [{ entries: [entry(" ")] }, "INVALID_ID"],
    [{ entries: [entry(), entry()] }, "DUPLICATE_ID"],
    [{ entries: [entry("t", { expression: "" })] }, "EVALUATION_FAILED"],
    [{ entries: [entry("t", { timeMode: "wrong" })] }, "INVALID_MODE"],
    [{ entries: [entry("t", { expression: Infinity })] }, "INVALID_SCALAR"],
    [{ entries: [entry("t", { timeRate: NaN })] }, "INVALID_SCALAR"],
    [{ entries: [entry()], starts: { t: false } }, "EVALUATION_FAILED"],
    [{ entries: [entry()], directions: { t: 0 } }, "INVALID_DIRECTION"],
    [{ entries: [entry()], starts: { missing: 2 } }, "UNKNOWN_CLOCK"],
    [{ entries: [entry()], selected: ["missing"] }, "UNKNOWN_CLOCK"],
    [{ entries: [entry()], selected: "t" }, "INVALID_OPTION"],
    [{ entries: [entry("t", { timeMode: "bounded", expression: -1 })] }, "START_OUT_OF_RANGE"],
    [{ entries: [entry("t", { timeMode: "bounded", expression: 11 })] }, "START_OUT_OF_RANGE"],
    [{ entries: [entry("t", { timeMode: "bounded", sliderMin: 5, sliderMax: 2 })] }, "INVALID_RANGE"],
    [{ entries: [entry("t", { timeMode: "bounded", sliderMax: Infinity })] }, "INVALID_SCALAR"],
    [{ entries: [entry("t", { timeMode: "bounded", sliderMin: -1e308, sliderMax: 1e308 })] }, "INVALID_RANGE"],
    [{ entries: [entry()], maxCheckpoints: 0 }, "INVALID_OPTION"],
    [{ entries: [entry()], stepSeconds: 0 }, "INVALID_OPTION"]
  ];
  for (const [options, code] of cases) errorCode(() => createAnimationClock(options), code);
});

test("coordinate validation belongs to the parent evaluator; rejected inputs are not coerced", () => {
  for (const result of [NaN, Infinity, "1", null, false, [1], Promise.resolve(1)]) {
    errorCode(() => createAnimationClock({ entries: [entry("t", { expression: "bad" })], evaluate: () => result }), "INVALID_SCALAR");
  }
  assert.throws(() => createAnimationClock({
    entries: [entry("t", { timeRate: "x+1" })], evaluate() { throw new Error("Coordinates are not allowed"); }
  }), (error) => error.code === "EVALUATION_FAILED" && error.property === "timeRate" && error.entryId === "t" && /Coordinates/.test(error.message));
});

test("time queries validate numeric times, safe budgets, and numeric overflow", () => {
  const clock = createAnimationClock({ entries: [entry()] });
  for (const time of [-1, NaN, Infinity, "1", null]) errorCode(() => clock.valuesAt(time), "INVALID_TIME");
  errorCode(() => clock.valuesAt(1, { maxSteps: -1 }), "INVALID_OPTION");
  const huge = createAnimationClock({ entries: [entry("t", { timeRate: 1e308 })] });
  errorCode(() => huge.valuesAt(10), "NON_FINITE_VALUE");
});

test("arbitrary valid ID strings are map keys, never object/prototype lookups", () => {
  const clock = createAnimationClock({ entries: [entry("__proto__"), entry("constructor"), entry("cloud time")] });
  assert.equal(clock.valuesAt(2).get("__proto__"), 2);
  assert.equal(clock.valuesAt(2).get("constructor"), 2);
  assert.equal(clock.valuesAt(2).get("cloud time"), 2);
});

test("bounce closed form agrees with an independent collision-by-collision integrator", () => {
  function collide(start, rate, direction, duration) {
    const min = -3;
    const max = 7;
    let position = start;
    let velocity = rate * direction;
    if (rate === 0) return { position, direction };
    while (duration > 0) {
      const edge = velocity > 0 ? max : min;
      const timeToEdge = (edge - position) / velocity;
      if (timeToEdge - duration > 1e-12) { position += velocity * duration; break; }
      position = edge;
      duration = Math.max(0, duration - timeToEdge);
      velocity = -velocity;
    }
    return { position, direction: Math.sign(velocity / rate) };
  }
  for (const start of [-3, -2, 0, 6, 7]) for (const rate of [-13, -1, 0, 1, 13]) for (const direction of [-1, 1]) {
    const clock = createAnimationClock({
      entries: [entry("t", { expression: start, timeMode: "bounded", timeRate: rate, sliderMin: -3, sliderMax: 7 })],
      directions: { t: direction }
    });
    for (const duration of [0, 0.125, 1, 2.375, 19.375]) {
      const expected = collide(start, rate, direction, duration);
      const state = clock.stateAt(duration);
      close(state.values.get("t"), expected.position, 1e-10);
      assert.equal(state.directions.get("t"), expected.direction, JSON.stringify({ start, rate, direction, duration, expected, actual: [...state.values] }));
    }
  }
});

test("export timestamps start exactly at frame zero and do not accumulate frame deltas", () => {
  const clock = createAnimationClock({ entries: [entry("t", { expression: 3, timeRate: 0.7 })] });
  for (const fps of [24, 30, 60]) {
    for (let frame = 0; frame < 10 * fps; frame += 1) {
      assert.equal(clock.valuesAt(frame / fps).get("t"), 3 + frame / fps * 0.7);
    }
    assert.equal(clock.valuesAt(10).get("t"), 10);
  }
});

test("parent dependency callback gets a complete immutable set of selected clocks", () => {
  const clock = createAnimationClock({
    entries: [entry("a", { timeRate: "one" }), entry("b")], selected: ["a"],
    evaluate: () => 1,
    dependsOnTime(_expression, selected) {
      assert.ok(Object.isFrozen(selected));
      assert.equal(selected.add, undefined);
      assert.equal(selected.delete, undefined);
      assert.equal(selected.size, 1);
      assert.deepEqual([...selected], ["a"]);
      assert.deepEqual([...selected.keys()], ["a"]);
      assert.deepEqual([...selected.values()], ["a"]);
      assert.deepEqual([...selected.entries()], [["a", "a"]]);
      selected.forEach((value, key, set) => { assert.equal(value, key); assert.equal(set, selected); });
      return false;
    }
  });
  assert.equal(clock.valuesAt(1).get("a"), 1);
});

test("invalid options and unavailable evaluators do not produce valid-looking frames", () => {
  for (const options of [
    {}, { entries: null }, { entries: [], evaluate: 3 }, { entries: [], dependsOnTime: true },
    { entries: [], maxSyncSteps: -1 }, { entries: [], maxAsyncSteps: 1.5 },
    { entries: [], checkpointInterval: 0 }
  ]) errorCode(() => createAnimationClock(options), "INVALID_OPTION");
  errorCode(() => createAnimationClock({ entries: [entry("t", { expression: [] })] }), "INVALID_EXPRESSION");
  errorCode(() => createAnimationClock({ entries: [entry("t", { expression: "needs evaluator" })] }), "EVALUATION_FAILED");
  errorCode(() => createAnimationClock({ entries: [entry("t", { expression: "bad" })], evaluate: () => { throw null; } }), "EVALUATION_FAILED");
});
