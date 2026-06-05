import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("src/browser-preview-live.js", "utf8");
const sandbox = {
  console,
  structuredClone: globalThis.structuredClone,
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    querySelector: () => ({
      innerHTML: "",
      querySelector: () => null,
      querySelectorAll: () => []
    }),
    addEventListener: () => {}
  },
  window: { addEventListener: () => {}, __leptonForceGradient: false, devicePixelRatio: 1 },
  requestAnimationFrame: () => {},
  InputEvent: function InputEvent() {},
  Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
  getComputedStyle: () => ({ fontSize: "16px" })
};

vm.createContext(sandbox);
vm.runInContext(
  source.replace(/renderApp\(\);\s*$/, "globalThis.__debugLatexFunctions = LATEX_FUNCTIONS;"),
  sandbox
);

const functionNames = Object.keys(sandbox.__debugLatexFunctions);

check("1/1 renders as one fraction", () => {
  const html = sandbox.renderEditableLatex("1/1");
  assert(count(html, "mq-frac") === 1, html);
  assert(!html.includes("1/1"), html);
});

check("nested absolute bars serialize as nested abs calls", () => {
  const expression = sandbox.latexToExpression("|x+ |y| |").replace(/\s+/g, "");
  assert(expression === "abs(x+abs(y))", expression);
});

check("nested absolute bars render as paired visual delimiters", () => {
  const html = sandbox.renderEditableLatex("|x+ |y| |");
  assert(count(html, 'data-command="abs"') === 2, html);
  assert(!html.includes("abs()"), html);
});

check("all program functions render from typed call form", () => {
  for (const name of functionNames) {
    const args = sampleArgs(name);
    const expression = `${sandbox.__debugLatexFunctions[name].internal}(${args.join(",")})`;
    const html = sandbox.renderEditableLatex(expression);
    assert(html.includes(`data-command="${name}"`) || html.includes(`latex-${name}`), `${name}: ${html}`);
  }
});

check("all program functions compile, validate, and convert to GLSL", () => {
  for (const name of functionNames) {
    const args = sampleArgs(name);
    const expression = `${sandbox.__debugLatexFunctions[name].internal}(${args.join(",")})`;
    const validation = sandbox.validateExpression(expression, {});
    assert(validation.status === "valid", `${name} validation: ${JSON.stringify(validation)}`);
    const value = sandbox.compileExpression(expression)(0.5, 0.25, {});
    assert(Number.isFinite(value), `${name} compile: ${String(value)}`);
    const glsl = sandbox.expressionToGlsl(expression, {});
    assert(!/\bround\(/.test(glsl), `${name} GLSL should use helper: ${glsl}`);
  }
});

check("operatorname latex imports program function names", () => {
  const expression = sandbox.latexToExpression("\\operatorname{arccot}{x}");
  assert(expression === "arccot(x)", expression);
});

check("fractions, radicals, and nested exponents compile", () => {
  const html = sandbox.renderEditableLatex("sqrt((x^2+y^2)/(sin(x)+cos(y)))+x^(y^2)");
  assert(count(html, 'data-command="sqrt"') === 1, html);
  assert(count(html, 'data-command="frac"') === 1, html);
  assert(count(html, 'data-command="power"') >= 3, html);
  const value = sandbox.compileExpression("sqrt((x^2+y^2)/(sin(x)+cos(y)))+x^(y^2)")(1, 1, {});
  assert(Number.isFinite(value), String(value));
});

check("custom variables resolve and unknown variables error during validation", () => {
  const env = sandbox.buildRuntimeEnv({ ten: "10" });
  assert(sandbox.compileExpression("ten+1")(0, 0, env) === 11, "ten+1 did not resolve");
  const result = sandbox.validateExpression("missing+1", {});
  assert(result.status === "invalid", JSON.stringify(result));
});

check("malformed expressions are invalid", () => {
  const result = sandbox.validateExpression("sin(2x)+", {});
  assert(result.status === "invalid", JSON.stringify(result));
});

function check(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

function sampleArgs(name) {
  const config = sandbox.__debugLatexFunctions[name];
  const firstArg = {
    arccosh: "2",
    arcsec: "2",
    arccsc: "2",
    arcsech: "0.5",
    arccoth: "2",
    log: "2",
    sqrt: "4",
    cbrt: "8"
  }[name] ?? "0.5";
  if (config.args === 1) return [firstArg];
  if (name === "frac") return ["1", "2"];
  if (name === "min" || name === "max") return ["0.5", "2"];
  if (name === "clamp") return ["0.5", "0", "1"];
  return Array.from({ length: config.args }, (_, index) => (index === 0 ? firstArg : String(index + 1)));
}
