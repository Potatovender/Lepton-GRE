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
  "sample code/fire",
  "README.md",
  "CONTRIBUTING.md",
  "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT.md",
  "docs/LEPTON_LANGUAGE.md",
  ".github/workflows/ci.yml",
  ".editorconfig",
  "package-lock.json"
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

const readme = await readFile("README.md", "utf8");
for (const document of ["docs/ARCHITECTURE.md", "docs/DEVELOPMENT.md", "docs/LEPTON_LANGUAGE.md", "CONTRIBUTING.md"]) {
  if (!readme.includes(document)) {
    throw new Error(`README.md does not link to ${document}`);
  }
}

for (const removedPath of ["src/main.ts", "src/ui/app.ts", "src/model/scene.ts", "src/math/equation.ts"]) {
  if (readme.includes(removedPath)) {
    throw new Error(`README.md still documents removed runtime ${removedPath}`);
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
