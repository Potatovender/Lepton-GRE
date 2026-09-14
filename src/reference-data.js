import { LATEX_FUNCTIONS } from "./math/builtins.js?v=20260914-functions-reference";

// Documentation is checked against the callable registry during every build.
// Each example is also evaluated by the CPU and GPU regression suites.
export const FUNCTION_REFERENCE = [
  ["sin", "Trigonometry", "sin(angle)", "Sine. Circular angles use the graph's radians or degrees setting.", "sin(0)", 0],
  ["cos", "Trigonometry", "cos(angle)", "Cosine, using the current angle mode.", "cos(0)", 1],
  ["tan", "Trigonometry", "tan(angle)", "Tangent: sin(angle)/cos(angle). Undefined at its poles.", "tan(0)", 0],
  ["sec", "Trigonometry", "sec(angle)", "Reciprocal cosine; undefined where cosine is zero.", "sec(0)", 1],
  ["csc", "Trigonometry", "csc(angle)", "Reciprocal sine; undefined where sine is zero.", "csc(pi/2)", 1],
  ["cot", "Trigonometry", "cot(angle)", "Reciprocal tangent; undefined at its poles.", "cot(pi/4)", 1],
  ["asin", "Trigonometry", "asin(value)", "Inverse sine, also spelled arcsin. Input -1..1; output -pi/2..pi/2, or -90..90 degrees.", "asin(1)", Math.PI / 2],
  ["arcsin", "Trigonometry", "arcsin(value)", "Alias of asin.", "arcsin(1)", Math.PI / 2],
  ["acos", "Trigonometry", "acos(value)", "Inverse cosine, also spelled arccos. Input -1..1; output 0..pi, or 0..180 degrees.", "acos(0)", Math.PI / 2],
  ["arccos", "Trigonometry", "arccos(value)", "Alias of acos.", "arccos(0)", Math.PI / 2],
  ["atan", "Trigonometry", "atan(value)", "Inverse tangent, also spelled arctan. Output -pi/2..pi/2, or -90..90 degrees.", "atan(1)", Math.PI / 4],
  ["arctan", "Trigonometry", "arctan(value)", "Alias of atan.", "arctan(1)", Math.PI / 4],
  ["atan2", "Trigonometry", "atan2(y,x)", "Angle from the positive x-axis to (x,y), with the correct quadrant. The y input comes first. Output -pi..pi, or -180..180 degrees. Lepton uses 0 at (0,0).", "atan2(1,-1)", 3 * Math.PI / 4],
  ["arcsec", "Trigonometry", "arcsec(value)", "Inverse secant: acos(1/value). Requires abs(value) >= 1.", "arcsec(2)", Math.PI / 3],
  ["arccsc", "Trigonometry", "arccsc(value)", "Inverse cosecant: asin(1/value). Requires abs(value) >= 1.", "arccsc(2)", Math.PI / 6],
  ["arccot", "Trigonometry", "arccot(value)", "Inverse cotangent: pi/2-atan(value). Output 0..pi, or 0..180 degrees.", "arccot(1)", Math.PI / 4],
  ["sinh", "Hyperbolic", "sinh(value)", "Hyperbolic sine: (e^value-e^(-value))/2. Hyperbolic functions ignore angle mode.", "sinh(0)", 0],
  ["cosh", "Hyperbolic", "cosh(value)", "Hyperbolic cosine: (e^value+e^(-value))/2.", "cosh(0)", 1],
  ["tanh", "Hyperbolic", "tanh(value)", "Hyperbolic tangent: sinh(value)/cosh(value). Useful for smooth saturation between -1 and 1.", "tanh(0)", 0],
  ["sech", "Hyperbolic", "sech(value)", "Reciprocal hyperbolic cosine.", "sech(0)", 1],
  ["csch", "Hyperbolic", "csch(value)", "Reciprocal hyperbolic sine; undefined at zero.", "csch(1)", 1 / Math.sinh(1)],
  ["coth", "Hyperbolic", "coth(value)", "Reciprocal hyperbolic tangent; undefined at zero.", "coth(1)", 1 / Math.tanh(1)],
  ["arcsinh", "Hyperbolic", "arcsinh(value)", "Inverse hyperbolic sine.", "arcsinh(1)", Math.asinh(1)],
  ["arccosh", "Hyperbolic", "arccosh(value)", "Inverse hyperbolic cosine. Requires value >= 1.", "arccosh(2)", Math.acosh(2)],
  ["arctanh", "Hyperbolic", "arctanh(value)", "Inverse hyperbolic tangent. Requires -1 < value < 1.", "arctanh(0.5)", Math.atanh(0.5)],
  ["arcsech", "Hyperbolic", "arcsech(value)", "Inverse hyperbolic secant. Requires 0 < value <= 1.", "arcsech(0.5)", Math.acosh(2)],
  ["arccsch", "Hyperbolic", "arccsch(value)", "Inverse hyperbolic cosecant. Requires a nonzero value.", "arccsch(1)", Math.asinh(1)],
  ["arccoth", "Hyperbolic", "arccoth(value)", "Inverse hyperbolic cotangent. Requires abs(value) > 1.", "arccoth(2)", Math.atanh(0.5)],
  ["sqrt", "Powers & logarithms", "sqrt(value)", "Nonnegative square root. Requires value >= 0. Pasted \\sqrt{value} works too.", "sqrt(9)", 3],
  ["cbrt", "Powers & logarithms", "cbrt(value)", "Real cube root, including negative inputs.", "cbrt(-8)", -2],
  ["pow", "Powers & logarithms", "pow(base,power)", "Power, equivalent to base^power. For a negative base, use an integer power or cbrt for real cube roots.", "pow(2,3)", 8],
  ["exp", "Powers & logarithms", "exp(value)", "Exponential with base e, equivalent to e^(value). Group negative or compound powers.", "exp(0)", 1],
  ["ln", "Powers & logarithms", "ln(value)", "Natural logarithm (base e). Requires value > 0.", "ln(e)", 1],
  ["log", "Powers & logarithms", "log(value)", "Natural logarithm, the same as ln in Lepton. Use log10 for base ten; log(value)/log(base) for another base.", "log(e)", 1],
  ["log2", "Powers & logarithms", "log2(value)", "Base-two logarithm. Requires value > 0.", "log2(8)", 3],
  ["log10", "Powers & logarithms", "log10(value)", "Base-ten logarithm. Requires value > 0.", "log10(100)", 2],
  ["hypot", "Powers & logarithms", "hypot(a,b)", "Length sqrt(a^2+b^2), with scaling to avoid unnecessary overflow. Useful for distance and radial patterns.", "hypot(3,4)", 5],
  ["abs", "Numbers", "abs(value)", "Absolute value. You can also enter |value|.", "abs(-3)", 3],
  ["sign", "Numbers", "sign(value)", "Returns -1 for negative, 0 for zero, and 1 for positive values.", "sign(-3)", -1],
  ["floor", "Numbers", "floor(value)", "Round down to an integer.", "floor(-1.2)", -2],
  ["ceil", "Numbers", "ceil(value)", "Round up to an integer.", "ceil(-1.2)", -1],
  ["round", "Numbers", "round(value)", "Nearest integer. Halfway values round toward positive infinity.", "round(-1.5)", -1],
  ["frac", "Numbers", "frac(numerator,denominator)", "Division, not fractional part. Also accepts numerator/denominator and frac{numerator}{denominator}. Use a nonzero denominator.", "frac(3,2)", 1.5],
  ["mod", "Numbers", "mod(value,base)", "Floor modulo: value-base*floor(value/base). A positive base gives a result from zero up to, but not including, base. Use a nonzero base.", "mod(-1,5)", 4],
  ["min", "Numbers", "min(a,b)", "Smaller of two values. Lists are evaluated element by element; this does not reduce a list to one minimum.", "min(2,5)", 2],
  ["max", "Numbers", "max(a,b)", "Larger of two values. Lists are evaluated element by element.", "max(2,5)", 5],
  ["clamp", "Numbers", "clamp(value,low,high)", "Limit a value to the inclusive interval low..high. Supply low <= high.", "clamp(2,0,1)", 1],
  ["random", "Numbers", "random()", "Seeded coordinate-dependent value from 0 up to 1. Bare random also works. Takes no arguments; the dice button changes the graph seed. Values are stable at fixed coordinates, not new on every frame.", "random()-random", 0],
  ["step", "Interpolation", "step(edge,value)", "Returns 0 below edge and 1 at or above it. Useful for hard transitions.", "step(0.5,0.5)", 1],
  ["smoothstep", "Interpolation", "smoothstep(low,high,value)", "Smooth cubic transition: 0 at/below low, 1 at/above high. Requires low < high; other ranges are undefined.", "smoothstep(0,1,0.25)", 0.15625],
  ["mix", "Interpolation", "mix(a,b,t)", "Linear interpolation: (1-t)*a+t*b. At t=0 returns a; at t=1 returns b. Values outside 0..1 extrapolate.", "mix(10,20,0.25)", 12.5],
  ["lerp", "Interpolation", "lerp(a,b,t)", "Alias of mix. Combine with smoothstep for a soft transition.", "lerp(10,20,0.25)", 12.5],
  ["union", "Shapes & boundaries", "union(a,b)", "min(a,b). Union of signed-distance shapes when the inside is negative. Use a <= 0 boundary for that convention.", "union(-2,3)", -2],
  ["intersect", "Shapes & boundaries", "intersect(a,b)", "max(a,b). Intersection of shapes whose interiors are negative.", "intersect(-2,3)", 3],
  ["subtract", "Shapes & boundaries", "subtract(a,b)", "max(-a,b). Removes shape a from shape b when interiors are negative; argument order matters.", "subtract(-2,3)", 3],
  ["and", "Shapes & boundaries", "and(a,b)", "min(a,b). For boundaries that draw at >= 0, requires both conditions.", "and(2,-3)", -3],
  ["or", "Shapes & boundaries", "or(a,b)", "max(a,b). For boundaries that draw at >= 0, accepts either condition.", "or(2,-3)", 2],
  ["not", "Shapes & boundaries", "not(a)", "Negates a signed boundary value. Zero remains included because the boundary comparison is inclusive.", "not(2)", -2],
  ["xor", "Shapes & boundaries", "xor(a,b)", "max(min(a,-b),min(-a,b)). Selects opposite signs, with zero on the shared boundary.", "xor(2,-3)", 2],
  ["xand", "Shapes & boundaries", "xand(a,b)", "max(min(a,b),min(-a,-b)). Selects matching signs, with zero on the shared boundary.", "xand(2,3)", 2]
].map(([name, category, signature, description, example, expected]) => ({ name, category, signature, description, example, expected }));

export function validateFunctionReference() {
  const names = FUNCTION_REFERENCE.map((entry) => entry.name);
  if (new Set(names).size !== names.length) throw new Error("Duplicate function reference entry");
  if (names.length !== Object.keys(LATEX_FUNCTIONS).length || names.some((name) => !LATEX_FUNCTIONS[name])) {
    throw new Error("Function reference must cover every supported built-in exactly once");
  }
  for (const entry of FUNCTION_REFERENCE) {
    const args = entry.signature.slice(entry.signature.indexOf("(") + 1, -1);
    if ((args ? args.split(",").length : 0) !== LATEX_FUNCTIONS[entry.name].args) {
      throw new Error(`Reference arity mismatch: ${entry.name}`);
    }
  }
}

export function renderFunctionReference() {
  validateFunctionReference();
  const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  return [...new Set(FUNCTION_REFERENCE.map((entry) => entry.category))].map((category) => `
    <section class="function-group" aria-label="${escape(category)}">
      <h3>${escape(category)}</h3>
      ${FUNCTION_REFERENCE.filter((entry) => entry.category === category).map((entry) => `
        <article class="function-entry" id="fn-${entry.name}">
          <h4><code>${escape(entry.signature)}</code></h4>
          <p>${escape(entry.description)}</p>
          <p class="function-example"><code>${escape(entry.example)}</code><span>${Number(entry.expected.toPrecision(7)) === entry.expected ? "=" : "&#8776;"} ${escape(Number(entry.expected.toPrecision(7)))}</span></p>
        </article>`).join("")}
    </section>`).join("");
}
