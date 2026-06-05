import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const requiredFiles = [
  "index.html",
  "src/browser-preview-live.js",
  "src/styles.css",
  "sample code/fire"
];

for (const file of requiredFiles) {
  const content = await readFile(file, "utf8");
  if (!content.trim()) {
    throw new Error(`${file} is empty`);
  }
}

const index = await readFile("index.html", "utf8");
for (const asset of ["src/browser-preview-live.js", "src/styles.css"]) {
  if (!index.includes(asset)) {
    throw new Error(`index.html does not reference ${asset}`);
  }
}

await run(process.execPath, ["--check", "src/browser-preview-live.js"]);
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
