import { test } from "node:test";
import assert from "node:assert/strict";
import { sceneProgramKey, sceneDiagnosticKey } from "../src/compiler/scene-keys.js";
import { DEFAULT_SCENE, createSceneRuntime } from "../src/compiler/scene-runtime.js";

function scene() {
  return { ...structuredClone(DEFAULT_SCENE),
    functions: [{ id: "t", kind: "slider", time: true, timeMode: "unbounded", expression: "1", _uid: "time" },
      { id: "eq", kind: "variable", expression: "sin(t+x)", _uid: "eq" }],
    draws: [{ equationId: "eq", components: [], _uid: "draw" }],
    colors: [{ id: "ink", red: "255", green: "0", blue: "0" }],
    points: [{ id: "p", x: "1", y: "2", hidden: false }] };
}

test("program keys ignore UID, comments, folder layout and frame-uniform settings", () => {
  const a = scene(), b = structuredClone(a);
  b.functions[0].expression = "123.4";
  b.functions[1]._uid = "new"; b.functions[1].comment = "changed";
  b.functions.push({ type: "comment", text: "not GLSL", _uid: "note" });
  b.folders = [{ id: "group", collapsed: true }]; b.dataOrder = ["draw", "eq"];
  b.settings.randomSeed = 77; b.settings.xMin = -50; b.settings.showCoordinateGrid = false;
  b.settings.backgroundColor = "ink"; b.settings.drawOnlyInsideBoundary = true;
  assert.equal(sceneProgramKey(a), sceneProgramKey(b));
  assert.notEqual(sceneDiagnosticKey(a), sceneDiagnosticKey(b));
  assert.equal(sceneProgramKey(a), sceneProgramKey(structuredClone(a)));
});

test("program keys change for each shader-affecting declaration and setting", () => {
  const a = scene(), original = sceneProgramKey(a);
  const changes = [
    (s) => { s.functions[1].expression = "cos(t+x)"; },
    (s) => { s.functions[0].time = false; },
    (s) => { s.lists.push({ id: "values", expression: "[1,2]" }); },
    (s) => { s.colors[0].red = "100"; },
    (s) => { s.restrictions.push({ id: "edge", expression: "x" }); },
    (s) => { s.transparencies.push({ id: "alpha", expression: "0.5" }); },
    (s) => { s.points[0].x = "5"; },
    (s) => { s.draws[0].hidden = true; },
    (s) => { s.draws[0].arguments = ["2"]; },
    (s) => { s.settings.maxRecursion = 12; },
    (s) => { s.settings.maxListSize = 10; },
    (s) => { s.settings.angleMode = "degrees"; }
  ];
  for (const change of changes) { const b = structuredClone(a); change(b); assert.notEqual(sceneProgramKey(b), original, String(change)); }
});

test("draw ordering is preserved in program keys", () => {
  const a = scene(); a.draws.push({ equationId: "eq", components: [{ type: "color", id: "ink" }] });
  const b = structuredClone(a); b.draws.reverse();
  assert.notEqual(sceneProgramKey(a), sceneProgramKey(b));
});

test("valid scalar time changes reuse keys and actually produce identical GLSL", () => {
  const a = scene(), b = structuredClone(a), runtime = createSceneRuntime();
  b.functions[0].expression = "42";
  runtime.setScene(a); const first = runtime.buildFragmentShader();
  runtime.setScene(b); const second = runtime.buildFragmentShader();
  assert.equal(sceneProgramKey(a), sceneProgramKey(b)); assert.equal(first, second);
});

test("invalid time expressions must not collide with different generated shader contents", () => {
  const a = scene(), b = structuredClone(a), runtime = createSceneRuntime();
  b.functions[0].expression = "bad(";
  runtime.setScene(a); const first = runtime.buildFragmentShader();
  runtime.setScene(b); const second = runtime.buildFragmentShader();
  assert.notEqual(first, second, "Fixture must change actual generated shader contents");
  assert(sceneProgramKey(a) !== sceneProgramKey(b), "Valid and invalid time definitions collide while compiler skips different draw layers");
});

test("diagnostic keys react to validation-relevant definitions", () => {
  const a = scene(); const b = structuredClone(a);
  b.functions[1].id = "sin";
  assert.notEqual(sceneDiagnosticKey(a), sceneDiagnosticKey(b));
});
