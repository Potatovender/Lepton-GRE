import type { AngleMode, NumericResult } from "../types";

export type EquationEnvironment = Record<string, Equation>;

type EvalValue = number | "nan" | "invalid";
type NodeOp = string | number;

type Operator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "^"
  | "%"
  | "exp"
  | "frac"
  | "sin"
  | "cos"
  | "tan"
  | "sec"
  | "csc"
  | "cot"
  | "asin"
  | "acos"
  | "atan"
  | "arcsin"
  | "arccos"
  | "arctan"
  | "arcsec"
  | "arccsc"
  | "arccot"
  | "sinh"
  | "cosh"
  | "tanh"
  | "sech"
  | "csch"
  | "coth"
  | "arcsinh"
  | "arccosh"
  | "arctanh"
  | "arcsech"
  | "arccsch"
  | "arccoth"
  | "log"
  | "ln"
  | "sqrt"
  | "cbrt"
  | "abs"
  | "sign"
  | "floor"
  | "ceil"
  | "round"
  | "min"
  | "max"
  | "clamp"
  | "pi"
  | "e";

const PRECEDENCE: Record<Operator, [number, number]> = {
  "+": [1, 2],
  "-": [1, 2],
  "*": [2, 2],
  "/": [2, 2],
  "^": [3, 2],
  "%": [2, 2],
  exp: [4, 1],
  frac: [2, 2],
  sin: [4, 1],
  cos: [4, 1],
  tan: [4, 1],
  sec: [4, 1],
  csc: [4, 1],
  cot: [4, 1],
  asin: [4, 1],
  acos: [4, 1],
  atan: [4, 1],
  arcsin: [4, 1],
  arccos: [4, 1],
  arctan: [4, 1],
  arcsec: [4, 1],
  arccsc: [4, 1],
  arccot: [4, 1],
  sinh: [4, 1],
  cosh: [4, 1],
  tanh: [4, 1],
  sech: [4, 1],
  csch: [4, 1],
  coth: [4, 1],
  arcsinh: [4, 1],
  arccosh: [4, 1],
  arctanh: [4, 1],
  arcsech: [4, 1],
  arccsch: [4, 1],
  arccoth: [4, 1],
  log: [4, 1],
  ln: [4, 1],
  sqrt: [4, 1],
  cbrt: [4, 1],
  abs: [4, 1],
  sign: [4, 1],
  floor: [4, 1],
  ceil: [4, 1],
  round: [4, 1],
  min: [4, 2],
  max: [4, 2],
  clamp: [4, 3],
  pi: [5, 0],
  e: [5, 0]
};

const REPLACEABLE: Record<string, Operator> = {
  cdot: "*",
  times: "*"
};

const isOperator = (token: string): token is Operator =>
  Object.prototype.hasOwnProperty.call(PRECEDENCE, token);
const isNumberToken = (token: string): boolean => /^(\d+\.?\d*|\.\d+)$/.test(token);
const isCustomVariable = (token: string): boolean => token.startsWith("~") && token.endsWith("~");
const isWordToken = (token: string): boolean => /^[A-Za-z]+$/.test(token);

export class Equation {
  private readonly tree: Node;

  constructor(source: string) {
    const parsed = buildTree(tokenize(source));
    this.tree = parsed ?? new Node("invalid");
  }

  evaluate(
    x: number,
    y: number,
    angleMode: AngleMode = "radians",
    env: EquationEnvironment = {},
    depth = 50
  ): NumericResult {
    if (depth < 0) {
      return Math.sqrt(x * x + y * y);
    }

    const result = this.tree.evaluate(x, y, angleMode === "radians", env, depth);
    return Number.isFinite(result as number) ? result : result === "invalid" ? "invalid" : "nan";
  }

  size(env: EquationEnvironment = {}, depth = 50): number {
    return this.tree.size(env, depth);
  }

  astToString(): string {
    return this.tree.astToString();
  }
}

function tokenize(source: string): string[] {
  const replacements: Record<string, string> = {
    "{": "(",
    "}": ")",
    "(-": "(0-",
    "\\left(": "(",
    "\\right)": ")"
  };

  let equation = source.replaceAll("}{", ",").replaceAll(" ", "");

  for (const [from, to] of Object.entries(replacements)) {
    equation = equation.replaceAll(from, to);
  }

  if (equation.startsWith("-")) {
    equation = `0${equation}`;
  }

  const tokens: string[] = [];
  let i = 0;

  while (i < equation.length) {
    const char = equation[i];

    if (/\d|\./.test(char)) {
      let unit = "";
      while (i < equation.length && /[\d.]/.test(equation[i])) {
        unit += equation[i];
        i += 1;
      }
      tokens.push(unit);
      continue;
    }

    if (/[A-Za-z\\]/.test(char)) {
      let unit = "";
      if (char === "\\") {
        i += 1;
      }
      while (i < equation.length && /[A-Za-z]/.test(equation[i])) {
        unit += equation[i];
        i += 1;
      }
      if (unit !== "left" && unit !== "right") {
        tokens.push(unit);
      }
      continue;
    }

    if (char === "~") {
      let unit = "~";
      i += 1;
      while (i < equation.length && equation[i] !== "~") {
        unit += equation[i];
        i += 1;
      }
      if (i < equation.length && equation[i] === "~") {
        unit += equation[i];
        i += 1;
      }
      tokens.push(unit);
      continue;
    }

    if ("+-*/^(),".includes(char)) {
      tokens.push(char);
      i += 1;
      continue;
    }

    i += 1;
  }

  const finalTokens: string[] = [];
  for (let j = 0; j < tokens.length; j += 1) {
    const currentToken = tokens[j];
    const nextToken = tokens[j + 1];
    finalTokens.push(currentToken);

    if (!nextToken) {
      continue;
    }

    const currentIsOperand =
      isNumberToken(currentToken) ||
      currentToken === "x" ||
      currentToken === "y" ||
      currentToken === ")" ||
      currentToken === "pi" ||
      currentToken === "e" ||
      isCustomVariable(currentToken);
    const nextCanMultiply =
      isWordToken(nextToken) ||
      nextToken === "x" ||
      nextToken === "y" ||
      nextToken === "(" ||
      nextToken === "pi" ||
      nextToken === "e" ||
      isCustomVariable(nextToken);

    if (currentIsOperand && nextCanMultiply) {
      finalTokens.push("*");
    }
  }

  return finalTokens;
}

function buildTree(tokens: string[]): Node | null {
  const outputStack: Node[] = [];
  const operatorStack: string[] = [];
  let broken = false;

  const applyOperator = (): void => {
    const op = operatorStack.pop();
    if (!op || !isOperator(op)) {
      broken = true;
      outputStack.push(new Node("invalid"));
      return;
    }

    const childCount = PRECEDENCE[op][1];
    const children: Node[] = [];

    for (let i = 0; i < childCount; i += 1) {
      const child = outputStack.pop();
      if (!child) {
        broken = true;
        outputStack.push(new Node("invalid"));
        return;
      }
      children.unshift(child);
    }

    outputStack.push(new Node(op, children));
  };

  for (const token of tokens) {
    if (isNumberToken(token)) {
      outputStack.push(new Node(Number(token)));
    } else if (token === "x" || token === "y") {
      outputStack.push(new Node(token));
    } else if (isCustomVariable(token)) {
      outputStack.push(new Node(token));
    } else if (token === "(") {
      operatorStack.push(token);
    } else if (token === ")") {
      while (operatorStack.length > 0 && operatorStack.at(-1) !== "(") {
        applyOperator();
      }
      if (operatorStack.length === 0) {
        broken = true;
      } else {
        operatorStack.pop();
      }
    } else if (isOperator(token)) {
      while (
        operatorStack.length > 0 &&
        operatorStack.at(-1) !== "(" &&
        isOperator(operatorStack.at(-1) ?? "") &&
        (
          PRECEDENCE[operatorStack.at(-1) as Operator][0] > PRECEDENCE[token][0] ||
          (PRECEDENCE[operatorStack.at(-1) as Operator][0] === PRECEDENCE[token][0] && token !== "^")
        )
      ) {
        applyOperator();
      }
      operatorStack.push(token);
    } else if (token in REPLACEABLE) {
      const replacement = REPLACEABLE[token];
      while (
        operatorStack.length > 0 &&
        operatorStack.at(-1) !== "(" &&
        isOperator(operatorStack.at(-1) ?? "") &&
        PRECEDENCE[operatorStack.at(-1) as Operator][0] >= PRECEDENCE[replacement][0]
      ) {
        applyOperator();
      }
      operatorStack.push(replacement);
    } else if (token === ",") {
      while (operatorStack.length > 0 && operatorStack.at(-1) !== "(") {
        applyOperator();
      }
    } else {
      broken = true;
    }

    if (broken) {
      return new Node("invalid");
    }
  }

  while (operatorStack.length > 0) {
    if (operatorStack.at(-1) === "(") {
      return new Node("invalid");
    }
    applyOperator();
    if (broken) {
      return new Node("invalid");
    }
  }

  return outputStack.length === 1 ? outputStack[0] : outputStack[0] ?? null;
}

class Node {
  constructor(
    private readonly op: NodeOp,
    private readonly children: Node[] = []
  ) {}

  size(env: EquationEnvironment = {}, depth = 50): number {
    let totalNodes = 0;
    const stack: Array<[Node, number]> = [[this, depth]];

    while (stack.length > 0) {
      const [currentNode, currentDepth] = stack.pop() as [Node, number];
      totalNodes += 1;

      if (currentDepth < 0) {
        continue;
      }

      if (typeof currentNode.op === "string" && isCustomVariable(currentNode.op)) {
        const variableName = currentNode.op.slice(1, -1);
        const equation = env[variableName];
        if (equation) {
          stack.push([equation.tree, currentDepth - 1]);
        }
      } else {
        for (const child of currentNode.children) {
          stack.push([child, currentDepth]);
        }
      }
    }

    return totalNodes;
  }

  astToString(): string {
    if (this.children.length === 0) {
      return String(this.op);
    }

    if (typeof this.op === "string" && ["+", "-", "*", "/", "^", "%"].includes(this.op) && this.children.length === 2) {
      return `(${this.children[0].astToString()}${this.op}${this.children[1].astToString()})`;
    }

    return `${String(this.op)}(${this.children.map((child) => child.astToString()).join(",")})`;
  }

  evaluate(x: number, y: number, useRadians = true, env: EquationEnvironment = {}, depth = 50): EvalValue {
    try {
      const values = this.children.map((child) => child.evaluate(x, y, useRadians, env, depth));

      if (this.op === "invalid" || values.some((value) => value === "invalid")) {
        return "invalid";
      }
      if (this.op === "nan" || values.some((value) => value === "nan")) {
        return "nan";
      }

      const vals = values as number[];

      if (typeof this.op === "number") {
        return this.op;
      }
      if (this.op === "") {
        return 0;
      }
      if (this.op === "x") {
        return x;
      }
      if (this.op === "y") {
        return y;
      }
      if (this.op === "pi") {
        return Math.PI;
      }
      if (this.op === "e") {
        return Math.E;
      }
      if (isCustomVariable(this.op)) {
        const variableName = this.op.slice(1, -1);
        const equation = env[variableName];
        return equation ? equation.evaluate(x, y, useRadians ? "radians" : "degrees", env, depth - 1) : "nan";
      }

      return evaluateOperator(this.op, vals, useRadians);
    } catch {
      return "nan";
    }
  }
}

function evaluateOperator(op: string, vals: number[], useRadians: boolean): EvalValue {
  if (op === "+") return vals[0] + vals[1];
  if (op === "-") return vals[0] - vals[1];
  if (op === "*") return vals[0] * vals[1];
  if (op === "/") return vals[1] !== 0 ? vals[0] / vals[1] : "nan";
  if (op === "^") return Math.pow(vals[0], vals[1]);
  if (op === "%") return vals[1] > 0 ? vals[0] % vals[1] : "nan";

  if (op === "exp") return Math.exp(vals[0]);
  if (op === "frac") return vals[1] !== 0 ? vals[0] / vals[1] : "nan";
  if (op === "ln") return vals[0] > 0 ? Math.log(vals[0]) : "nan";
  if (op === "log") return vals[0] > 0 ? Math.log(vals[0]) : "nan";
  if (op === "sqrt") return vals[0] >= 0 ? Math.sqrt(vals[0]) : "nan";
  if (op === "cbrt") return Math.cbrt(vals[0]);

  const trigInput = !useRadians && ["sin", "cos", "tan", "sec", "csc", "cot"].includes(op) ? toRadians(vals[0]) : vals[0];
  if (op === "sin") return Math.sin(trigInput);
  if (op === "cos") return Math.cos(trigInput);
  if (op === "tan") return Math.cos(trigInput) !== 0 ? Math.tan(trigInput) : "nan";
  if (op === "cot") return Math.sin(trigInput) !== 0 ? Math.tan(Math.PI / 2 - trigInput) : "nan";
  if (op === "sec") return Math.cos(trigInput) !== 0 ? 1 / Math.cos(trigInput) : "nan";
  if (op === "csc") return Math.sin(trigInput) !== 0 ? 1 / Math.sin(trigInput) : "nan";

  if (op === "arctan") return fromRadians(Math.atan(vals[0]), useRadians);
  if (op === "atan") return fromRadians(Math.atan(vals[0]), useRadians);
  if (op === "arccot") return fromRadians(Math.PI / 2 - Math.atan(vals[0]), useRadians);
  if (op === "arcsin") return Math.abs(vals[0]) <= 1 ? fromRadians(Math.asin(vals[0]), useRadians) : "nan";
  if (op === "asin") return Math.abs(vals[0]) <= 1 ? fromRadians(Math.asin(vals[0]), useRadians) : "nan";
  if (op === "arccos") return Math.abs(vals[0]) <= 1 ? fromRadians(Math.acos(vals[0]), useRadians) : "nan";
  if (op === "acos") return Math.abs(vals[0]) <= 1 ? fromRadians(Math.acos(vals[0]), useRadians) : "nan";
  if (op === "arcsec") return vals[0] ** 2 >= 1 ? fromRadians(Math.acos(1 / vals[0]), useRadians) : "nan";
  if (op === "arccsc") return vals[0] ** 2 >= 1 ? fromRadians(Math.asin(1 / vals[0]), useRadians) : "nan";

  if (op === "sinh") return Math.sinh(vals[0]);
  if (op === "cosh") return Math.cosh(vals[0]);
  if (op === "tanh") return Math.tanh(vals[0]);
  if (op === "sech") return 1 / Math.cosh(vals[0]);
  if (op === "csch") return vals[0] !== 0 ? 1 / Math.sinh(vals[0]) : "nan";
  if (op === "coth") return vals[0] !== 0 ? 1 / Math.tanh(vals[0]) : "nan";
  if (op === "arcsinh") return Math.asinh(vals[0]);
  if (op === "arccosh") return vals[0] >= 1 ? Math.acosh(vals[0]) : "nan";
  if (op === "arcsech") return vals[0] > 0 && vals[0] <= 1 ? Math.acosh(1 / vals[0]) : "nan";
  if (op === "arccsch") return vals[0] !== 0 ? Math.asinh(1 / vals[0]) : "nan";
  if (op === "arctanh") return vals[0] ** 2 < 1 ? Math.atanh(vals[0]) : "nan";
  if (op === "arccoth") return vals[0] ** 2 > 1 ? Math.atanh(1 / vals[0]) : "nan";

  if (op === "abs") return Math.abs(vals[0]);
  if (op === "sign") return vals[0] < 0 ? -1 : vals[0] > 0 ? 1 : 0;
  if (op === "floor") return Math.floor(vals[0]);
  if (op === "ceil") return Math.ceil(vals[0]);
  if (op === "round") return Math.round(vals[0]);
  if (op === "min") return Math.min(vals[0], vals[1]);
  if (op === "max") return Math.max(vals[0], vals[1]);
  if (op === "clamp") return Math.min(Math.max(vals[0], vals[1]), vals[2]);

  return "invalid";
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function fromRadians(value: number, useRadians: boolean): number {
  return useRadians ? value : (value * 180) / Math.PI;
}
