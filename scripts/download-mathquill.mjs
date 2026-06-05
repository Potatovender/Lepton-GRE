import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const ASSETS = [
  {
    url: "https://cdn.jsdelivr.net/npm/@desmos-community/mathquill@latest/dist/index.global.js",
    dest: "src/libs/mathquill/index.global.js"
  },
  {
    url: "https://cdn.jsdelivr.net/npm/@desmos-community/mathquill@latest/dist/style.css",
    dest: "src/libs/mathquill/style.css"
  }
];

console.log("Starting MathQuill asset download...");

for (const asset of ASSETS) {
  try {
    console.log(`Fetching ${asset.url} -> ${asset.dest}`);
    const response = await fetch(asset.url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(asset.dest), { recursive: true });
    await writeFile(asset.dest, buffer);
    console.log(`Saved ${asset.dest}`);
  } catch (error) {
    console.error(`Failed to download ${asset.url}:`, error.message);
    process.exit(1);
  }
}

console.log("MathQuill assets downloaded successfully!");
