import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { convertPowers, getOpPrecedence, normalizeMathSyntax, UNARY_OPERAND_PRECEDENCE } from "../src/math/expression-syntax.js";

const source = await readFile("src/browser-preview-live.js", "utf8");
const landingSource = await readFile("src/landing.js", "utf8");
const sampleSources = await Promise.all([
  readFile("sample code/fire", "utf8"),
  readFile("sample code/mandelbrot set", "utf8"),
  readFile("sample code/Lepton Logo", "utf8"),
  readFile("sample code/cinematic clouds", "utf8")
]);
const storage = new Map();
const headLinks = [];
function createMockElement(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    rel: "",
    href: "",
    type: "",
    sizes: "",
    setAttribute(name, value) {
      this[name] = String(value);
    },
    classList: { toggle: () => {} },
    dataset: {},
    append: () => {},
    remove() {
      const index = headLinks.indexOf(this);
      if (index >= 0) headLinks.splice(index, 1);
    },
    click: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  };
}
const sandbox = {
  console,
  structuredClone: globalThis.structuredClone,
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  },
  document: {
    head: { append: (node) => headLinks.push(node) },
    body: { append: () => {} },
    createElement: createMockElement,
    querySelectorAll: (selector) => (selector.includes("link") ? headLinks : []),
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
  getComputedStyle: () => ({ fontSize: "16px" }),
  convertPowers,
  getOpPrecedence,
  normalizeMathSyntax,
  UNARY_OPERAND_PRECEDENCE
};

vm.createContext(sandbox);
vm.runInContext(
  source.replace(/^import .*expression-syntax\.js";\s*/, "").replace(
    /loadSceneFromUrl\(\);\s*sceneHistory\.last = sceneSnapshot\(\);\s*renderApp\(\);/,
    "globalThis.__debugLatexFunctions = LATEX_FUNCTIONS; globalThis.__debugScene = scene; globalThis.__debugSetScene = (next) => { scene = next; globalThis.__debugScene = scene; }; globalThis.__debugSetDisplayMode = (mode) => { displayMode = mode; }; globalThis.__debugPlayTime = (id) => { playingTimeIds.add(id); timeVariableDirections.set(id, 1); };"
  ),
  sandbox
);

const functionNames = Object.keys(sandbox.__debugLatexFunctions);

check("runtime favicon links use the Lepton icon", () => {
  assert(headLinks.length === 3, JSON.stringify(headLinks));
  assert(headLinks.every((link) => link.href.includes("lepton-favicon.png?v=20260721-cloud-functions")), JSON.stringify(headLinks));
  assert(headLinks.some((link) => link.rel === "icon" && link.sizes === "any"), JSON.stringify(headLinks));
});

check("bundled sample scripts use named draw fields and time speeds", () => {
  assert(!/draw\([^\n]*,[^=\n]+,[^=\n]+,(?:False|True)\)/.test(landingSource), "legacy positional draw remains in landing samples");
  assert(landingSource.includes("draw(eq,colour=rgb,boundary=rest)"), "named sample draw missing");
  assert(landingSource.includes("time unbounded t = 0 speed 1"), "sample time speed missing");
});

check("copyable sample files import with the current grammar", () => {
  for (const sample of sampleSources) {
    assert(!sample.includes("~~~~~"), sample);
    assert(!/^D~/m.test(sample), sample);
    const imported = sandbox.importScene(sample);
    sandbox.__debugSetScene(imported);
    const diagnostics = sandbox.validateScene();
    const entries = ["functions", "colors", "restrictions", "transparencies", "draws", "points", "folders", "settings"]
      .flatMap((key) => diagnostics[key]);
    assert(!entries.some((entry) => entry.status === "invalid"), JSON.stringify(entries));
    assert(imported.draws.length > 0, sample);
  }
});

check("graph actions menu exposes New Save Load and Export", () => {
  const html = sandbox.renderGraphActionsMenu();
  for (const action of ["new-graph", "open-save-dialog", "open-library", "export-graph"]) {
    assert(html.includes(`data-action="${action}"`), html);
  }
});

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

check("bare random is a zero-argument built-in with operator styling", () => {
  assert(sandbox.normalizeExpressionText("random") === "random()", "bare random did not normalize to a call");
  assert(sandbox.normalizeExpressionText("random()") === "random()", "explicit random call changed");
  assert(sandbox.latexSourceFromExpression("random") === "\\operatorname{random}", "bare random did not render as an operator");
  assert(sandbox.expressionToGlsl("random", {}).includes("leptonRandom(vec2(x,y))"), "bare random did not compile to GLSL");
  assert(sandbox.validateExpression("random", {}).status === "valid", "bare random should validate");
  for (const [x, y] of [[0, 0], [1.5, -2], [200, 300]]) {
    const value = sandbox.compileExpression("random")(x, y, { __randomSeed: 731029 });
    assert(value >= 0 && value < 1, `random at (${x},${y}) returned ${value}`);
  }
  assert(source.includes("scheduleMountedMathFieldReflow();"), "sidebar resizing does not reflow MathQuill fields");
});

check("nested built-ins and user functions compile through CPU and GLSL", () => {
  const nestedSource = `function square(v) = v^2
function soften(v,limit) = clamp(square(v),0,limit)
function wave(a,b) = tanh(sinh(cosh(a)))+sin(cos(b))
function offset(v) = v+0.25
expression randomBase = clamp(random(),0,1)
expression nestedRandom = sqrt(abs(randomBase-0.5))
expression nestedUser = soften(sin(x),2)+wave(x,y)
expression nestedArgument = wave(x+offset(y),offset(sin(x)))
expression powers = 2^3^2
expression negativePower = -2^2
expression groupedPower = (-2)^2
expression negativeExponential = e^(-(x^2)/16)`;
  const imported = sandbox.importScene(nestedSource);
  sandbox.__debugSetScene(imported);
  const env = sandbox.sceneFunctionEnv(true);
  const runtime = sandbox.buildRuntimeEnv(env);
  const byId = (id) => imported.functions.find((entry) => entry.id === id);
  const glsl = (id) => sandbox.expressionToGlsl(byId(id).expression, env);
  const cpu = (id, x = 0, y = 0) => sandbox.compileExpression(byId(id).expression)(x, y, runtime);

  for (const id of ["nestedRandom", "nestedUser", "nestedArgument", "powers", "negativePower", "groupedPower", "negativeExponential"]) {
    const output = glsl(id);
    assert(!output.includes("clamp3*("), `${id}: ${output}`);
    assert(!output.includes("vec2*("), `${id}: ${output}`);
    assert(!output.includes("^"), `${id}: ${output}`);
  }
  assert(Number.isFinite(cpu("nestedRandom", 0.2, -0.4)), "nested random CPU evaluation failed");
  assert(Number.isFinite(cpu("nestedUser", 0.2, -0.4)), "nested user-function CPU evaluation failed");
  assert(Number.isFinite(cpu("nestedArgument", 0.2, -0.4)), "nested function argument CPU evaluation failed");
  assert(cpu("powers") === 512, `right-associative power returned ${cpu("powers")}`);
  assert(cpu("negativePower") === -4, `negative power returned ${cpu("negativePower")}`);
  assert(cpu("groupedPower") === 4, `grouped negative power returned ${cpu("groupedPower")}`);
});

check("negative exponents and nested calls survive text round trips", () => {
  const source = `function square(v) = v^2
function nested(v) = clamp(sqrt(abs(square(v))),0,4)
expression result = nested(sin(x))+e^(-(x^2)/16)
colour rgb = result~result~result
draw(result,colour=rgb)`;
  const first = sandbox.importScene(source);
  sandbox.__debugSetScene(first);
  const firstEnv = sandbox.sceneFunctionEnv(true);
  const firstGlsl = sandbox.expressionToGlsl(first.functions.find((entry) => entry.id === "result").expression, firstEnv);
  const exported = sandbox.exportScene();
  const second = sandbox.importScene(exported);
  sandbox.__debugSetScene(second);
  const secondEnv = sandbox.sceneFunctionEnv(true);
  const secondGlsl = sandbox.expressionToGlsl(second.functions.find((entry) => entry.id === "result").expression, secondEnv);
  assert(firstGlsl === secondGlsl, `round trip changed GLSL:\n${firstGlsl}\n${secondGlsl}`);
});

check("time playback controls include a live FPS output", () => {
  const timed = sandbox.importScene("time unbounded t = 0 speed 1");
  sandbox.__debugSetScene(timed);
  sandbox.__debugPlayTime("t");
  const html = sandbox.timePlaybackControls();
  assert(html.includes("data-fps-counter"), html);
  assert(html.includes("FPS"), html);
});

check("time animation compiles slider values as reusable shader uniforms", () => {
  const timed = sandbox.importScene(`time unbounded t = 0 speed 1
function animatedWave(q) = sin(x+q)+cos(y-q)
expression eq = animatedWave(t)
colour rgb = eq~eq~eq
draw(eq,colour=rgb)`);
  sandbox.__debugSetScene(timed);
  const firstKey = sandbox.webGlShaderCacheKey();
  const shader = sandbox.buildFragmentShader();
  assert(shader.includes("uniform float u_time_0;"), shader);
  assert(shader.includes("u_time_0"), shader);
  assert((shader.match(/u_time_0/g) ?? []).length > 1, "time uniform was lost inside a nested user function");
  assert(shader.includes("uniform vec3 u_background;"), shader);
  timed.functions.find((entry) => entry.id === "t").expression = "12.5";
  assert(sandbox.webGlShaderCacheKey() === firstKey, "time value invalidated the structural shader cache");
  timed.functions.find((entry) => entry.id === "eq").expression = "sin(x-t)";
  assert(sandbox.webGlShaderCacheKey() !== firstKey, "structural expression edit did not invalidate the shader cache");
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

check("nested fractions remain a complete operand when exponentiated", () => {
  const source = "frac{x^2+frac{y}{10}^2}{100}";
  const normalized = sandbox.normalizeExpressionText(source);
  assert(!normalized.includes("fracpow"), normalized);
  const value = sandbox.compileExpression(source)(3, 20, sandbox.buildRuntimeEnv({}));
  assert(Math.abs(value - 0.13) < 1e-10, `${normalized} -> ${value}`);
  const glsl = sandbox.expressionToGlsl(source, {});
  assert(glsl.includes("pow(frac(y,10.0),2.0)"), glsl);
});

check("negative fractional exponents remain one power operand", () => {
  for (const source of ["e^(-(y/8))", "e^-frac{y}{8}", "e^(-frac{y}{8})"]) {
    const compiled = sandbox.compileExpression(source)(0, 2, {});
    assert(Math.abs(compiled - Math.exp(-0.25)) < 1e-9, `${source}: ${compiled}`);
    const glsl = sandbox.expressionToGlsl(source, {});
    assert(glsl.includes("pow(2.718281828459045"), `${source}: ${glsl}`);
  }
});

check("multiplication round-trips as cdot in LaTeX and star in compiler text", () => {
  assert(sandbox.normalizeExpressionText("\\sin(x)\\cdot\\cos(y)") === "sin(x)*cos(y)", "\\cdot should normalize to *");
  assert(sandbox.normalizeExpressionText("\\sin(x)\\times\\cos(y)") === "sin(x)*cos(y)", "\\times should normalize to *");
  const latex = sandbox.latexSourceFromExpression("sin(x)*cos(y)");
  assert(latex === "\\sin\\left(x\\right)\\cdot \\cos\\left(y\\right)", latex);
  assert(sandbox.expressionToGlsl("\\sin(x)\\cdot\\cos(y)", {}) === "sin(x)*cos(y)", "\\cdot should convert to GLSL *");
  sandbox.__debugSetScene(sandbox.importScene("function radial(a,b) = sqrt(a^2+b^2)"));
  const customLatex = "140+60\\cdot \\cos(\\operatorname{radial}(x,y))";
  assert(sandbox.normalizeExpressionText(customLatex) === "140+60*cos(radial(x,y))", sandbox.normalizeExpressionText(customLatex));
  assert(sandbox.validateExpression(customLatex, sandbox.sceneFunctionEnv(true)).status === "valid", "combined cdot/operatorname expression should validate");
});

check("GLSL trig respects degree angle mode", () => {
  const radians = sandbox.expressionToGlsl("sin(180)", {}, null, [], "radians");
  const degrees = sandbox.expressionToGlsl("sin(180)", {}, null, [], "degrees");
  assert(radians === "sin(180.0)", radians);
  assert(degrees === "sin((180.0)*0.017453292519943295)", degrees);
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

check("all hyperbolic functions keep bracketed calls through CPU and GLSL", () => {
  const samples = {
    sinh: "0.5",
    cosh: "0.5",
    tanh: "0.5",
    sech: "0.5",
    csch: "0.5",
    coth: "0.5",
    arcsinh: "0.5",
    arccosh: "2",
    arctanh: "0.5",
    arcsech: "0.5",
    arccsch: "0.5",
    arccoth: "2"
  };
  for (const [name, argument] of Object.entries(samples)) {
    const expression = `${name}(${argument}+x/10)`;
    assert(sandbox.validateExpression(expression, {}).status === "valid", expression);
    assert(Number.isFinite(sandbox.compileExpression(expression)(0.25, 0, {})), expression);
    const glsl = sandbox.expressionToGlsl(expression, {});
    assert(!glsl.includes("Unknown") && !glsl.includes("\\"), `${expression}: ${glsl}`);
  }
});

check("negative exponential grouping survives the editor AST", () => {
  assert(sandbox.convertDivisionsToFrac("x^2/20") === "frac(x^2)(20)", sandbox.convertDivisionsToFrac("x^2/20"));
  assert(sandbox.convertDivisionsToFrac("(x-1)^2/2") === "frac((x-1)^2)(2)", sandbox.convertDivisionsToFrac("(x-1)^2/2"));
  const simplePowerFraction = sandbox.latexSourceFromExpression("x^2/20");
  assert(simplePowerFraction === "\\frac{x^{2}}{20}", simplePowerFraction);
  const groupedPowerFraction = sandbox.latexSourceFromExpression("(x-1)^2/2");
  assert(groupedPowerFraction === "\\frac{\\left(x-1\\right)^{2}}{2}", groupedPowerFraction);

  const source = "e^(-((a-sun_x)^2/95+(b-sun_y)^2/42))";
  const ast = sandbox.parseLeptonText(source);
  const recorded = sandbox.astToLeptonText(ast);
  assert(recorded === "e^(-(frac{(a-sun_x)^2}{95}+frac{(b-sun_y)^2}{42}))", recorded);
  const html = sandbox.renderEditableLatex(source);
  assert(html.includes('class="mq-power"') && html.includes('class="mq-exponent"'), html);

  const groupedBase = sandbox.astToLeptonText(sandbox.parseLeptonText("(-x)^2"));
  assert(groupedBase === "(-x)^2", groupedBase);
});

check("SDF helpers and random compile for CPU and GLSL", () => {
  assert(sandbox.compileExpression("union(3,-2)")(0,0,{}) === -2);
  assert(sandbox.compileExpression("intersect(3,-2)")(0,0,{}) === 3);
  assert(sandbox.compileExpression("subtract(3,-2)")(0,0,{}) === -2);
  const randomValue = sandbox.compileExpression("random()")(0,0,{});
  assert(randomValue >= 0 && randomValue <= 1, String(randomValue));
  const glsl = sandbox.expressionToGlsl("union(x,y)+intersect(x,y)+subtract(x,y)+random()", {});
  assert(glsl.includes("leptonRandom(vec2(x,y))"), glsl);
  assert(!glsl.includes("random2"), glsl);
});

check("floor and ceil delimiters survive LaTeX and text round-trips", () => {
  for (const [source, expected] of [["floor(2*x)", "floor(2*x)"], ["ceil(y/3)", "ceil(frac(y,3))"]]) {
    const latex = sandbox.latexSourceFromExpression(source);
    const normalized = sandbox.normalizeExpressionText(latex);
    assert(normalized === expected, `${source} -> ${latex} -> ${normalized}`);
    assert(!normalized.includes("lfloor") && !normalized.includes("rfloor"), normalized);
    assert(sandbox.validateExpression(normalized, {}).status === "valid", normalized);
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

check("pi inside an identifier does not corrupt reference compilation", () => {
  const env = sandbox.buildRuntimeEnv({ tempimaginary: "10" });
  const value = sandbox.compileExpression("tempimaginary+1")(0, 0, env);
  assert(value === 11, `expected 11, got ${value}`);
  const glsl = sandbox.expressionToGlsl("tempimaginary+1", { tempimaginary: "10" });
  assert(glsl === "(10.0)+1.0", glsl);
});

check("identifiers containing reserved names are yellow-flagged without corrupting references", () => {
  const idResult = sandbox.validateEntryId("tempimaginary", "Function");
  assert(idResult.status === "warning", JSON.stringify(idResult));
  assert(idResult.message.includes("pi"), idResult.message);

  const expressionResult = sandbox.validateExpression("tempimaginary+1", { tempimaginary: "10" });
  assert(expressionResult.status === "valid", JSON.stringify(expressionResult));

  const eResult = sandbox.validateEntryId("one", "Function");
  assert(eResult.status === "valid", JSON.stringify(eResult));
});

check("exact built-in function names are red-flagged", () => {
  sandbox.__debugSetScene({
    ...structuredClone(sandbox.__debugScene),
    functions: [{ id: "sin", expression: "x" }],
    colors: [],
    restrictions: [],
    draws: []
  });
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.functions[0].status === "invalid", JSON.stringify(diagnostics.functions[0]));
  assert(diagnostics.functions[0].message.includes("shadows"), diagnostics.functions[0].message);
});

check("duplicate entry ids are red-flagged", () => {
  sandbox.__debugSetScene({
    ...structuredClone(sandbox.__debugScene),
    functions: [
      { id: "same", expression: "x" },
      { id: "same", expression: "y" }
    ],
    colors: [
      { id: "rgb", red: "same", green: "same", blue: "same" },
      { id: "rgb", red: "same", green: "same", blue: "same" }
    ],
    restrictions: [
      { id: "rest", expression: "same", checkSmaller: false },
      { id: "rest", expression: "same", checkSmaller: false }
    ],
    draws: []
  });
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.functions.every((item) => item.status === "invalid"), JSON.stringify(diagnostics.functions));
  assert(diagnostics.colors.every((item) => item.status === "invalid"), JSON.stringify(diagnostics.colors));
  assert(diagnostics.restrictions.every((item) => item.status === "invalid"), JSON.stringify(diagnostics.restrictions));
});

check("whole-token constants render as LaTeX without splitting longer identifiers", () => {
  const latex = sandbox.latexSourceFromExpression("twopi+pifour+pi");
  assert(latex === "twopi+pifour+\\pi", latex);
});

check("operator constants wait for identifier boundaries before rendering", () => {
  assert(sandbox.completeIdentifierConstants("pixel") === "pixel", "pixel should not change while identifier is still active");
  assert(sandbox.completeIdentifierConstants("pi+x") === "π+x", "pi should render after + completes the token");
  assert(sandbox.completeIdentifierConstants("twopi+pi") === "twopi+π", "pi inside twopi should stay plain");
});

check("help tooltip position clamps inside viewport edges", () => {
  const leftEdge = sandbox.helpTooltipPosition(
    { left: 4, right: 54, top: 90, bottom: 110, width: 50, height: 20 },
    { width: 320, height: 54 },
    { width: 360, height: 640 }
  );
  assert(leftEdge.left >= 10, JSON.stringify(leftEdge));
  assert(leftEdge.left + 320 <= 350, JSON.stringify(leftEdge));

  const rightEdge = sandbox.helpTooltipPosition(
    { left: 330, right: 356, top: 90, bottom: 110, width: 26, height: 20 },
    { width: 320, height: 54 },
    { width: 360, height: 640 }
  );
  assert(rightEdge.left >= 10, JSON.stringify(rightEdge));
  assert(rightEdge.left + 320 <= 350, JSON.stringify(rightEdge));
});

check("recursion base case returns zero", () => {
  sandbox.__debugScene.settings.maxRecursion = 1;
  const env = sandbox.buildRuntimeEnv({ loop: "loop+1" });
  const value = sandbox.compileExpression("loop")(2, 3, env);
  assert(value === 1, `expected base 0 plus 1, got ${value}`);
  assert(sandbox.expressionToGlsl("loop", { loop: "loop+1" }) === "((0.0)+1.0)", "GLSL recursion base should be 0.0");
});

check("malformed expressions are invalid", () => {
  const result = sandbox.validateExpression("sin(2x)+", {});
  assert(result.status === "invalid", JSON.stringify(result));
});

check("recursive node estimator blue-flags equations above 2^12 nodes", () => {
  sandbox.__debugScene.settings.maxRecursion = 10;
  const env = {
    a: "b+b+1",
    b: "a+a+1"
  };
  const result = sandbox.validateExpression("a+b", env, ["a"]);
  assert(result.status === "info", JSON.stringify(result));
  assert(result.message.includes("large"), result.message);
  assert(result.message.includes("graph may not render"), result.message);
  assert(!result.message.includes("still attempting"), result.message);
});

check("recursive node estimator keeps equations above 2^16 nodes blue flagged", () => {
  sandbox.__debugScene.settings.maxRecursion = 20;
  const env = {
    real: "real^2-imaginary^2+x",
    imaginary: "2*real*imaginary+y",
    c: "x",
    bounds: "1",
    comb: "real+imaginary"
  };
  const result = sandbox.validateExpression("real+imaginary", env, ["comb"]);
  assert(result.status === "info", JSON.stringify(result));
  assert(result.message.includes("large"), result.message);
  assert(result.message.includes("graph may not render"), result.message);
  assert(!result.message.includes("refusing"), result.message);
});

check("Mandelbrot-style recursive sample is not red-flagged by node count", () => {
  const imported = sandbox.importScene(`set max_recursion = 20
variable real = real^2-imaginary^2+x
variable imaginary = 2*real*imaginary+y
variable c = x
variable bounds = 1
variable comb = real+imaginary
colour rgb = c~c~c
boundary rest = bounds~False
draw(comb,rgb,rest,False)`);
  sandbox.__debugSetScene(imported);
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.hasErrors === false, JSON.stringify(diagnostics));
  assert(diagnostics.functions.some((item) => item.status === "info"), JSON.stringify(diagnostics.functions));
  assert(diagnostics.summary.includes("graph may not render"), diagnostics.summary);
});

check("draw layers can be hidden and round-trip through text mode", () => {
  const imported = sandbox.importScene(`F:eq~x
~~~~~
C:rgb~eq~eq~eq
~~~~~
R:rest~eq~0
~~~~~
D~eq~rgb~rest~1
~~~~~
S:x_min~-1
S:x_max~1
S:y_min~-1
S:y_max~1
S:max_recursion~20
S:angle_mode~radians`);
  assert(imported.draws[0].hidden === true, JSON.stringify(imported.draws[0]));

  sandbox.__debugSetScene(imported);
  const exported = sandbox.exportScene();
  assert(exported.includes("draw(eq,colour=rgb,boundary=rest,visible=False)"), exported);
});

check("new Lepton language exports settings first without section dividers", () => {
  const imported = sandbox.importScene(`variable f1 = x+y
colour c1=f1~f1~f1
boundary r1=f1~False
draw(f1,c1,r1,False)
set x_min = -15
set x_max = 15
set y_min = -15
set y_max = 15
set max_recursion = 100
set angle_mode = radians
set background_color = 0`);
  sandbox.__debugSetScene(imported);
  const exported = sandbox.exportScene();
  assert(!exported.includes("~~~~~"), exported);
  assert(exported.startsWith("set x_min = -15\nset x_max = 15"), exported);
  assert(exported.includes("\nexpression f1 = x+y"), exported);
  assert(exported.includes("\ncolour c1 = f1~f1~f1"), exported);
  assert(exported.includes("\nboundary r1 = f1~False"), exported);
  assert(exported.includes("\ndraw(f1,colour=c1,boundary=r1)"), exported);
});

check("new Lepton language accepts expression aliases booleans and invalid angle fallback", () => {
  const imported = sandbox.importScene(`set angle_mode = sideways
set max_recursion = 33
expression f1 = pi+x
color c1 = f1~f1~f1
restriction r1 = f1~true
draw(f1,c1,r1,true)`);
  assert(imported.settings.angleMode === "radians", JSON.stringify(imported.settings));
  assert(imported.settings.maxRecursion === 33, JSON.stringify(imported.settings));
  assert(imported.colors[0].id === "c1", JSON.stringify(imported.colors));
  assert(imported.restrictions[0].checkSmaller === true, JSON.stringify(imported.restrictions));
  assert(imported.draws[0].hidden === true, JSON.stringify(imported.draws));
});

check("typed function entries export and evaluate with local parameters", () => {
  const imported = sandbox.importScene(`variable y = 100
slider speed = 5 range -2~8
time unbounded t = 0 range 0~12
function f(x,y) = x+y
colour c1 = f~f~f
boundary r1 = f~False
draw(f,c1,r1,False)`);
  sandbox.__debugSetScene(imported);
  const exported = sandbox.exportScene();
  assert(exported.includes("\nexpression y = 100"), exported);
  assert(exported.includes("\nslider speed = 5 range -2~8"), exported);
  assert(exported.includes("\ntime unbounded t = 0"), exported);
  assert(!exported.includes("\ntime unbounded t = 0 range"), exported);
  assert(exported.includes("\nfunction f(x,y) = x+y"), exported);

  const env = sandbox.buildRuntimeEnv(sandbox.sceneFunctionEnv(true));
  const value = sandbox.compileExpression("f(2,3)")(0, 0, env);
  assert(value === 5, `expected local parameter call to return 5, got ${value}`);
  const validation = sandbox.validateExpression("f(2,3)", sandbox.sceneFunctionEnv(true));
  assert(validation.status === "valid", JSON.stringify(validation));
  const glsl = sandbox.expressionToGlsl("f(2,3)", sandbox.sceneFunctionEnv(true));
  assert(glsl.includes("2.0") && glsl.includes("3.0") && !glsl.includes("x") && !glsl.includes("y"), glsl);
});

check("sliders warn for coordinate-dependent values and multiple time declarations", () => {
  const imported = sandbox.importScene(`variable source = 3
slider safe = source range 0~10
slider moving = x range 0~10
time bounded t = 0 range 0~5
time bounded_looped u = 1 range 0~5`);
  sandbox.__debugSetScene(imported);
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.functions[1].status === "valid", JSON.stringify(diagnostics.functions));
  assert(diagnostics.functions[2].status === "warning", JSON.stringify(diagnostics.functions));
  assert(diagnostics.functions[2].message.includes("uses coordinate"), diagnostics.functions[2].message);
  assert(diagnostics.functions[3].status === "warning", JSON.stringify(diagnostics.functions));
  assert(diagnostics.functions[3].message.includes("Multiple time variables"), diagnostics.functions[3].message);
  assert(diagnostics.functions[4].status === "warning", JSON.stringify(diagnostics.functions));
});

check("unbounded time values keep fixed decimal precision past large values", () => {
  const imported = sandbox.importScene(`set unbounded_decimal_places = 3
set unbounded_integer_digits = 1
time unbounded t = 10000`);
  sandbox.__debugSetScene(imported);
  const entry = sandbox.__debugScene.functions[0];
  assert(sandbox.formatSliderValue(10000.016, entry) === "10000.016", sandbox.formatSliderValue(10000.016, entry));
});

check("unbounded time export omits redundant integer digit setting", () => {
  const imported = sandbox.importScene(`set unbounded_decimal_places = 3
set unbounded_integer_digits = 8
time unbounded t = 10000`);
  sandbox.__debugSetScene(imported);
  const exported = sandbox.exportScene();
  assert(exported.includes("set unbounded_decimal_places = 3"), exported);
  assert(!exported.includes("unbounded_integer_digits"), exported);
  const entry = sandbox.__debugScene.functions[0];
  assert(sandbox.formatSliderValue(10000.016, entry) === "10000.016", sandbox.formatSliderValue(10000.016, entry));
});

check("bounded sliders red-flag inverted min max ranges", () => {
  const imported = sandbox.importScene(`slider bad = 5 range 10~0`);
  sandbox.__debugSetScene(imported);
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.functions[0].status === "invalid", JSON.stringify(diagnostics.functions[0]));
  assert(diagnostics.functions[0].message.includes("minimum is greater than maximum"), diagnostics.functions[0].message);
});

check("bounded time values bounce instead of stopping at max", () => {
  const up = sandbox.reflectBoundedTimeValue(1.25, 0, 1, 1);
  assert(up.value === 0.75, JSON.stringify(up));
  assert(up.direction === -1, JSON.stringify(up));
  const down = sandbox.reflectBoundedTimeValue(-0.25, 0, 1, -1);
  assert(down.value === 0.25, JSON.stringify(down));
  assert(down.direction === 1, JSON.stringify(down));
});

check("time variables use configurable coordinate-free units per second", () => {
  const imported = sandbox.importScene(`expression rate = 2
time bounded_looped t = 0 range 0~10 speed rate`);
  sandbox.__debugSetScene(imported);
  sandbox.__debugPlayTime("t");
  sandbox.advanceTimeVariables(0.5);
  assert(Math.abs(Number(imported.functions[1].expression)-1)<1e-9, imported.functions[1].expression);
  assert(sandbox.exportScene().includes("time bounded_looped t = 1 range 0~10 speed rate"), sandbox.exportScene());
  const invalid = sandbox.importScene(`expression coordinateRate = x+1
time unbounded t = 0 speed coordinateRate`);
  sandbox.__debugSetScene(invalid);
  assert(sandbox.validateScene().functions[1].status === "invalid", JSON.stringify(sandbox.validateScene().functions[1]));
});

check("playing bounded time clamps to edited slider bounds", () => {
  const imported = sandbox.importScene(`time bounded t = 9 range 0~10`);
  sandbox.__debugSetScene(imported);
  sandbox.__debugPlayTime("t");
  sandbox.__debugScene.functions[0].sliderMin = "0";
  sandbox.__debugScene.functions[0].sliderMax = "1";
  sandbox.advanceTimeVariables(1);
  const value = Number(sandbox.__debugScene.functions[0].expression);
  assert(value >= 0 && value <= 1, `expected edited range to clamp playback inside 0..1, got ${value}`);
});

check("Lepton text strips stretchy parentheses from function calls", () => {
  const imported = sandbox.importScene(`function f1(x,y) = x^2+y^2
variable f2 = 2*x+y
variable f3 = f1\\left(f2,3\\right)`);
  sandbox.__debugSetScene(imported);
  const exported = sandbox.exportScene();
  assert(exported.includes("\nfunction f1(x,y) = x^2+y^2"), exported);
  assert(exported.includes("\nexpression f3 = f1(f2,3)"), exported);
  assert(!exported.includes("\\left") && !exported.includes("\\right"), exported);
});

check("text mode refresh preserves frac brace syntax", () => {
  const imported = sandbox.importScene(`variable eq = x/y+frac{y}{2}`);
  sandbox.__debugSetScene(imported);
  const exported = sandbox.exportScene();
  assert(exported.includes("expression eq = frac{x}{y}+frac{y}{2}"), exported);
});

check("comments round-trip between standard and text sections", () => {
  const imported = sandbox.importScene(`// helper note
variable eq = x+y // inline equation
// palette note
colour rgb = eq~eq~eq // inline colour
// gate note
boundary rest = 1~False // inline boundary
// layer note
draw(eq,rgb,rest,False) // inline draw`);
  assert(imported.functions[0].type === "comment", JSON.stringify(imported.functions));
  assert(imported.functions[0].text === "helper note", JSON.stringify(imported.functions[0]));
  assert(imported.functions[1].comment === "inline equation", JSON.stringify(imported.functions[1]));
  assert(imported.colors[0].type === "comment", JSON.stringify(imported.colors));
  assert(imported.colors[1].comment === "inline colour", JSON.stringify(imported.colors[1]));
  assert(imported.restrictions[0].text === "gate note", JSON.stringify(imported.restrictions));
  assert(imported.draws[0].text === "layer note", JSON.stringify(imported.draws));

  sandbox.__debugSetScene(imported);
  const exported = sandbox.exportScene();
  assert(exported.includes("// helper note\nexpression eq = x+y // inline equation"), exported);
  assert(exported.includes("// palette note\ncolour rgb = eq~eq~eq // inline colour"), exported);
  assert(exported.includes("// gate note\nboundary rest = rest_fn~False // inline boundary"), exported);
  assert(exported.includes("// layer note\ndraw(eq,colour=rgb,boundary=rest) // inline draw"), exported);
  assert(!exported.includes("// functions:"), exported);
  assert(!exported.includes("// colors:"), exported);
  assert(!exported.includes("// bounds:"), exported);
  assert(!exported.includes("// draw:"), exported);

  const second = sandbox.importScene(exported);
  assert(second.colors[0].type === "comment" && second.colors[0].text === "palette note", JSON.stringify(second.colors));
  assert(second.draws[1].comment === "inline draw", JSON.stringify(second.draws));
});

check("settings comments round-trip in the settings section", () => {
  const imported = sandbox.importScene(`// viewport note
set x_min = -8 // left edge
set x_max = 8
variable eq = x`);
  sandbox.__debugSetScene(imported);
  assert(sandbox.__debugScene.settingsComments[0].text === "viewport note", JSON.stringify(sandbox.__debugScene.settingsComments));
  assert(sandbox.__debugScene.settingLineComments.x_min === "left edge", JSON.stringify(sandbox.__debugScene.settingLineComments));
  const exported = sandbox.exportScene();
  assert(exported.includes("set x_min = -8 // left edge"), exported);
  assert(exported.startsWith("// viewport note\nset x_min = -8"), exported);
  assert(!exported.includes("// settings:"), exported);
  const second = sandbox.importScene(exported);
  assert(second.settingsComments[0].text === "viewport note", JSON.stringify(second.settingsComments));
  assert(second.settingLineComments.x_min === "left edge", JSON.stringify(second.settingLineComments));
});

check("comment entries are ignored by graph validation and references", () => {
  const imported = sandbox.importScene(`// note
variable eq = x
// note
colour rgb = eq~eq~eq
// note
boundary rest = 1~False
// note
draw(eq,rgb,rest,False)`);
  sandbox.__debugSetScene(imported);
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.hasErrors === false, JSON.stringify(diagnostics));
  assert(sandbox.sceneFunctionEnv().eq.id === "eq", JSON.stringify(sandbox.sceneFunctionEnv()));
  assert(!sandbox.sceneFunctionEnv()[""], JSON.stringify(sandbox.sceneFunctionEnv()));
});

check("entries can be reordered without losing comments", () => {
  sandbox.__debugSetScene(sandbox.importScene(`variable a = x
// functions: middle note
variable b = y`));
  sandbox.moveEntry("functions", 2, -1);
  assert(sandbox.__debugScene.functions.map((entry) => entry.type === "comment" ? `//${entry.text}` : entry.id).join(",") === "a,b,//middle note", JSON.stringify(sandbox.__debugScene.functions));
  sandbox.moveEntry("functions", 1, -1);
  assert(sandbox.__debugScene.functions.map((entry) => entry.type === "comment" ? `//${entry.text}` : entry.id).join(",") === "b,a,//middle note", JSON.stringify(sandbox.__debugScene.functions));
});

check("Lepton text highlighting uses double slash comments", () => {
  const html = sandbox.highlightLeptonText(`expression eq = x // inline note
// standalone`);
  assert(html.includes('<span class="syntax-comment">// inline note</span>'), html);
  assert(html.includes('<span class="syntax-comment">// standalone</span>'), html);
  assert(sandbox.highlightLeptonText("//") === '<span class="syntax-comment">//</span>');
  assert(sandbox.highlightLeptonText("// ") === '<span class="syntax-comment">// </span>');
});

check("function rows use an expression dropdown and icon actions", () => {
  const html = sandbox.functionRowContent({ id: "eq", kind: "variable", expression: "x+y" }, 0);
  assert(html.includes('data-function-kind-select="0"'), html);
  assert(html.includes(">expression<"), html);
  assert(!html.includes('data-function-kind="0.variable"'), html);

  const row = sandbox.expressionRow("valid", "ok", html, "functions", 0);
  assert(row.includes('data-entry-drag-handle="functions.0"'), row);
  assert(row.includes('data-add-inline-comment="functions.0"'), row);
  assert(!row.includes("data-move-entry"), row);
  assert(!row.includes("Move up"), row);
});

check("ordinary value edits do not create comments on every row", () => {
  const plain = sandbox.functionEntryForScene({ id: "eq", kind: "variable", expression: "x", _uid: "stable-id" });
  const commented = sandbox.functionEntryForScene({ id: "eq", kind: "variable", expression: "x", comment: "note" });
  assert(!Object.prototype.hasOwnProperty.call(plain, "comment"), JSON.stringify(plain));
  assert(plain._uid === "stable-id", JSON.stringify(plain));
  assert(commented.comment === "note", JSON.stringify(commented));
});

check("standard panel renders a unified data workspace", () => {
  sandbox.__debugSetScene(sandbox.importScene(`expression eq = x
colour rgb = eq~eq~eq
boundary rest = 1~False
draw(eq,rgb,rest,False)`));
  const html = sandbox.renderPanel();
  assert(html.includes('data-list-controls="data"'), html);
  assert(html.includes('data-new-entry-menu'), html);
  assert(html.includes('data-add="functions" data-entry-kind-choice="variable"'), html);
  assert(html.includes('data-add-default="functions"'), html);
  assert(html.includes(">Values<"), html);
  assert(html.includes('data-entry-kind="colors"'), html);
  assert(html.includes('data-entry-kind="restrictions"'), html);
  assert(html.includes('data-entry-kind="draws"'), html);
});

check("new-line menu leads with folders and comments in their own group", () => {
  const html = sandbox.addDataRow();
  const folder = html.indexOf('data-add="folders"');
  const comment = html.indexOf('data-add-comment="functions"');
  const expression = html.indexOf('data-entry-kind-choice="variable"', html.indexOf("new-entry-popover"));
  const draw = html.indexOf('data-add="draws"');
  assert(folder !== -1 && comment > folder && expression > comment && draw > expression, html);
});

check("data type and ID share the row heading", () => {
  sandbox.__debugSetScene(sandbox.importScene("expression eq = x"));
  const html = sandbox.renderPanel();
  assert(html.includes('class="entry-heading"'), html);
  assert(html.includes('data-type-menu="functions.0"'), html);
  assert(html.includes('data-field="functions.0.id"'), html);
});

check("data type label is a row-scoped selector", () => {
  const html = sandbox.expressionRow("valid", "ok", sandbox.functionRowContent({ id: "eq", kind: "variable", expression: "x+y" }, 0), "functions", 0, { typeLabel: "value · expression" });
  assert(html.includes('data-type-menu="functions.0"'), html);
  assert(html.includes('data-change-entry-kind="functions.0.slider"'), html);
  assert(html.includes('data-change-entry-kind="functions.0.colors"'), html);
  assert(html.includes('data-add-inline-comment="functions.0"'), html);
  assert(!html.includes('data-add-inline-comment="colors.0"'), html);
});

check("mixed data order round-trips through text export", () => {
  const imported = sandbox.importScene(`expression eq = x
colour rgb = eq~eq~eq
// note before boundary
boundary rest = 1~False
draw(eq,rgb,rest,False)
expression later = y`);
  sandbox.__debugSetScene(imported);
  sandbox.moveMixedDataEntry("colors", 0, "functions", 0);
  const exported = sandbox.exportScene();
  const eqIndex = exported.indexOf("expression eq = x");
  const colorIndex = exported.indexOf("colour rgb = eq~eq~eq");
  const laterIndex = exported.indexOf("expression later = y");
  assert(colorIndex !== -1 && eqIndex !== -1 && laterIndex !== -1, exported);
  assert(colorIndex < eqIndex, exported);
  assert(exported.includes("// note before boundary\nboundary rest = rest_fn~False"), exported);
});

check("nested folders round-trip without changing contained data", () => {
  const source = `folder main shapes = {
  expression eq = x+y
  folder styling = {
    colour rgb = eq~eq~eq
  }
  boundary rest = 1~False
}
draw(eq,rgb,rest,False)`;
  const imported = sandbox.importScene(source);
  sandbox.__debugSetScene(imported);
  const exported = sandbox.exportScene();
  assert(exported.includes("folder main shapes = {"), exported);
  assert(exported.includes("  expression eq = x+y"), exported);
  assert(exported.includes("  folder styling = {\n    colour rgb = eq~eq~eq\n  }"), exported);
  const second = sandbox.importScene(exported);
  assert(second.folders.length === 2, JSON.stringify(second.folders));
  assert(second.dataOrder.filter((ref) => ref.parentUid).length >= 3, JSON.stringify(second.dataOrder));
});

check("folder comments round-trip on the folder declaration", () => {
  const imported = sandbox.importScene(`folder notes = { // group note\n expression eq = x\n}`);
  sandbox.__debugSetScene(imported);
  assert(imported.folders[0].comment === "group note", JSON.stringify(imported.folders[0]));
  assert(sandbox.exportScene().includes("folder notes = { // group note"), sandbox.exportScene());
});

check("folder names allow spaces but reject grammar delimiters", () => {
  assert(sandbox.validateFolderName("main shapes").status === "valid");
  assert(sandbox.validateFolderName("bad=name").status === "invalid");
  assert(sandbox.validateFolderName("bad{name").status === "invalid");
});

check("collapsed folders hide descendants without deleting them", () => {
  const imported = sandbox.importScene(`folder group one = {\n expression eq = x\n}`);
  sandbox.__debugSetScene(imported);
  assert(sandbox.visibleDataEntries().length === 2);
  sandbox.__debugScene.folders[0].collapsed = true;
  assert(sandbox.visibleDataEntries().length === 1);
  assert(sandbox.__debugScene.functions.length === 1);
});

check("folder status prioritizes red then blue then yellow then green", () => {
  const imported = sandbox.importScene(`folder group = {\n expression eq = x\n}`);
  sandbox.__debugSetScene(imported);
  const base = { folders: [{ status: "valid", message: "ok" }], functions: [{ status: "warning", message: "warn" }], colors: [], restrictions: [], draws: [] };
  assert(sandbox.aggregateFolderDiagnostics(base)[0].status === "warning");
  base.functions[0] = { status: "info", message: "large" };
  assert(sandbox.aggregateFolderDiagnostics(base)[0].status === "info");
  base.functions[0] = { status: "invalid", message: "bad" };
  assert(sandbox.aggregateFolderDiagnostics(base)[0].status === "invalid");
});

check("entries can move into nested folders and back to the root", () => {
  sandbox.__debugSetScene(sandbox.importScene(`expression eq = x\nfolder shapes = {\n}`));
  assert(sandbox.moveEntryIntoFolder("functions", 0, 0) === true);
  const functionRef = sandbox.__debugScene.dataOrder.find((ref) => ref.kind === "functions");
  const folderRef = sandbox.__debugScene.dataOrder.find((ref) => ref.kind === "folders");
  assert(functionRef.parentUid === folderRef.uid, JSON.stringify(sandbox.__debugScene.dataOrder));
  assert(sandbox.moveEntryToRoot("functions", 0) === true);
  assert(functionRef.parentUid === "", JSON.stringify(sandbox.__debugScene.dataOrder));
});

check("rows can move downward and insert after the target", () => {
  sandbox.__debugSetScene(sandbox.importScene(`expression a = x\nexpression b = y\nexpression c = x+y`));
  assert(sandbox.moveMixedDataEntry("functions", 0, "functions", 2, "after") === true);
  const order = sandbox.orderedDataEntries(sandbox.__debugScene).map(({ entry }) => entry.id).join(",");
  assert(order === "b,c,a", order);
});

check("renaming IDs updates exact references but preserves local parameters", () => {
  const imported = sandbox.importScene(`expression old = x
expression use = old+1
function scoped(old) = old+1
colour shade = old~old~old
boundary edge = old~False
point p1 = (old,2)~True~shade
draw(old,shade,edge,False)`);
  sandbox.__debugSetScene(imported);
  imported.functions.find((entry) => entry.id === "old").id = "renamed";
  assert(sandbox.renameSceneReferences("functions", "old", "renamed") === true);
  assert(imported.functions.find((entry) => entry.id === "use").expression === "renamed+1");
  assert(imported.functions.find((entry) => entry.id === "scoped").expression === "old+1");
  assert(imported.colors[0].red === "renamed" && imported.restrictions[0].expression === "renamed");
  assert(imported.points[0].x === "renamed" && imported.draws[0].equationId === "renamed");
});

check("reserved-substring warnings apply only to expressions and sliders", () => {
  assert(sandbox.validateEntryId("pixel", "Expression", {}, true).status === "warning");
  assert(sandbox.validateEntryId("pixel", "Function", {}, false).status === "valid");
  assert(sandbox.validateEntryId("pixel", "Color", {}, false).status === "valid");
});

check("folders accept before inside and after drop zones", () => {
  const row = { dataset: { entryKind: "folders" }, getBoundingClientRect: () => ({ top: 100, height: 90 }) };
  assert(sandbox.dropPositionForRow(row, 105) === "before");
  assert(sandbox.dropPositionForRow(row, 145) === "inside");
  assert(sandbox.dropPositionForRow(row, 185) === "after");
  const imported = sandbox.importScene(`folder Group = {
 expression first = x
}
expression outside = y`);
  sandbox.__debugSetScene(imported);
  assert(sandbox.moveEntryIntoFolder("functions", 1, 0));
  const nested = sandbox.orderedDataEntries(imported).filter((item) => item.parentUid === imported.folders[0]._uid).map((item) => item.entry.id);
  assert(nested.join(",") === "first,outside", nested.join(","));
});

check("status indicators expose diagnostic reasons as hover text", () => {
  sandbox.__debugSetScene(sandbox.importScene("expression eq = x"));
  const html = sandbox.expressionRow("warning", "Equation may be slow", "", "functions", 0, { typeLabel: "value · expression" });
  assert(html.includes('title="Equation may be slow"'), html);
  assert(html.includes('aria-label="Equation may be slow"'), html);
});

check("piecewise expressions support boolean and boundary conditions", () => {
  sandbox.__debugSetScene(sandbox.importScene("boundary positive = x~False"));
  const env=sandbox.buildRuntimeEnv(sandbox.sceneFunctionEnv(true));
  const fn=sandbox.compileExpression("{x>0:1,x<0:-1,0}");
  assert(fn(2,0,env)===1 && fn(-2,0,env)===-1 && fn(0,0,env)===0);
  assert(sandbox.compileExpression("{positive:7}")(2,0,env)===7);
  assert(Number.isNaN(sandbox.compileExpression("{x>0:1}")(-1,0,env)));
  assert(sandbox.expressionToGlsl("{x>0:1,0}",sandbox.sceneFunctionEnv(true)).includes("?"));
  assert(sandbox.textModeExpression("\\left\\{x=1:0,1\\right\\}")==="{x=1:0,1}");
});

check("points and grid settings round-trip through text", () => {
  const imported=sandbox.importScene("set show_coordinate_grid = False\nset show_grid = False\npoint p1 = (2,3)~True~default");
  sandbox.__debugSetScene(imported);
  assert(imported.points[0].x==="2" && imported.points[0].draggable===true && imported.points[0].colorId==="default");
  assert(imported.settings.showCoordinateGrid===false);
  assert(imported.settings.showGrid===false);
  const text=sandbox.exportScene(); assert(text.includes("point p1 = (2,3)~True~default"),text); assert(text.includes("set show_coordinate_grid = False"),text);
});

check("point coordinates compile through property and index selectors", () => {
  sandbox.__debugSetScene(sandbox.importScene("point p1 = (2,3)~True~default"));
  const env=sandbox.buildRuntimeEnv(sandbox.sceneFunctionEnv(true));
  assert(sandbox.normalizeExpressionText("p1[0]*p1[1]")==="p1.x*p1.y",sandbox.normalizeExpressionText("p1[0]*p1[1]"));
  const propertyValue=sandbox.compileExpression("p1.x+p1.y")(0,0,env);
  const indexValue=sandbox.compileExpression("p1[0]*p1[1]")(0,0,env);
  assert(propertyValue===5,`property selector returned ${propertyValue}`);
  assert(indexValue===6,`index selector returned ${indexValue}`);
  const glsl=sandbox.expressionToGlsl("p1.x+p1[1]",sandbox.sceneFunctionEnv(true));
  assert(glsl.includes("2.0"),glsl);
});

check("point dragging keeps the live canvas and commits after release", () => {
  const dragSource=source.slice(source.indexOf("function startPointDrag"),source.indexOf("function schedulePanRender"));
  assert(dragSource.includes("renderScene(validateScene())"),dragSource);
  assert(dragSource.includes("updatePointDragFields(index)"),dragSource);
  assert(dragSource.includes("mathField.latex(latex)"),dragSource);
  assert(dragSource.includes('field.dataset.initializing = "true"'),dragSource);
  assert(!dragSource.includes("renderApp();};const"),dragSource);
});

check("function reference menus can create a selected function", () => {
  const html=sandbox.searchableReference("draws.0.equationId",[{id:"eq"}],"eq","Draw function");
  assert(html.includes('data-new-reference-function="draws.0.equationId"'),html);
  assert(html.includes("New function"),html);
  assert(html.indexOf("New function") < html.indexOf('data-value="eq"'), html);
  assert(sandbox.searchableReference("draws.0.colorId",[{id:"default"}],"default","Draw color").includes("New function"));
  assert(sandbox.searchableReference("draws.0.restrictionId",[{id:"default"}],"default","Draw boundary").includes("New function"));
});

check("colors edit channel expressions directly without helper rows", () => {
  const imported = sandbox.importScene(`expression eq = x
colour sky = 100+5*y~150+sin(x)~220
draw(eq,colour=sky)`);
  sandbox.__debugSetScene(imported);
  assert(imported.functions.length === 1, JSON.stringify(imported.functions));
  assert(imported.colors[0].red === "100+5*y", JSON.stringify(imported.colors[0]));
  const html = sandbox.dataRowContent("colors", imported.colors[0], 0);
  assert(html.includes('data-field="colors.0.red"') && !html.includes('data-reference-picker="colors.0.red"'), html);
  assert(sandbox.validateScene().draws[0].status === "valid", JSON.stringify(sandbox.validateScene().draws[0]));
});

check("color channels expose independent diagnostics", () => {
  const imported = sandbox.importScene(`expression eq = x
colour mixed = eq~missing+~255
draw(eq,colour=mixed)`);
  sandbox.__debugSetScene(imported);
  const diagnostic = sandbox.validateScene().colors[0];
  assert(diagnostic.channels.red.status === "valid", JSON.stringify(diagnostic));
  assert(diagnostic.channels.green.status === "invalid", JSON.stringify(diagnostic));
  assert(diagnostic.channels.blue.status === "valid", JSON.stringify(diagnostic));
  const html = sandbox.dataRowContent("colors", imported.colors[0], 0, diagnostic);
  assert((html.match(/channel-status/g) ?? []).length === 3, html);
});

check("random is deterministic per seed and rejects direct seed arguments", () => {
  const imported = sandbox.importScene(`set random_seed = 42
expression noise = random()`);
  sandbox.__debugSetScene(imported);
  const env = sandbox.buildRuntimeEnv(sandbox.sceneFunctionEnv(true));
  const evaluate = sandbox.compileExpression("random()");
  assert(evaluate(2, 3, env) === evaluate(2, 3, env));
  assert(sandbox.validateExpression("random(42)", {}).status === "invalid");
  assert(sandbox.exportScene().includes("set random_seed = 42"));
  assert(sandbox.buildFragmentShader().includes("u_random_seed"));
});

check("transparency and ordered optional draw components round-trip", () => {
  const source = `expression eq = x
colour rgb = 255~80~40
boundary gate = x~False
transparency glass = 1.4
draw(eq,transparency=glass,colour=rgb,boundary=gate)`;
  const imported = sandbox.importScene(source);
  sandbox.__debugSetScene(imported);
  assert(imported.draws[0].components.map((component)=>component.type).join(",") === "transparency,color,boundary", JSON.stringify(imported.draws[0]));
  assert(imported.draws[0].hidden === false);
  assert(sandbox.validateScene().transparencies[0].status === "valid", JSON.stringify(sandbox.validateScene().transparencies[0]));
  const exported = sandbox.exportScene();
  assert(exported.includes("transparency glass = 1.4"), exported);
  assert(exported.includes("draw(eq,transparency=glass,colour=rgb,boundary=gate)"), exported);
  const shader = sandbox.buildFragmentShader();
  assert(shader.includes("1.0 - clamp(1.4, 0.0, 1.0)") && shader.includes("mix(color, layerColor, opacity)"), shader);
});

check("transparency maps the draw output to x like colour channels", () => {
  const imported = sandbox.importScene(`expression distance = x^2+y
colour rgb = x~x~x
transparency fade = clamp(abs(x),0,1)
draw(distance,colour=rgb,transparency=fade)`);
  sandbox.__debugSetScene(imported);
  const shader = sandbox.buildFragmentShader();
  assert(shader.includes("float z = pow(x,2.0)+y;"), shader);
  assert(shader.includes("clamp3(abs(z),0.0,1.0)"), shader);
  assert(!shader.includes("clamp3(abs(x),0.0,1.0)"), shader);
  const transparency = sandbox.compileExpression(imported.transparencies[0].expression);
  assert(transparency(-0.25, 99, sandbox.buildRuntimeEnv(sandbox.sceneFunctionEnv(true))) === 0.25);
});

check("synchronizing values never reconstructs or groups mixed data order", () => {
  const imported = sandbox.importScene(`expression first = x\ncolour tone = first~first~first\nfolder group = {\n boundary rest = 1~False\n}\ndraw(first,tone,rest,False)`);
  sandbox.__debugSetScene(imported);
  const before = imported.dataOrder.map((ref) => `${ref.kind}:${ref.uid}`).join("|");
  imported.functions = imported.functions.map((entry) => sandbox.functionEntryForScene(entry));
  sandbox.ensureSceneDataOrder(imported);
  const after = imported.dataOrder.map((ref) => `${ref.kind}:${ref.uid}`).join("|");
  assert(after === before, `${before}\n${after}`);
});

check("deleted default IDs are reused without creating extra rows", () => {
  sandbox.__debugSetScene(sandbox.importScene("expression f1 = x"));
  const made = sandbox.addEntry("functions");
  assert(sandbox.__debugScene.functions[made.index].id === "f2");
  sandbox.deleteEntry("functions", made.index);
  assert(sandbox.__debugScene.functions.length === 1);
  const remade = sandbox.addEntry("functions");
  assert(sandbox.__debugScene.functions[remade.index].id === "f2");
});

check("sort control cycles through grouped order", () => {
  assert(sandbox.nextSort("custom") === "dependencies");
  assert(sandbox.nextSort("dependencies") === "az");
  assert(sandbox.nextSort("az") === "za");
  assert(sandbox.nextSort("za") === "group");
  assert(sandbox.nextSort("group") === "custom");
  assert(sandbox.sortLabel("dependencies") === "Dependencies");
  assert(sandbox.sortLabel("group") === "In group");
});

check("dependency mode follows transitive draw references and keeps folder ancestry", () => {
  const imported = sandbox.importScene(`folder Inputs = {
 expression base = x
 expression wave = sin(base)
}
function local(base) = base+1
colour shade = wave~base~0
boundary edge = wave~False
draw(wave,colour=shade,boundary=edge)`);
  sandbox.__debugSetScene(imported);
  const draw = imported.draws[0];
  const included = sandbox.dependencyEntryKeys({ kind: "draws", uid: draw._uid }, imported);
  const key = (kind, entry) => sandbox.entryOrderKey(kind, entry._uid);
  assert(included.has(key("draws", draw)), JSON.stringify([...included]));
  assert(included.has(key("colors", imported.colors[0])), JSON.stringify([...included]));
  assert(included.has(key("restrictions", imported.restrictions[0])), JSON.stringify([...included]));
  assert(included.has(key("functions", imported.functions.find((entry) => entry.id === "wave"))), JSON.stringify([...included]));
  assert(included.has(key("functions", imported.functions.find((entry) => entry.id === "base"))), JSON.stringify([...included]));
  assert(included.has(key("folders", imported.folders[0])), JSON.stringify([...included]));
  assert(!included.has(key("functions", imported.functions.find((entry) => entry.id === "local"))), JSON.stringify([...included]));
});

check("local function parameters are not treated as outer dependencies", () => {
  const imported = sandbox.importScene(`expression banana = 7
function local(banana) = banana+1`);
  sandbox.__debugSetScene(imported);
  const local = imported.functions.find((entry) => entry.id === "local");
  const included = sandbox.dependencyEntryKeys({ kind: "functions", uid: local._uid }, imported);
  assert(included.size === 1, JSON.stringify([...included]));
});

check("drop slots support the first position and the root-list end", () => {
  const imported = sandbox.importScene(`expression first = x
folder Group = {
 expression nested = y
}
expression last = x+y`);
  sandbox.__debugSetScene(imported);
  const lastIndex = imported.functions.findIndex((entry) => entry.id === "last");
  assert(sandbox.moveEntryToDropSlot("functions", lastIndex, { dataset: { entryDropBefore: "functions.0" } }));
  assert(sandbox.orderedDataEntries(imported)[0].entry.id === "last", sandbox.exportScene());
  assert(sandbox.moveEntryToDropSlot("functions", 0, { dataset: { entryDropEnd: "true" } }));
  const rootItems = sandbox.orderedDataEntries(imported).filter((item) => !item.parentUid);
  assert(rootItems.at(-1).entry.id === "first", rootItems.map((item) => item.entry.id).join(","));
});

check("new reference creation adds exactly one compatible line", () => {
  const imported = sandbox.importScene(`expression eq = x
colour shade = 1~2~3
boundary edge = eq~False
transparency fade = 0
draw(eq,colour=shade,boundary=edge,transparency=fade)`);
  sandbox.__debugSetScene(imported);
  const before = sandbox.orderedDataEntries(imported).length;
  const color = sandbox.createReferenceEntry("draws.0.components.0.id");
  assert(color.kind === "colors" && sandbox.orderedDataEntries(imported).length === before + 1, JSON.stringify(color));
  const boundary = sandbox.createReferenceEntry("draws.0.components.1.id");
  assert(boundary.kind === "restrictions" && sandbox.orderedDataEntries(imported).length === before + 2, JSON.stringify(boundary));
  const transparency = sandbox.createReferenceEntry("draws.0.components.2.id");
  assert(transparency.kind === "transparencies" && sandbox.orderedDataEntries(imported).length === before + 3, JSON.stringify(transparency));
  const value = sandbox.createReferenceEntry("draws.0.equationId");
  assert(value.kind === "functions" && sandbox.orderedDataEntries(imported).length === before + 4, JSON.stringify(value));
});

check("new data entries append after imported entries", () => {
  const imported = sandbox.importScene(`expression eq = x`);
  sandbox.__debugSetScene(imported);
  const target = sandbox.addEntry("functions", "data");
  sandbox.__debugScene.functions[target.index].kind = "function";
  const exported = sandbox.exportScene();
  assert(exported.indexOf("expression eq = x") < exported.indexOf("function f"), exported);
});

check("function text imports as a parameterized value", () => {
  const imported = sandbox.importScene(`function wave(a,b)=sqrt(a^2+b^2)
expression eq = wave(x,y)`);
  sandbox.__debugSetScene(imported);
  const mapEntry = sandbox.__debugScene.functions[0];
  assert(mapEntry.kind === "function", JSON.stringify(mapEntry));
  assert(mapEntry.id === "wave", JSON.stringify(mapEntry));
  assert(mapEntry.params.join(",") === "a,b", JSON.stringify(mapEntry));
  const exported = sandbox.exportScene();
  assert(exported.includes("function wave(a,b) = sqrt(a^2+b^2)"), exported);
});

check("text mode includes time playback controls", () => {
  sandbox.__debugSetScene(sandbox.importScene(`time bounded_looped t = 0 range 0~1
expression eq = sin(t+x)`));
  sandbox.__debugSetDisplayMode("text");
  const html = sandbox.renderPanel();
  assert(html.includes('data-action="toggle-global-time"'), html);
  assert(html.includes("Play time") || html.includes("Stop time"), html);
  sandbox.__debugSetDisplayMode("standard");
});

check("updated water sample imports an unbounded time variable", () => {
  const imported = sandbox.importScene(`set max_recursion = 40
time unbounded t = 0
variable eq = sin(sqrt(x^2+y^2)*4-t*2)+0.7*cos(x*2-y*1.5+t)+0.35*sin(y*3+t*1.2)
variable r = 105+65*sin(eq+t*0.2)
variable g = 145+85*cos(x/2+t*0.35)
variable b = 215+35*sin(y/2+t*0.45)
variable rest = 1
colour rgb = r~g~b
boundary rest = rest~False
draw(eq,rgb,rest,False)`);
  sandbox.__debugSetScene(imported);
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.hasErrors === false, JSON.stringify(diagnostics));
  const timeEntry = sandbox.__debugScene.functions.find((entry) => entry.id === "t");
  assert(timeEntry?.time === true && timeEntry.timeMode === "unbounded", JSON.stringify(timeEntry));
});

check("updated star sample compiles without Math.pow runtime errors", () => {
  const imported = sandbox.importScene(`set max_recursion = 40
variable rad = sqrt(x^2+y^2)
variable galaxy = 1/(1+0.08*x^2+0.42*y^2)
variable theta = arctan(y/(x+0.08))
variable arm = 0.5+0.5*sin(3*theta+2.4*rad)
variable core = 1/(1+0.45*rad^2)
variable dust = 1/(1+24*(abs(sin(12.7*x+2.1*sin(y)))+abs(cos(13.3*y+1.9*sin(x)))))
variable eq = galaxy*(0.35+0.65*arm)+core+0.45*dust*galaxy
variable r = 6+95*galaxy*arm+235*core+155*dust*galaxy
variable g = 10+70*galaxy*arm+145*core+145*dust*galaxy
variable b = 32+180*galaxy*arm+225*core+220*dust*galaxy
variable rest = 1
colour rgb = r~g~b
boundary rest = rest~False
draw(eq,rgb,rest,False)`);
  sandbox.__debugSetScene(imported);
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.hasErrors === false, JSON.stringify(diagnostics));
  const env = sandbox.buildRuntimeEnv(sandbox.sceneFunctionEnv(true));
  const value = sandbox.compileExpression("eq")(0.25, 0.5, env);
  assert(Number.isFinite(value), String(value));
});

check("function parameters shadow outer variables with a warning", () => {
  const imported = sandbox.importScene(`variable banana = 10
function f(banana) = banana+1`);
  sandbox.__debugSetScene(imported);
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.functions[1].status === "warning", JSON.stringify(diagnostics.functions));
  assert(diagnostics.functions[1].message.includes("shadows an outer variable or slider"), diagnostics.functions[1].message);
});

check("grid settings accept math expressions aspect ratios and clip export", () => {
  const imported = sandbox.importScene(`set x_min = -pi
set x_max = pi
set y_min = -1
set y_max = 1
set ensure_square_grid = True
set aspect_ratio = sqrt(2):1
set draw_only_inside_boundary = True
variable f1 = x`);
  sandbox.__debugSetScene(imported);
  const viewport = sandbox.sceneViewport();
  assert(Math.abs(viewport.xMin + Math.PI) < 1e-9, JSON.stringify(viewport));
  assert(Math.abs(viewport.xMax - Math.PI) < 1e-9, JSON.stringify(viewport));
  assert(viewport.yMin < -2 && viewport.yMax > 2, JSON.stringify(viewport));
  const exported = sandbox.exportScene();
  assert(exported.includes("set aspect_ratio = sqrt(2):1"), exported);
  assert(exported.includes("set draw_only_inside_boundary = True"), exported);
});

check("export sizing follows settings viewport instead of renderer shape", () => {
  const square = sandbox.exportCanvasSizeForViewport({ xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, { width: 500, height: 1200 });
  assert(square.width === 500 && square.height === 500, JSON.stringify(square));

  const wide = sandbox.exportCanvasSizeForViewport({ xMin: -2, xMax: 2, yMin: -1, yMax: 1 }, { width: 500, height: 1200 });
  assert(wide.width === 500 && wide.height === 250, JSON.stringify(wide));

  const tall = sandbox.exportCanvasSizeForViewport({ xMin: -1, xMax: 1, yMin: -3, yMax: 3 }, { width: 1200, height: 500 });
  assert(tall.width === 167 && tall.height === 500, JSON.stringify(tall));
});

check("export uses GLSL renderer instead of CPU pixel loop", () => {
  const source = sandbox.exportCurrentGraphImage.toString();
  assert(source.includes("renderSceneWebGlInto"), source);
  assert(!source.includes("renderSceneCpuInto"), source);
});

check("invalid viewport bounds warn with square grid and error without it", () => {
  const warningScene = sandbox.importScene(`set x_min = 2
set x_max = 1
set y_min = -1
set y_max = 1
set ensure_square_grid = True`);
  sandbox.__debugSetScene(warningScene);
  assert(sandbox.validateScene().settings[0].status === "warning", JSON.stringify(sandbox.validateScene().settings[0]));

  const errorScene = sandbox.importScene(`set x_min = 2
set x_max = 1
set y_min = -1
set y_max = 1
set ensure_square_grid = False`);
  sandbox.__debugSetScene(errorScene);
  assert(sandbox.validateScene().settings[0].status === "invalid", JSON.stringify(sandbox.validateScene().settings[0]));
});

check("legacy sectioned Lepton language still imports", () => {
  const imported = sandbox.importScene(`F:f1~x+y
~~~~~
C:c1~f1~f1~f1
~~~~~
R:r1~f1~0
~~~~~
D~f1~default~default~0
~~~~~
S:x_min~-15
S:x_max~15
S:y_min~-15
S:y_max~15
S:max_recursion~100
S:angle_mode~degrees
S:background_color~0`);
  assert(imported.functions[0].id === "f1", JSON.stringify(imported.functions));
  assert(imported.colors[0].id === "c1", JSON.stringify(imported.colors));
  assert(imported.restrictions[0].id === "r1", JSON.stringify(imported.restrictions));
  assert(imported.settings.angleMode === "degrees", JSON.stringify(imported.settings));
});

check("refresh text requires confirmation", () => {
  const previousConfirm = sandbox.window.confirm;
  let message = "";
  sandbox.window.confirm = (text) => {
    message = text;
    return false;
  };
  assert(sandbox.confirmTextRefresh() === false, "confirmation should cancel");
  assert(message.includes("lose unsaved text edits"), message);
  sandbox.window.confirm = previousConfirm;
});

check("Lepton text highlighting emits syntax spans without corrupting markup", () => {
  const html = sandbox.highlightLeptonText(`set angle_mode = radians
variable eq = sin(x)+cos(y)
draw(eq,rgb,rest,False)`);
  assert(html.includes('class="syntax-keyword">set</span>'), html);
  assert(html.includes('class="syntax-setting">angle_mode</span>'), html);
  assert(html.includes('class="syntax-boolean">radians</span>'), html);
  assert(html.includes('class="syntax-name">eq</span>'), html);
  assert(html.includes('class="syntax-number">sin</span>'), html);
  assert(html.includes('class="syntax-number">cos</span>'), html);
  assert(html.includes('class="syntax-name">x</span>'), html);
  assert(html.includes('class="syntax-name">y</span>'), html);
  assert(!html.includes('class="syntax-name">syntax'), html);
});

check("Lepton text highlighting recognizes every exported setting", () => {
  const imported = sandbox.importScene("");
  sandbox.__debugSetScene(imported);
  const html = sandbox.highlightLeptonText(sandbox.exportScene());
  for (const key of [
    "x_min", "x_max", "y_min", "y_max", "max_recursion", "angle_mode", "background_color",
    "ensure_square_grid", "aspect_ratio", "draw_only_inside_boundary", "show_coordinate_grid",
    "show_grid", "show_x_axis", "show_y_axis", "show_x_numbers", "show_y_numbers",
    "unbounded_decimal_places", "random_seed"
  ]) {
    assert(html.includes(`class="syntax-setting">${key}</span>`), `${key} was not highlighted as a setting`);
  }
});

check("Lepton text highlighting distinguishes function local variables", () => {
  const html = sandbox.highlightLeptonText(`variable outside = 2
function f(x,banana) = sqrt(2)+x+banana+outside`);
  assert(html.includes('class="syntax-number">sqrt</span>'), html);
  assert(html.includes('class="syntax-name">x</span>'), html);
  assert(html.includes('class="syntax-name">banana</span>'), html);
  assert(html.includes('class="syntax-name">outside</span>'), html);
});

check("hidden draw layers do not invalidate the scene", () => {
  const imported = sandbox.importScene(`F:eq~x
~~~~~
C:rgb~eq~eq~eq
~~~~~
R:rest~eq~0
~~~~~
D~missing~missing~missing~1
~~~~~
S:x_min~-1
S:x_max~1
S:y_min~-1
S:y_max~1
S:max_recursion~20
S:angle_mode~radians`);
  sandbox.__debugSetScene(imported);
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.draws[0].status === "valid", JSON.stringify(diagnostics.draws[0]));
  assert(diagnostics.hasErrors === false, JSON.stringify(diagnostics));
});

check("draw layers can use virtual default function color and boundary", () => {
  const imported = sandbox.importScene(`~~~~~
~~~~~
~~~~~
D~f1~default~default~0
~~~~~
S:x_min~-1
S:x_max~1
S:y_min~-1
S:y_max~1
S:max_recursion~20
S:angle_mode~radians`);
  sandbox.__debugSetScene(imported);
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.draws[0].status === "valid", JSON.stringify(diagnostics.draws[0]));
  assert(diagnostics.hasErrors === false, JSON.stringify(diagnostics));
});

check("legacy virtual default draw ids still resolve", () => {
  const imported = sandbox.importScene(`~~~~~
~~~~~
~~~~~
D~f1~c1~rest~0
~~~~~
S:x_min~-1
S:x_max~1
S:y_min~-1
S:y_max~1
S:max_recursion~20
S:angle_mode~radians`);
  sandbox.__debugSetScene(imported);
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.draws[0].status === "valid", JSON.stringify(diagnostics.draws[0]));
  assert(diagnostics.hasErrors === false, JSON.stringify(diagnostics));
});

check("new draw layer uses virtual defaults on a blank scene", () => {
  sandbox.__debugSetScene({
    ...structuredClone(sandbox.__debugScene),
    functions: [],
    colors: [],
    restrictions: [],
    draws: []
  });
  sandbox.addEntry("draws");
  assert(sandbox.__debugScene.draws[0].equationId === "f1", JSON.stringify(sandbox.__debugScene.draws[0]));
  assert(sandbox.__debugScene.draws[0].components.length === 0, JSON.stringify(sandbox.__debugScene.draws[0]));
  const diagnostics = sandbox.validateScene();
  assert(diagnostics.draws[0].status === "valid", JSON.stringify(diagnostics.draws[0]));
});

check("draw layers can be reordered", () => {
  sandbox.__debugSetScene({
    ...structuredClone(sandbox.__debugScene),
    draws: [
      { equationId: "a", colorId: "rgb", restrictionId: "rest", hidden: false },
      { equationId: "b", colorId: "rgb", restrictionId: "rest", hidden: false },
      { equationId: "c", colorId: "rgb", restrictionId: "rest", hidden: false }
    ]
  });
  sandbox.moveDrawLayer(2, 0);
  assert(sandbox.__debugScene.draws.map((entry) => entry.equationId).join(",") === "c,a,b", JSON.stringify(sandbox.__debugScene.draws));
});

check("background color exports and imports through text mode", () => {
  const imported = sandbox.importScene(`F:r~20
F:g~30
F:b~40
~~~~~
C:bg~r~g~b
~~~~~
R:rest~r~0
~~~~~
D~r~bg~rest~1
~~~~~
S:x_min~-1
S:x_max~1
S:y_min~-1
S:y_max~1
S:max_recursion~20
S:angle_mode~radians
S:background_color~bg`);
  sandbox.__debugSetScene(imported);
  assert(sandbox.__debugScene.settings.backgroundColor === "bg", JSON.stringify(sandbox.__debugScene.settings));
  const exported = sandbox.exportScene();
  assert(exported.includes("set background_color = bg"), exported);
});

check("missing background color falls back to default", () => {
  const imported = sandbox.importScene(`S:background_color~missing`);
  assert(imported.settings.backgroundColor === "0", JSON.stringify(imported.settings));
});

check("saved graphs persist locally with names scenes and thumbnails", () => {
  storage.clear();
  sandbox.__debugSetScene(sandbox.importScene(`variable eq = x
colour rgb = eq~eq~eq
boundary rest = 1~False
draw(eq,rgb,rest,False)`));
  const saved = sandbox.saveCurrentGraph("Local sample");
  assert(saved.name === "Local sample", JSON.stringify(saved));
  assert(saved.scene.includes("expression eq = x"), saved.scene);
  assert(saved.thumbnail.startsWith("data:image/"), saved.thumbnail);
  const graphs = sandbox.loadSavedGraphs();
  assert(graphs.length === 1, JSON.stringify(graphs));
  assert(graphs[0].name === "Local sample", JSON.stringify(graphs));
  sandbox.deleteSavedGraph(graphs[0].id);
  assert(sandbox.loadSavedGraphs().length === 0, JSON.stringify(sandbox.loadSavedGraphs()));
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
