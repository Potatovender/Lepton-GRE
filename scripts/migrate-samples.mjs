import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const directory = path.resolve("sample code");
const write = process.argv.includes("--write");
const names = (await readdir(directory)).sort();
let changed = 0;

for (const name of names) {
  const file = path.join(directory, name);
  const source = await readFile(file, "utf8");
  const migrated = migrateSample(source);
  if (migrated === source) continue;
  changed += 1;
  if (write) await writeFile(file, migrated);
  else console.error(`${name} uses legacy sample syntax. Run npm run migrate:samples.`);
}

if (!write && changed) process.exitCode = 1;
else console.log(write ? `Migrated ${changed} sample file(s).` : `Checked ${names.length} modern sample file(s).`);

function migrateSample(source) {
  return source.split("\n").map((line) => {
    const indent = line.match(/^\s*/)?.[0] ?? "";
    const body = line.slice(indent.length);
    if (/^(variable)\s+/i.test(body)) return `${indent}${body.replace(/^variable\b/i, "expression")}`;
    if (/^(time|slider)\s+/i.test(body) && !/\{[^{}]*\}\s*(?:\/\/.*)?$/.test(body)) {
      const commentIndex = body.indexOf("//");
      const code = (commentIndex >= 0 ? body.slice(0, commentIndex) : body).trimEnd();
      const comment = commentIndex >= 0 ? ` ${body.slice(commentIndex)}` : "";
      const properties = [];
      let base = code;
      const speed = base.match(/\s+speed\s+([^\s]+)\s*$/i);
      if (speed) { properties.unshift(`speed=${speed[1]}`); base = base.slice(0, speed.index).trimEnd(); }
      const range = base.match(/\s+range\s+([^\s]+)\s*$/i);
      if (range) { properties.unshift(`range=${range[1]}`); base = base.slice(0, range.index).trimEnd(); }
      if (properties.length) return `${indent}${base} {${properties.join(", ")}}${comment}`;
    }
    if (/^draw\s*\(/i.test(body)) {
      const close = findClosingParen(body, body.indexOf("("));
      if (close > 0 && !body.slice(close + 1).trimStart().startsWith("{")) {
        const fields = splitTopLevel(body.slice(body.indexOf("(") + 1, close));
        if (fields.length > 1 && fields.slice(1).every((field) => field.includes("="))) {
          return `${indent}draw(${fields[0].trim()}) {${fields.slice(1).map((field) => field.trim()).join(", ")}}${body.slice(close + 1)}`;
        }
      }
    }
    return line;
  }).join("\n");
}

function findClosingParen(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")" && --depth === 0) return index;
  }
  return -1;
}

function splitTopLevel(source) {
  const parts = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") round += 1;
    else if (char === ")") round -= 1;
    else if (char === "[") square += 1;
    else if (char === "]") square -= 1;
    else if (char === "{") curly += 1;
    else if (char === "}") curly -= 1;
    else if (char === "," && round === 0 && square === 0 && curly === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}
