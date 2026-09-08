import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { SITE_FILES } from "./site-files.mjs";

const version = (await readFile("src/browser-preview-live.js", "utf8")).match(/const APP_VERSION = "([^"]+)";/)?.[1];
if (!version) throw new Error("Missing runtime release version.");
for (const file of ["src/landing.js", "index.html", "app.html"]) {
  if (!(await readFile(file, "utf8")).includes(version)) throw new Error(`${file} has a stale release version.`);
}
let commit = process.env.GITHUB_SHA ?? "uncommitted";
if (commit === "uncommitted") {
  try { commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* Source archives may omit Git metadata. */ }
}
await rm("dist", { recursive: true, force: true });
for (const file of SITE_FILES) {
  const target = `dist/${file}`;
  await mkdir(dirname(target), { recursive: true });
  await cp(file, target);
}
await writeFile("dist/.nojekyll", "");
await writeFile("dist/release.json", JSON.stringify({ version, commit, builtAt: new Date().toISOString() }, null, 2) + "\n");
console.log(`Staged ${SITE_FILES.length} public files in dist/ (${version}).`);
