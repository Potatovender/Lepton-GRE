import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const directory = "src/libs/mathquill";
const manifest = JSON.parse(await readFile(`${directory}/vendor.json`, "utf8"));
const checkOnly = process.argv.includes("--check");
const verified = [];
for (const [file, hash] of Object.entries(manifest.assets)) {
  const path = `${directory}/${file}`;
  let buffer;
  if (checkOnly) buffer = await readFile(path);
  else {
    const response = await fetch(`https://cdn.jsdelivr.net/npm/${manifest.package}@${manifest.version}/dist/${file}`);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    buffer = Buffer.from(await response.arrayBuffer());
  }
  if (createHash("sha256").update(buffer).digest("hex") !== hash) throw new Error(`${file}: vendor integrity mismatch; existing assets were not replaced.`);
  verified.push([path, buffer]);
}
// Validate the complete pair before replacing either asset.
if (!checkOnly) for (const [path, buffer] of verified) await writeFile(path, buffer);
console.log(`MathQuill ${manifest.version}: ${checkOnly ? "verified" : "restored"} pinned assets.`);
