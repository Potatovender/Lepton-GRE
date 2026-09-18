import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sandbox } from "./check-editor-symbols.mjs";
import { createSceneRuntime } from "../src/compiler/scene-runtime.js";

const runtime = createSceneRuntime();
const sources = [
  "expression eq = sin(x)+cos(y)\ncolour c = x~20~30\ndraw(eq){colour=c}",
  "expression bad = sin(\nexpression good = 1\ndraw(good)",
  "function pair(a,b) -> point = [a,b]\nexpression eq = pair(2,3).x\ndraw(eq)",
  "time bounded_looped t = 1 {range=0~4,speed=2}\nexpression eq = sin(t*x)\ndraw(eq)",
  "list values = [i^2 for(i=1,4)]\nexpression eq = sum(i=1~3){i}+values[0]\ndraw(eq)",
  "folder nested = {\nexpression bad = missing\n}\npoint p = [2,3]"
];
for (const file of ["fire", "mandelbrot set", "water effect", "star field", "cinematic clouds", "tree", "lava lamp", "marble cube", "Lepton Logo"]) sources.push(await readFile(`sample code/${file}`, "utf8"));
for (const source of sources) {
  const scene = sandbox.importScene(source);
  sandbox.__debugSetScene(scene);
  runtime.setScene(structuredClone(scene));
  for (const method of ["validateScene", "sceneViewport", "resolveBackgroundColor", "webGlShaderCacheKey", "buildFragmentShader"]) {
    assert.equal(JSON.stringify(runtime[method]()), JSON.stringify(sandbox[method]()), `${method} changed during compiler extraction`);
  }
  const oldEnv = sandbox.buildRuntimeEnv(sandbox.sceneFunctionEnv(true));
  const newEnv = runtime.buildRuntimeEnv(runtime.sceneFunctionEnv(true));
  for (const formula of ["x+y", "sin(x)+cos(y)", "e^(-x^2/3)", "frac{x^2+frac{y}{10}^2}{100}", "sum(i=1~4){i^2}"]) {
    const before = sandbox.compileExpression(formula), after = runtime.compileExpression(formula);
    for (const [x,y] of [[0,0],[1,2],[-2,0.4]]) assert.equal(after(x,y,newEnv), before(x,y,oldEnv), formula);
  }
}
console.log(`ok - isolated compiler matches legacy diagnostics, GLSL, bounds, backgrounds and CPU values for ${sources.length} scenes`);
