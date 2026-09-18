const omitPresentation = (entry) => Object.fromEntries(Object.entries(entry).filter(([key]) => !["_uid", "comment", "collapsed"].includes(key)));
const data = (entries) => (entries ?? []).filter((entry) => entry?.type !== "comment").map(omitPresentation);

/** Keys describe compilation inputs, not UI placement or frame-uniform values. */
export function sceneProgramKey(scene) {
  return JSON.stringify({
    functions: data(scene.functions).map((entry) => entry.kind === "slider" && entry.time && String(entry.expression).trim() && Number.isFinite(Number(entry.expression)) ? { ...entry, expression: "__time_uniform__" } : entry),
    lists: data(scene.lists), colors: data(scene.colors), restrictions: data(scene.restrictions),
    transparencies: data(scene.transparencies), points: data(scene.points), draws: data(scene.draws),
    maxRecursion: scene.settings.maxRecursion, maxListSize: scene.settings.maxListSize,
    angleMode: scene.settings.angleMode
  });
}

export function sceneDiagnosticKey(scene, clockValues = false) {
  if (!clockValues) return JSON.stringify(scene);
  return JSON.stringify({ ...scene, functions: (scene.functions ?? []).map((entry) =>
    entry.kind === "slider" && entry.time && Number.isFinite(Number(entry.expression))
      ? { ...entry, expression: "__verified_clock_value__" } : entry) });
}
