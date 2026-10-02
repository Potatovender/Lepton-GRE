import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SCENE, createSceneRuntime } from "../src/compiler/scene-runtime.js";

function fixture() {
  const runtime = createSceneRuntime();
  const scene = {
    ...structuredClone(DEFAULT_SCENE),
    folders: [{ id: "Outer", _uid: "outer" }, { id: "Inner", _uid: "inner" }],
    functions: [{ id: "eq", kind: "variable", expression: "x", _uid: "eq" }],
    draws: [{ equationId: "eq", components: [], _uid: "draw" }],
    dataOrder: [
      { kind: "folders", uid: "outer" },
      { kind: "folders", uid: "inner", parentUid: "outer" },
      { kind: "functions", uid: "eq", parentUid: "inner" },
      { kind: "draws", uid: "draw", parentUid: "inner" }
    ]
  };
  runtime.setScene(scene);
  return { runtime, scene };
}

test("nested folder diagnostics keep one prefix through repeated render updates", () => {
  const { runtime, scene } = fixture();
  scene.functions[0].expression = "missing";
  let diagnostics = runtime.validateScene();
  const message = diagnostics.folders[0].message;
  assert.match(message, /^Folder contains: Unknown variable: missing$/);
  for (let i = 0; i < 4; i++) {
    diagnostics = runtime.applyShaderIssues(structuredClone(diagnostics), [
      { index: 0, status: "info", message: "Graph stayed below 15 FPS" }
    ]);
    for (const folder of diagnostics.folders) {
      assert.equal(folder.status, "invalid");
      assert.equal(folder.message, message);
    }
  }
});

test("folder reaggregation replaces old child diagnostics and preserves priority", () => {
  const { runtime } = fixture();
  const diagnostics = runtime.validateScene();
  for (const [status, message] of [["info", "Slow frame"], ["warning", "Name warning"], ["invalid", "Bad expression"], ["info", "Slow frame"], ["valid", "Valid"]]) {
    diagnostics.draws[0] = { status, message };
    diagnostics.folders = runtime.aggregateFolderDiagnostics(structuredClone(diagnostics));
    for (const folder of diagnostics.folders) {
      assert.equal(folder.status, status);
      assert.equal(folder.message, status === "valid" ? "Folder and contents are valid" : `Folder contains: ${message}`);
    }
  }
  diagnostics.functions[0] = { status: "warning", message: "Name warning" };
  diagnostics.draws[0] = { status: "info", message: "Slow frame" };
  assert.equal(runtime.aggregateFolderDiagnostics(diagnostics)[0].status, "warning");
  diagnostics.draws[0].status = "invalid";
  assert.equal(runtime.aggregateFolderDiagnostics(diagnostics)[0].status, "invalid");
});

test("folder own-name errors survive aggregation and disappear after repair", () => {
  const { runtime, scene } = fixture();
  scene.folders[1].id = "";
  const diagnostics = runtime.applyShaderIssues(runtime.validateScene(), [{ index: 0, status: "info", message: "Slow frame" }]);
  assert.equal(diagnostics.folders[0].status, "invalid");
  assert.equal(diagnostics.folders[0].message, "Folder contains: Folder name cannot be blank");
  scene.folders[1].id = "Inner";
  assert(runtime.validateScene().folders.every((folder) => folder.status === "valid"));
});
