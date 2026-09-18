import { SnapshotRenderer } from "./snapshot-renderer.js?v=20260917-responsive-video";
import { createSceneClock } from "../animation/scene-clock.js?v=20260917-responsive-video";
import { createSceneRuntime, DEFAULT_SCENE } from "./scene-runtime.js?v=20260917-responsive-video";
import { AnimationClockError } from "../animation/clock.js?v=20260917-responsive-video";

const renderer = new SnapshotRenderer();
let active = null;
let playback = null;

const timeEntries = (scene) => (scene.functions ?? []).filter((entry) => entry.type !== "comment" && entry.kind === "slider" && entry.time);
const overrideMap = (values) => new Map(values instanceof Map ? values : Object.entries(values ?? {}));

function sceneRuntime(scene) {
  const runtime = createSceneRuntime();
  runtime.setScene({ ...DEFAULT_SCENE, ...scene, settings: { ...DEFAULT_SCENE.settings, ...scene.settings } });
  return runtime;
}

// Reuse the compiler's scoped plans so aliases, user functions, lists and point
// components participate in invalidation without including unrelated drawing data.
function clockKey(scene, animation) {
  const runtime = sceneRuntime(scene);
  const definitions = runtime.sceneFunctionEnv(true);
  const plans = timeEntries(scene).map((entry) => {
    const properties = entry.timeMode === "unbounded" ? ["timeRate"] : ["timeRate", "sliderMin", "sliderMax"];
    const formulas = properties.map((property) => {
      try {
        const source = entry[property] ?? ({ timeRate: "1", sliderMin: "0", sliderMax: "10" })[property];
        const plan = runtime.collectionPlan(String(source), definitions).plan;
        const seen = new WeakMap();
        let next = 0;
        // Plans share subtrees. Serialize the DAG, not an exponentially expanded tree.
        return JSON.stringify(plan, (_key, value) => {
          if (typeof value === "function") return undefined;
          if (value && typeof value === "object") {
            if (seen.has(value)) return { ref: seen.get(value) };
            seen.set(value, next++);
          }
          return value;
        });
      } catch (cause) {
        throw new AnimationClockError("EVALUATION_FAILED", `Cannot evaluate ${entry.id}.${property}: ${cause.message}`, { entryId: entry.id, property, cause });
      }
    });
    return [entry.id, entry._uid, entry.timeMode ?? "bounded", formulas];
  }).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const settings = runtime.getScene().settings;
  return JSON.stringify([plans, [...animation.selected].sort(), settings.angleMode, settings.maxRecursion, settings.maxListSize, settings.randomSeed]);
}

function sceneEditKey(scene) {
  return JSON.stringify({ ...scene, functions: (scene.functions ?? []).map((entry) =>
    entry.kind === "slider" && entry.time ? { ...entry, expression: null } : entry) });
}

function sameEntry(previous, entry) {
  return previous && (entry._uid && previous._uid ? entry._uid === previous._uid : entry.id === previous.id);
}

function publishedValue(entry, value, settings) {
  let formatted;
  if (Math.abs(value) < 1e-12) formatted = 0;
  else if (entry.timeMode === "unbounded") {
    const places = Math.max(0, Math.min(12, Math.trunc(Number(settings.unboundedDecimalPlaces ?? 3)) || 0));
    formatted = Number(value.toFixed(places));
  } else formatted = Number(value.toPrecision(6));
  return { value, formatted };
}

function isEcho(source, published) {
  if (!published || !String(source).trim()) return false;
  const value = Number(source);
  return Number.isFinite(value) && (value === published.value || value === published.formatted);
}

// Export keeps createSceneClock's strict range validation. Live playback alone
// reconciles starts after a user moves a boundary across an already-playing value.
function liveClock(scene, options) {
  try { return createSceneClock(scene, options); }
  catch (error) {
    if (error.code !== "START_OUT_OF_RANGE" || !options.selected.includes(error.entryId)) throw error;
    const probe = structuredClone(scene);
    for (const entry of timeEntries(probe)) entry.timeMode = "unbounded";
    let starts = createSceneClock(probe, options).valuesAt(0);
    const runtime = sceneRuntime(scene);
    const definitions = runtime.sceneFunctionEnv(true);
    const compiled = new Map();
    const bounded = timeEntries(scene).filter((entry) => options.selected.includes(entry.id) && entry.timeMode !== "unbounded");
    // Cross-dependent bounds can need several simultaneous passes. Never loop
    // indefinitely when the supplied ranges have no mutually valid starting state.
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const env = runtime.buildRuntimeEnv(definitions);
      for (const [id, value] of starts) env[id] = () => value;
      const scalar = (source) => {
        const text = String(source);
        if (!compiled.has(text)) compiled.set(text, runtime.compileExpression(text));
        return compiled.get(text)(0, 0, env);
      };
      const next = new Map(starts);
      for (const entry of bounded) {
        const min = scalar(entry.sliderMin ?? "0"), max = scalar(entry.sliderMax ?? "10");
        if (![min, max, max - min].every(Number.isFinite) || min > max) {
          throw new AnimationClockError("INVALID_RANGE", `Time variable "${entry.id}" needs a finite range with minimum <= maximum.`, { entryId: entry.id });
        }
        const value = starts.get(entry.id);
        if (value >= min && value <= max) continue;
        if (entry.timeMode === "bounded_looped" && max > min) {
          const remainder = (value - min) % (max - min);
          next.set(entry.id, min + (remainder < 0 ? remainder + max - min : remainder));
        } else next.set(entry.id, Math.max(min, Math.min(max, value)));
      }
      starts = next;
      try { return createSceneClock(scene, { ...options, starts }); }
      catch (nextError) {
        if (nextError.code !== "START_OUT_OF_RANGE" || !options.selected.includes(nextError.entryId)) throw nextError;
        error = nextError;
      }
    }
    throw error;
  }
}

async function previewTimeState(scene, animation, generation, signal) {
  if (!animation?.selected?.length) { playback = null; return undefined; }
  const sampledAt = performance.now();
  const entries = timeEntries(scene);
  if (!playback || playback.generation !== generation) {
    const key = clockKey(scene, animation);
    const editKey = sceneEditKey(scene);
    const providedStarts = overrideMap(animation.starts);
    const providedDirections = overrideMap(animation.directions);
    const changedStarts = new Set();
    const changedDirections = new Set();
    for (const entry of entries) {
      const old = playback?.entries.find((previous) => sameEntry(previous, entry));
      if (!old) { changedStarts.add(entry.id); continue; }
      const source = String(entry.expression ?? "");
      const published = playback.published.get(old.id);
      if (!isEcho(source, published) && (source !== String(old.expression ?? "") || (published && editKey === playback.editKey))) changedStarts.add(entry.id);
      if (providedStarts.has(entry.id) && providedStarts.get(entry.id) !== playback.providedStarts.get(old.id)) changedStarts.add(entry.id);
      if (providedDirections.has(entry.id) && providedDirections.get(entry.id) !== playback.providedDirections.get(old.id)
        && providedDirections.get(entry.id) !== published?.direction) changedDirections.add(entry.id);
    }
    if (!playback || playback.key !== key || changedStarts.size || changedDirections.size) {
      let current = null;
      if (playback) {
        try { current = await playback.clock.stateAtAsync((sampledAt - playback.start) / 1000, { signal }); }
        catch (error) {
          if (!["EVALUATION_FAILED", "INVALID_SCALAR", "INVALID_RANGE", "NON_FINITE_VALUE"].includes(error.code)) throw error;
          current = playback.lastState;
        }
      }
      signal.throwIfAborted();
      const starts = new Map();
      const directions = new Map();
      for (const entry of entries) {
        const old = playback?.entries.find((previous) => sameEntry(previous, entry));
        if (changedStarts.has(entry.id) || !old) {
          if (providedStarts.has(entry.id)) starts.set(entry.id, providedStarts.get(entry.id));
          // Otherwise leave the entry's edited expression to the scalar evaluator.
        } else if (current?.values.has(old.id)) starts.set(entry.id, current.values.get(old.id));
        if (changedDirections.has(entry.id) || !old || !playback.selected.includes(old.id)) directions.set(entry.id, providedDirections.get(entry.id) ?? 1);
        else directions.set(entry.id, current?.directions.get(old.id) ?? 1);
      }
      const clock = liveClock(scene, { ...animation, starts, directions });
      playback = { clock, start: sampledAt, published: playback?.published ?? new Map(), lastState: clock.stateAt(0) };
    }
    Object.assign(playback, { key, editKey, generation, entries: structuredClone(entries), selected: [...animation.selected], providedStarts, providedDirections });
  } else {
    // Newest transient snapshots can carry UI feedback for the last presented frame.
    playback.entries = structuredClone(entries);
  }
  const state = await playback.clock.stateAtAsync((performance.now() - playback.start) / 1000, { signal });
  signal.throwIfAborted();
  playback.lastState = state;
  return state;
}
self.onmessage = async ({ data }) => {
  if (data.type === "cancel") { active?.abort(); return; }
  if (data.type !== "render") return;
  const controller = active = new AbortController();
  const { revision, generation, scene, ...options } = data;
  let evaluatingClock = true;
  try {
    const clockState = await previewTimeState(scene, data.animation, generation, controller.signal);
    evaluatingClock = false;
    if (clockState) for (const entry of scene.functions) if (clockState.values.has(entry.id)) entry.expression = String(clockState.values.get(entry.id));
    renderer.setScene(scene);
    const result = await renderer.render({
      ...options, interactive: true, clockValues: Boolean(clockState), signal: controller.signal,
      onPhase: (phase) => self.postMessage({ type: "phase", revision, phase, transient: Boolean(data.transient) }),
      onDiagnostics: (diagnostics) => self.postMessage({ type: "diagnostics", revision, generation, sceneKey: data.sceneKey, diagnostics })
    });
    controller.signal.throwIfAborted();
    const bitmap = result.canvas.transferToImageBitmap();
    const { canvas, ...details } = result;
    if (clockState && playback) {
      playback.published = new Map(timeEntries(scene).map((entry) => [entry.id, {
        ...publishedValue(entry, clockState.values.get(entry.id), scene.settings), direction: clockState.directions.get(entry.id)
      }]));
    }
    self.postMessage({ type: "frame", revision, generation, sceneKey: data.sceneKey, clockState, ...details, bitmap }, [bitmap]);
  } catch (error) {
    const cancelled = controller.signal.aborted;
    // A clock can fail before setScene/render, including on the very first request.
    // Validate this snapshot before assigning entry indices; never reuse old flags.
    if (evaluatingClock && !cancelled) {
      renderer.setScene(scene);
      renderer.validate();
    }
    const diagnostics = structuredClone(renderer.diagnostics);
    if (!cancelled && error.entryId && diagnostics) {
      const index = scene.functions.findIndex((entry) => entry.id === error.entryId);
      if (index >= 0) diagnostics.functions[index] = { status: "invalid", message: error.message };
      diagnostics.hasErrors = true; diagnostics.summary = error.message;
    }
    if (evaluatingClock && !cancelled) {
      diagnostics.hasErrors = true; diagnostics.summary = error.message;
      self.postMessage({ type: "diagnostics", revision, generation, sceneKey: data.sceneKey, diagnostics });
    }
    self.postMessage({ type: cancelled ? "cancelled" : "error", revision, generation, message: error.message, diagnostics });
  } finally {
    if (active === controller) active = null;
  }
};
