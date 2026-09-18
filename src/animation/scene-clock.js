import { createSceneRuntime, DEFAULT_SCENE } from "../compiler/scene-runtime.js";
import { createAnimationClock, AnimationClockError } from "./clock.js";

/**
 * Freeze an applied scene for playback/export. The caller can keep editing its source.
 * Only actual time sliders advance; folder visibility and live play/stop flags do not
 * affect selection. Returns the same API as createAnimationClock, including async seeks.
 */
export function createSceneClock(scene, options = {}) {
  const snapshot = structuredClone({
    ...DEFAULT_SCENE, ...scene,
    settings: { ...DEFAULT_SCENE.settings, ...scene?.settings }
  });
  const runtime = createSceneRuntime();
  runtime.setScene(snapshot);
  const functions = runtime.dataEntries(snapshot.functions);
  const entries = functions.filter((entry) => entry.kind === "slider" && entry.time);
  const timeIds = new Set(entries.map((entry) => entry.id));
  for (const id of timeIds) {
    const names = [...functions, ...runtime.dataEntries(snapshot.lists)].filter((entry) => entry.id === id);
    if (names.length !== 1) throw new AnimationClockError("DUPLICATE_ID", `Time variable "${id}" has an ambiguous value definition.`, { entryId: id });
  }
  const definitions = runtime.sceneFunctionEnv(true);
  const baseEnv = runtime.buildRuntimeEnv(definitions);
  const compiled = new Map();

  function expressionInfo(expression) {
    const source = String(expression);
    if (compiled.has(source)) return compiled.get(source);
    // The existing typed collection plan resolves user functions, parameter shadowing,
    // point components and scoped reduction indices. Do not approximate this with a
    // name regex: sum(x=1~3){x} has no free coordinate, despite containing several x's.
    const collection = runtime.collectionPlan(source, definitions);
    if (collection.kind !== "scalar") throw new Error("Time expressions must return a scalar, not a list or point.");
    const dependencies = planDependencies(collection.plan, timeIds, runtime);
    if (dependencies.coordinates.size) {
      throw new Error(`Time expressions cannot depend on coordinates: ${[...dependencies.coordinates].sort().join(", ")}.`);
    }
    const result = { evaluate: runtime.compileExpression(source), times: dependencies.times };
    compiled.set(source, result);
    return result;
  }

  function evaluate(expression, values) {
    const compiledExpression = expressionInfo(expression);
    // Each evaluation owns its recursion/local state. Lazy time closures also support
    // cross-clock starting expressions without eagerly resolving unrelated starts.
    const env = runtime.attachRuntimeGuard(Object.create(baseEnv));
    env.__locals = {};
    for (const id of timeIds) {
      Object.defineProperty(env, id, { value: () => values.get(id), enumerable: true, configurable: true });
    }
    const result = compiledExpression.evaluate(0, 0, env);
    if (!Number.isFinite(result)) throw new Error("Time expression did not evaluate to a finite scalar.");
    return result;
  }

  return createAnimationClock({
    ...options, entries, evaluate,
    dependsOnTime: (expression, selected) => [...expressionInfo(expression).times].some((id) => selected.has(id))
  });
}

// Walk the compiler's already-resolved plan. Memoize by node and query because a
// collection's length may be constant even though its element values depend on time.
function planDependencies(root, timeIds, runtime) {
  const times = new Set();
  const coordinates = new Set();
  const seenValues = new WeakSet();
  const seenLengths = new WeakSet();
  function visit(node, lengthOnly = false) {
    if (!node) return;
    const seen = lengthOnly ? seenLengths : seenValues;
    if (seen.has(node)) return;
    seen.add(node);
    if (lengthOnly) {
      if (node.items) return;
      if (node.tag === "lift") { node.args.filter((part) => part.kind === "list").forEach((part) => visit(part, true)); return; }
      visit(node.lower);
      if (node.tag === "comprehension") visit(node.upper);
      else visit(node.body, true);
      return;
    }
    if (node.tag === "scalar") {
      const parsed = runtime.parseLeptonText(node.source);
      if (parsed.type === "identifier") {
        const id = parsed.name.replace(/^~|~$/g, "");
        if (timeIds.has(id)) times.add(id);
        if (id === "x" || id === "y") coordinates.add(id);
      }
      return;
    }
    if (node.tag === "length") { visit(node.target, true); return; }
    if (node.tag === "index") {
      visit(node.index);
      const index = node.index.tag === "number" ? node.index.value : node.index.tag === "scalar" && /^\d+$/.test(node.index.source) ? Number(node.index.source) : NaN;
      if (Number.isInteger(index) && node.target.items?.[index]) visit(node.target.items[index]);
      else visit(node.target);
      return;
    }
    for (const item of node.items ?? node.args ?? []) visit(item);
    visit(node.lower);
    visit(node.upper);
    visit(node.body);
    for (const branch of node.branches ?? []) { visit(branch.condition); visit(branch.value); }
    visit(node.fallback);
  }
  visit(root);
  return { times, coordinates };
}
