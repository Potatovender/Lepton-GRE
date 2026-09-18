const MODES = new Set(["unbounded", "bounded_looped", "bounded"]);
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

export class AnimationClockError extends Error {
  constructor(code, message, details = {}) {
    super(message, details.cause ? { cause: details.cause } : undefined);
    this.name = "AnimationClockError";
    this.code = code;
    Object.assign(this, details);
  }
}

function fail(code, message, details) {
  throw new AnimationClockError(code, message, details);
}

function integer(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    fail("INVALID_OPTION", `${name} must be a safe integer >= ${minimum}.`);
  }
  return value;
}

function secondsValue(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    fail("INVALID_TIME", "Animation time must be a finite, non-negative number.");
  }
}

function numericLiteral(expression) {
  return typeof expression === "number" || (typeof expression === "string" && NUMBER.test(expression.trim()));
}

// Object.freeze(new Map()) still permits set/delete. This facade cannot mutate its backing state.
function readonlyValues(ids, read) {
  const idSet = new Set(ids);
  const view = {
    size: ids.length,
    has: (id) => idSet.has(id),
    get: (id) => idSet.has(id) ? read(id) : undefined,
    keys: () => ids.values(),
    *values() { for (const id of ids) yield read(id); },
    *entries() { for (const id of ids) yield [id, read(id)]; },
    [Symbol.iterator]() { return this.entries(); },
    forEach(callback, thisArg) { for (const id of ids) callback.call(thisArg, read(id), id, view); }
  };
  return Object.freeze(view);
}

function readonlyIds(ids) {
  const set = new Set(ids);
  const view = {
    size: set.size,
    has: (id) => set.has(id),
    keys: () => set.keys(),
    values: () => set.values(),
    entries: () => set.entries(),
    [Symbol.iterator]: () => set.values(),
    forEach(callback, thisArg) { for (const id of set) callback.call(thisArg, id, id, view); }
  };
  return Object.freeze(view);
}

function overrides(source, ids, name) {
  const isMap = source && typeof source.get === "function" && typeof source[Symbol.iterator] === "function";
  const result = new Map(isMap ? source : Object.entries(source ?? {}));
  for (const id of result.keys()) {
    if (!ids.has(id)) fail("UNKNOWN_CLOCK", `${name} contains unknown time variable "${id}".`, { entryId: id });
  }
  return result;
}

function modulo(value, period) {
  const remainder = value % period;
  return remainder < 0 ? remainder + period : remainder === 0 ? 0 : remainder;
}

function advance(entry, value, direction, elapsed, parameters) {
  const { rate, min, max } = parameters;
  const delta = elapsed * rate;
  let result;
  if (entry.timeMode === "unbounded") {
    result = value + delta;
  } else if (min === max) {
    result = min;
  } else if (entry.timeMode === "bounded_looped") {
    // Preserve an explicitly chosen maximum at frame zero and while stationary.
    result = delta === 0 && value >= min && value <= max ? value : min + modulo(value - min + delta, max - min);
  } else {
    const base = Math.max(min, Math.min(max, value));
    if (delta === 0) return { value: base, direction };
    const span = max - min;
    const offset = modulo(base - min + direction * delta, 2 * span);
    result = min + (offset <= span ? offset : 2 * span - offset);
    // Direction is a multiplier of the signed rate, not an unsigned velocity.
    if (offset === 0) direction = Math.sign(rate);
    else if (offset === span) direction = -Math.sign(rate);
    else direction *= offset < span ? 1 : -1;
  }
  if (!Number.isFinite(delta) || !Number.isFinite(result)) {
    fail("NON_FINITE_VALUE", `Time variable "${entry.id}" exceeded finite numeric precision.`, { entryId: entry.id });
  }
  return { value: result, direction };
}

/**
 * A DOM-independent clock over a frozen list of time entries (not the entire scene).
 * The evaluator owns a frozen scene/seed, must be synchronous and pure, and rejects
 * coordinate-dependent or non-scalar expressions. Its values argument is a ReadonlyMap.
 * During start resolution get(id) is lazy: resolve only referenced IDs, not the entire map.
 * dependsOnTime must check transitive dependencies on the supplied selected IDs; without
 * it every non-literal rate/range is conservatively treated as time-dependent.
 *
 * Dynamic clocks use simultaneous forward Euler at stepSeconds (default 1/120).
 * Bounds and rates are sampled from the PREVIOUS lattice state. A shrinking bounce
 * range clamps the old value before advancing; loops wrap; a zero-width range holds.
 * Sub-step queries take a disposable partial step, never advancing cached simulation.
 * This is a deterministic discrete model, not an adaptive differential-equation solver.
 * See clock.d.ts for options, limits, and the public API.
 */
export function createAnimationClock(options = {}) {
  const {
    entries: source, evaluate, dependsOnTime, stepSeconds = 1 / 120,
    maxSyncSteps = 10000, maxAsyncSteps = 1000000,
    checkpointInterval = 120, maxCheckpoints = 32
  } = options;
  if (!Array.isArray(source)) fail("INVALID_OPTION", "entries must be an array of time variables.");
  if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) fail("INVALID_OPTION", "stepSeconds must be positive and finite.");
  integer(maxSyncSteps, "maxSyncSteps");
  integer(maxAsyncSteps, "maxAsyncSteps");
  integer(checkpointInterval, "checkpointInterval", 1);
  integer(maxCheckpoints, "maxCheckpoints", 1);
  if (evaluate !== undefined && typeof evaluate !== "function") fail("INVALID_OPTION", "evaluate must be a function.");
  if (dependsOnTime !== undefined && typeof dependsOnTime !== "function") fail("INVALID_OPTION", "dependsOnTime must be a function.");

  const byId = new Map();
  for (const raw of source) {
    if (!raw || typeof raw.id !== "string" || !raw.id.trim()) fail("INVALID_ID", "Time variables must have a non-empty ID.");
    if (byId.has(raw.id)) fail("DUPLICATE_ID", `Duplicate time variable "${raw.id}".`, { entryId: raw.id });
    const entry = {
      id: raw.id, expression: raw.expression ?? "", timeMode: raw.timeMode ?? "bounded",
      timeRate: raw.timeRate ?? "1", sliderMin: raw.sliderMin ?? "0", sliderMax: raw.sliderMax ?? "10"
    };
    if (!MODES.has(entry.timeMode)) fail("INVALID_MODE", `Unknown time mode "${entry.timeMode}".`, { entryId: entry.id });
    for (const key of ["expression", "timeRate", "sliderMin", "sliderMax"]) {
      if (typeof entry[key] !== "string" && typeof entry[key] !== "number") {
        fail("INVALID_EXPRESSION", `${entry.id}.${key} must be a scalar expression.`, { entryId: entry.id, property: key });
      }
    }
    byId.set(entry.id, Object.freeze(entry));
  }
  // Canonical order also keeps evaluation/error ordering independent of declaration order.
  const ids = [...byId.keys()].sort();
  const entries = ids.map((id) => byId.get(id));
  const starts = overrides(options.starts, byId, "starts");
  const directions = overrides(options.directions, byId, "directions");
  if (typeof options.selected === "string") fail("INVALID_OPTION", "selected must be an iterable of IDs, not a string.");
  const selected = new Set(options.selected ?? ids);
  for (const id of selected) if (!byId.has(id)) fail("UNKNOWN_CLOCK", `Selected time variable "${id}" does not exist.`, { entryId: id });
  const selectedView = readonlyIds([...selected].sort());

  function scalar(expression, values, entry, property) {
    let result;
    try {
      if (typeof expression !== "string" && typeof expression !== "number") throw new TypeError("Expected a scalar expression.");
      if (typeof expression === "string" && !expression.trim()) throw new TypeError("Empty scalar expression.");
      if (numericLiteral(expression)) result = Number(expression);
      else if (evaluate) result = evaluate(expression, values);
      else throw new TypeError("Supply evaluate to resolve scalar expressions.");
    } catch (cause) {
      if (cause instanceof AnimationClockError) throw cause;
      fail("EVALUATION_FAILED", `Cannot evaluate ${entry.id}.${property}: ${cause?.message ?? cause}`, { entryId: entry.id, property, cause });
    }
    if (!Number.isFinite(result)) fail("INVALID_SCALAR", `${entry.id}.${property} must evaluate to a finite number.`, { entryId: entry.id, property });
    return result;
  }

  const startValues = new Map();
  const resolving = new Set();
  const initialView = readonlyValues(ids, resolveStart);
  function resolveStart(id) {
    if (startValues.has(id)) return startValues.get(id);
    if (resolving.has(id)) fail("CIRCULAR_START", `Circular starting values: ${[...resolving, id].join(" -> ")}.`, { entryId: id });
    const entry = byId.get(id);
    resolving.add(id);
    try {
      const value = scalar(starts.has(id) ? starts.get(id) : entry.expression, initialView, entry, "start");
      startValues.set(id, value);
      return value;
    } finally {
      resolving.delete(id);
    }
  }
  ids.forEach(resolveStart);

  function parameters(entry, values) {
    const rate = scalar(entry.timeRate, values, entry, "timeRate");
    if (entry.timeMode === "unbounded") return { rate };
    const min = scalar(entry.sliderMin, values, entry, "sliderMin");
    const max = scalar(entry.sliderMax, values, entry, "sliderMax");
    if (min > max || !Number.isFinite(max - min) || (entry.timeMode === "bounded" && !Number.isFinite(2 * (max - min)))) {
      fail("INVALID_RANGE", `Time variable "${entry.id}" needs a finite range with minimum <= maximum.`, { entryId: entry.id });
    }
    return { rate, min, max };
  }

  const startDirections = new Map();
  const initialParameters = new Map();
  const dynamic = new Set();
  for (const entry of entries) {
    const direction = directions.has(entry.id) ? directions.get(entry.id) : 1;
    if (direction !== 1 && direction !== -1) fail("INVALID_DIRECTION", `Direction for "${entry.id}" must be 1 or -1.`, { entryId: entry.id });
    startDirections.set(entry.id, direction);
    const params = parameters(entry, initialView);
    initialParameters.set(entry.id, params);
    const start = startValues.get(entry.id);
    if (entry.timeMode !== "unbounded" && (start < params.min || start > params.max)) {
      fail("START_OUT_OF_RANGE", `Start for "${entry.id}" must be inside [${params.min}, ${params.max}].`, { entryId: entry.id });
    }
    if (!selected.has(entry.id)) continue;
    const expressions = entry.timeMode === "unbounded" ? [entry.timeRate] : [entry.timeRate, entry.sliderMin, entry.sliderMax];
    for (const expression of expressions) {
      if (numericLiteral(expression)) continue;
      const dependent = dependsOnTime ? dependsOnTime(expression, selectedView) : true;
      if (typeof dependent !== "boolean") fail("INVALID_DEPENDENCY", "dependsOnTime must return a boolean.", { entryId: entry.id });
      if (dependent) dynamic.add(entry.id);
    }
  }

  const initial = { values: startValues, directions: startDirections };
  const checkpoints = new Map([[0, initial]]);
  let generation = 0;

  function remember(tick, state) {
    if (!tick || maxCheckpoints === 1) return;
    checkpoints.delete(tick);
    checkpoints.set(tick, state);
    while (checkpoints.size > maxCheckpoints) {
      const oldest = [...checkpoints.keys()].find((key) => key !== 0);
      checkpoints.delete(oldest);
    }
  }

  function calculate(previous, elapsed, absoluteSeconds) {
    const values = new Map();
    const nextDirections = new Map();
    const previousView = readonlyValues(ids, (id) => previous.values.get(id));
    for (const entry of entries) {
      const id = entry.id;
      let next;
      if (!selected.has(id)) next = { value: startValues.get(id), direction: startDirections.get(id) };
      else if (dynamic.has(id)) next = advance(entry, previous.values.get(id), previous.directions.get(id), elapsed, parameters(entry, previousView));
      else next = advance(entry, startValues.get(id), startDirections.get(id), absoluteSeconds, initialParameters.get(id));
      values.set(id, next.value);
      nextDirections.set(id, next.direction);
    }
    return { values, directions: nextDirections };
  }

  function query(seconds, maxSteps) {
    secondsValue(seconds);
    integer(maxSteps, "maxSteps");
    let target = 0;
    let remainder = 0;
    if (dynamic.size && seconds > 0) {
      const scaled = seconds / stepSeconds;
      if (!Number.isFinite(scaled) || scaled > Number.MAX_SAFE_INTEGER) fail("TIME_RESOLUTION", "Time exceeds the fixed-step clock's index precision.");
      const nearest = Math.round(scaled);
      const tolerance = Math.min(1e-7, 4 * Number.EPSILON * Math.max(1, scaled));
      const aligned = nearest > 0 && Math.abs(scaled - nearest) <= tolerance;
      target = aligned ? nearest : Math.floor(scaled);
      remainder = aligned ? 0 : seconds - target * stepSeconds;
    }
    let tick = 0;
    let state = initial;
    for (const [candidate, saved] of checkpoints) {
      if (candidate <= target && candidate > tick) { tick = candidate; state = saved; }
    }
    const requiredSteps = dynamic.size ? target - tick + (remainder > 0 ? 1 : 0) : 0;
    if (requiredSteps > maxSteps) {
      fail("STEP_BUDGET", `This seek needs ${requiredSteps} steps (budget ${maxSteps}); use the yielding API or increase its budget.`, { requiredSteps, maxSteps });
    }
    return { seconds, target, remainder, tick, state, generation, requiredSteps, completedSteps: 0 };
  }

  function checkJob(job, signal) {
    if (signal?.aborted) fail("ABORTED", "Animation evaluation was cancelled.");
    if (job.generation !== generation) fail("RESET", "Animation clock was reset during evaluation.");
  }

  function step(job) {
    const state = calculate(job.state, stepSeconds, (job.tick + 1) * stepSeconds);
    checkJob(job);
    job.state = state;
    job.tick += 1;
    job.completedSteps += 1;
    if (job.tick % checkpointInterval === 0) remember(job.tick, job.state);
  }

  function finish(job) {
    if (job.seconds === 0) return initial;
    if (!dynamic.size) return calculate(initial, job.seconds, job.seconds);
    remember(job.tick, job.state);
    if (job.remainder > 0) {
      const state = calculate(job.state, job.remainder, job.seconds);
      job.completedSteps += 1;
      return state;
    }
    return job.state;
  }

  function publicState(state) {
    return {
      values: new Map(ids.map((id) => [id, state.values.get(id)])),
      directions: new Map(ids.map((id) => [id, state.directions.get(id)]))
    };
  }

  function stateAt(seconds, { maxSteps = maxSyncSteps } = {}) {
    const job = query(seconds, maxSteps);
    while (job.tick < job.target) { checkJob(job); step(job); }
    checkJob(job);
    const result = publicState(finish(job));
    checkJob(job);
    return result;
  }

  async function stateAtAsync(seconds, {
    maxSteps = maxAsyncSteps, yieldEverySteps = 240, yieldAfterMs = 8,
    yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)), signal, onProgress
  } = {}) {
    integer(yieldEverySteps, "yieldEverySteps", 1);
    if (!Number.isFinite(yieldAfterMs) || yieldAfterMs <= 0) fail("INVALID_OPTION", "yieldAfterMs must be positive and finite.");
    if (typeof yieldControl !== "function" || (onProgress !== undefined && typeof onProgress !== "function")) fail("INVALID_OPTION", "Yield and progress callbacks must be functions.");
    const job = query(seconds, maxSteps);
    const progress = (done = false) => onProgress?.({
      completedSteps: job.completedSteps, totalSteps: job.requiredSteps,
      secondsCompleted: done ? seconds : job.tick * stepSeconds, secondsTarget: seconds
    });
    checkJob(job, signal);
    progress();
    // Yield before a long seek as well as between batches so controls can paint immediately.
    if (job.requiredSteps > 0) await yieldControl();
    checkJob(job, signal);
    while (job.tick < job.target) {
      const start = performance.now();
      let count = 0;
      do {
        checkJob(job, signal);
        step(job);
        count += 1;
      } while (job.tick < job.target && count < yieldEverySteps && performance.now() - start < yieldAfterMs);
      progress();
      if (job.tick < job.target || job.remainder > 0) await yieldControl();
      checkJob(job, signal);
    }
    checkJob(job, signal);
    const result = publicState(finish(job));
    progress(true);
    checkJob(job, signal);
    return result;
  }

  return Object.freeze({
    valuesAt: (seconds, limits) => stateAt(seconds, limits).values,
    valuesAtAsync: async (seconds, limits) => (await stateAtAsync(seconds, limits)).values,
    stateAt, stateAtAsync,
    reset() { generation += 1; checkpoints.clear(); checkpoints.set(0, initial); },
    get info() {
      return Object.freeze({
        mode: dynamic.size ? "fixed-step" : "closed-form", stepSeconds,
        clockCount: ids.length, selectedCount: selected.size,
        checkpointCount: checkpoints.size, maxCheckpoints
      });
    }
  });
}
