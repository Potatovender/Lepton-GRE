import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const [, , command, scriptName] = process.argv;

if (command !== "run" || !scriptName) {
  console.error("This local npm shim supports: npm run <script>");
  process.exit(1);
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const script = packageJson.scripts?.[scriptName];

if (!script) {
  console.error(`Missing script: ${scriptName}`);
  process.exit(1);
}

const child = spawn(script, {
  shell: true,
  stdio: "inherit",
  env: {
    ...process.env,
    PATH: `${process.cwd()}/node_modules/.bin:${process.env.PATH ?? ""}`
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
