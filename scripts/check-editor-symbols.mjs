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
  source.replace(
    /loadSceneFromUrl\(\);\s*sceneHistory\.last = sceneSnapshot\(\);\s*renderApp\(\);/,
    "globalThis.__debugLatexFunctions = LATEX_FUNCTIONS; globalThis.__debugScene = scene; globalThis.__debugSetScene = (next) => { scene = next; globalThis.__debugScene = scene; };"
  ),
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
  assert(latex === "\\sin(x)\\cdot \\cos(y)", latex);
  assert(sandbox.expressionToGlsl("\\sin(x)\\cdot\\cos(y)", {}) === "sin(x)*cos(y)", "\\cdot should convert to GLSL *");
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
  assert(result.message.includes("rendering may be slower"), result.message);
  assert(!result.message.includes("still attempting"), result.message);
});

check("recursive node estimator red-flags equations above 2^16 nodes", () => {
  sandbox.__debugScene.settings.maxRecursion = 20;
  const env = {
    real: "real^2-imaginary^2+x",
    imaginary: "2*real*imaginary+y",
    c: "x",
    bounds: "1",
    comb: "real+imaginary"
  };
  const result = sandbox.validateExpression("real+imaginary", env, ["comb"]);
  assert(result.status === "invalid", JSON.stringify(result));
  assert(result.message.includes("too large"), result.message);
  assert(result.message.includes("refusing"), result.message);
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
  assert(exported.includes("draw(eq,rgb,rest,True)"), exported);
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
  assert(exported.includes("\nvariable f1 = x+y"), exported);
  assert(exported.includes("\ncolour c1 = f1~f1~f1"), exported);
  assert(exported.includes("\nboundary r1 = f1~False"), exported);
  assert(exported.includes("\ndraw(f1,c1,r1,False)"), exported);
});

check("new Lepton language accepts aliases booleans and invalid angle fallback", () => {
  const imported = sandbox.importScene(`set angle_mode = sideways
set max_recursion = 33
variable f1 = pi+x
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
slider speed = 5
time unbounded t = 0
function f(x,y) = x+y
colour c1 = f~f~f
boundary r1 = f~False
draw(f,c1,r1,False)`);
  sandbox.__debugSetScene(imported);
  const exported = sandbox.exportScene();
  assert(exported.includes("\nvariable y = 100"), exported);
  assert(exported.includes("\nslider speed = 5"), exported);
  assert(exported.includes("\ntime unbounded t = 0"), exported);
  assert(exported.includes("\nfunction f(x,y) = x+y"), exported);

  const env = sandbox.buildRuntimeEnv(sandbox.sceneFunctionEnv(true));
  const value = sandbox.compileExpression("f(2,3)")(0, 0, env);
  assert(value === 5, `expected local parameter call to return 5, got ${value}`);
  const validation = sandbox.validateExpression("f(2,3)", sandbox.sceneFunctionEnv(true));
  assert(validation.status === "valid", JSON.stringify(validation));
  const glsl = sandbox.expressionToGlsl("f(2,3)", sandbox.sceneFunctionEnv(true));
  assert(glsl.includes("2.0") && glsl.includes("3.0") && !glsl.includes("x") && !glsl.includes("y"), glsl);
});

check("Lepton text strips stretchy parentheses from function calls", () => {
  const imported = sandbox.importScene(`function f1(x,y) = x^2+y^2
variable f2 = 2*x+y
variable f3 = f1\\left(f2,3\\right)`);
  sandbox.__debugSetScene(imported);
  const exported = sandbox.exportScene();
  assert(exported.includes("\nfunction f1(x,y) = x^2+y^2"), exported);
  assert(exported.includes("\nvariable f3 = f1(f2,3)"), exported);
  assert(!exported.includes("\\left") && !exported.includes("\\right"), exported);
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
  assert(sandbox.__debugScene.draws[0].colorId === "default", JSON.stringify(sandbox.__debugScene.draws[0]));
  assert(sandbox.__debugScene.draws[0].restrictionId === "default", JSON.stringify(sandbox.__debugScene.draws[0]));
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
