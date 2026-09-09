// Public function metadata shared by editing, naming, and call validation.
// CPU/GLSL implementations remain explicit and are checked by the parity suite.
const definitions = {
  sin: { args: 1, latex: "\\sin" },
  cos: { args: 1, latex: "\\cos" },
  tan: { args: 1, latex: "\\tan" },
  asin: { args: 1, display: "arcsin", latex: "\\arcsin" },
  acos: { args: 1, display: "arccos", latex: "\\arccos" },
  atan: { args: 1, display: "arctan", latex: "\\arctan" },
  arcsin: { args: 1, latex: "\\arcsin" },
  arccos: { args: 1, latex: "\\arccos" },
  arctan: { args: 1, latex: "\\arctan" },
  arcsec: { args: 1 },
  arccsc: { args: 1 },
  arccot: { args: 1 },
  sinh: { args: 1, latex: "\\sinh" },
  cosh: { args: 1, latex: "\\cosh" },
  tanh: { args: 1, latex: "\\tanh" },
  sech: { args: 1 },
  csch: { args: 1 },
  coth: { args: 1 },
  arcsinh: { args: 1 },
  arccosh: { args: 1 },
  arctanh: { args: 1 },
  arcsech: { args: 1 },
  arccsch: { args: 1 },
  arccoth: { args: 1 },
  sqrt: { args: 1, latex: "\\sqrt" },
  cbrt: { args: 1 },
  log: { args: 1, latex: "\\log" },
  ln: { args: 1, latex: "\\ln" },
  abs: { args: 1 },
  sign: { args: 1 },
  floor: { args: 1 },
  ceil: { args: 1 },
  round: { args: 1 },
  exp: { args: 1, latex: "\\exp" },
  sec: { args: 1, latex: "\\sec" },
  csc: { args: 1, latex: "\\csc" },
  cot: { args: 1, latex: "\\cot" },
  min: { args: 2, latex: "\\min" },
  max: { args: 2, latex: "\\max" },
  clamp: { args: 3 },
  union: { args: 2 },
  intersect: { args: 2 },
  subtract: { args: 2 },
  and: { args: 2 },
  or: { args: 2 },
  not: { args: 1 },
  xand: { args: 2 },
  xor: { args: 2 },
  random: { args: 0 },
  frac: { args: 2 },
};

export const LATEX_FUNCTIONS = Object.freeze(Object.fromEntries(
  Object.entries(definitions).map(([name, definition]) => [name, Object.freeze({ internal: name, display: name, ...definition })])
));
export const STANDARD_LATEX_COMMANDS = Object.freeze(Object.fromEntries(
  Object.entries(LATEX_FUNCTIONS).map(([name, definition]) => [name, definition.latex ?? `\\operatorname{${name}}`])
));
export const MATHQUILL_OPERATOR_NAMES = Object.keys(LATEX_FUNCTIONS).filter((name) => !["sqrt", "frac"].includes(name)).join(" ");
export const BUILTIN_NAMES = new Set([
  ...Object.keys(LATEX_FUNCTIONS), "x", "y", "z", "pi", "e", "pow", "Math", "PI", "ref", "NaN"
]);
