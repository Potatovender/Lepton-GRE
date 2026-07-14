import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const requiredFiles = [
  "index.html",
  "app.html",
  "src/landing.js",
  "src/browser-preview-live.js",
  "src/math/expression-syntax.js",
  "src/math/expression-syntax.d.ts",
  "src/styles.css",
  "src/assets/lepton-favicon.png",
  "src/assets/lepton-logo.png",
  "src/assets/lepton-logo-transparent.png",
  "src/assets/hero-field.png",
  "src/assets/sample-fire.png",
  "src/assets/sample-mandelbrot.png",
  "src/assets/sample-ripple.png",
  "src/assets/sample-contour.png",
  "sample code/fire"
];

for (const file of requiredFiles) {
  const content = await readFile(file, "utf8");
  if (!content.trim()) {
    throw new Error(`${file} is empty`);
  }
}

const index = await readFile("index.html", "utf8");
for (const asset of ["src/landing.js", "src/styles.css", "src/assets/lepton-favicon.png", "src/assets/lepton-logo-transparent.png"]) {
  if (!index.includes(asset)) {
    throw new Error(`index.html does not reference ${asset}`);
  }
}

const app = await readFile("app.html", "utf8");
for (const asset of ["src/browser-preview-live.js", "src/styles.css", "src/assets/lepton-favicon.png", "src/assets/lepton-logo-transparent.png"]) {
  if (!app.includes(asset)) {
    throw new Error(`app.html does not reference ${asset}`);
  }
}

await run(process.execPath, ["--check", "src/browser-preview-live.js"]);
await run(process.execPath, ["--check", "src/math/expression-syntax.js"]);
await run(process.execPath, ["--check", "src/landing.js"]);
await run(process.execPath, ["scripts/check-editor-symbols.mjs"]);

console.log("Build verification passed.");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}
