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

check("LaTeX trig expressions normalize for compiler and GLSL", () => {
  const normalized = sandbox.normalizeExpressionText("\\sin(x)+\\cos(y)");
  assert(normalized === "sin(x)+cos(y)", normalized);
  assert(sandbox.expressionToGlsl("\\sin(x)+\\cos(y)", {}) === "sin(x)+cos(y)", "GLSL normalization failed");
  assert(sandbox.validateExpression("\\sin(x)+\\cos(y)", {}).status === "valid", "LaTeX trig should validate");

  const mathQuillLatex = "\\sin\\left(x\\right)+\\cos\\left(y\\right)";
  const mqNormalized = sandbox.normalizeExpressionText(mathQuillLatex);
  assert(mqNormalized === "sin(x)+cos(y)", mqNormalized);
  assert(sandbox.expressionToGlsl(mathQuillLatex, {}) === "sin(x)+cos(y)", "MathQuill GLSL normalization failed");
  assert(sandbox.validateExpression(mathQuillLatex, {}).status === "valid", "MathQuill LaTeX should validate");
});

check("fractions normalize from all supported text and LaTeX forms", () => {
  const cases = [
    ["1/1", "frac(1,1)"],
    ["{1}/{1}", "frac(1,1)"],
    ["frac{1}{1}", "frac(1,1)"],
    ["frac(1)(1)", "frac(1,1)"],
    ["frac(1,1)", "frac(1,1)"],
    ["\\frac{1}{1}", "frac(1,1)"]
  ];

  for (const [input, expected] of cases) {
    const normalized = sandbox.normalizeExpressionText(input);
    assert(normalized === expected, `${input} -> ${normalized}`);
    assert(sandbox.validateExpression(input, {}).status === "valid", `${input} should validate`);
    assert(sandbox.compileExpression(input)(1, 1, {}) === 1, `${input} should compile to 1`);
    assert(sandbox.expressionToGlsl(input, {}) === "frac(1.0,1.0)", `${input} should convert to GLSL frac`);
  }
});

check("multiplication round-trips as cdot in LaTeX and star in compiler text", () => {
  assert(sandbox.normalizeExpressionText("\\sin(x)\\cdot\\cos(y)") === "sin(x)*cos(y)", "\\cdot should normalize to *");
  assert(sandbox.normalizeExpressionText("\\sin(x)\\times\\cos(y)") === "sin(x)*cos(y)", "\\times should normalize to *");
  const latex = sandbox.latexSourceFromExpression("sin(x)*cos(y)");
  assert(latex === "\\sin\\left(x\\right)\\cdot \\cos\\left(y\\right)", latex);
  assert(sandbox.expressionToGlsl("\\sin(x)\\cdot\\cos(y)", {}) === "sin(x)*cos(y)", "\\cdot should convert to GLSL *");
});

check("nested absolute bars serialize as nested abs calls", () => {
  const expression = sandbox.normalizeExpressionText("|x+ |y| |").replace(/\s+/g, "");
  assert(expression === "abs(x+abs(y))", expression);
});

check("all program functions normalize, compile, validate, and convert to GLSL", () => {
  for (const name of functionNames) {
    const args = sampleArgs(name);
    const expression = `${sandbox.__debugLatexFunctions[name].internal}(${args.join(",")})`;
    const normalized = sandbox.normalizeExpressionText(expression);
    assert(!normalized.includes("\\"), `${name} normalized retained LaTeX: ${normalized}`);
    const validation = sandbox.validateExpression(expression, {});
    assert(validation.status === "valid", `${name} validation: ${JSON.stringify(validation)}`);
    const value = sandbox.compileExpression(expression)(0.5, 0.25, {});
    assert(Number.isFinite(value), `${name} compile: ${String(value)}`);
    const glsl = sandbox.expressionToGlsl(expression, {});
    assert(!glsl.includes("\\"), `${name} GLSL retained LaTeX: ${glsl}`);
    assert(!/\bround\(/.test(glsl), `${name} GLSL should use helper: ${glsl}`);
  }
});

check("operatorname latex imports program function names", () => {
  const expression = sandbox.normalizeExpressionText("\\operatorname{arccot}{x}");
  assert(expression === "arccot(x)", expression);
});

check("fractions, radicals, and nested exponents compile from LaTeX", () => {
  const expression = "\\sqrt{\\frac{x^2+y^2}{\\sin(x)+\\cos(y)}}+x^{y^2}";
  const normalized = sandbox.normalizeExpressionText(expression);
  assert(normalized === "sqrt(frac(x^2+y^2,sin(x)+cos(y)))+x^(y^2)", normalized);
  const value = sandbox.compileExpression(expression)(1, 1, {});
  assert(Number.isFinite(value), String(value));
  const glsl = sandbox.expressionToGlsl(expression, {});
  assert(glsl.includes("pow(") && !glsl.includes("\\"), glsl);
  assert(sandbox.validateExpression(expression, {}).status === "valid", "complex LaTeX should validate");
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
