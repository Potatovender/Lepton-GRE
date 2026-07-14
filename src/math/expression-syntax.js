export const UNARY_OPERAND_PRECEDENCE = 29;

export function getOpPrecedence(op) {
  if (op === "+" || op === "-") return 10;
  if (op === "*" || op === "/") return 20;
  if (op === "^") return 30;
  return 0;
}

export function normalizeMathSyntax(expression) {
  return String(expression)
    .replaceAll(/(^|[^A-Za-z0-9_])(\d+(?:\.\d+)?)(?=[A-Za-z_])/g, "$1$2*")
    .replaceAll(/(^|[^A-Za-z0-9_])(\d+(?:\.\d+)?)(?=\()/g, "$1$2*")
    .replaceAll(/\)(?=\d|[A-Za-z_(])/g, ")*")
    .replaceAll(/\b(x|y|pi|e)\b(?=\()/g, "$1*");
}

export function convertPowers(expression) {
  let output = String(expression);
  let guard = 0;
  while (output.includes("^") && guard < 200) {
    guard += 1;
    const index = output.lastIndexOf("^");
    const left = findLeftOperand(output, index - 1);
    const right = findRightOperand(output, index + 1);
    if (!left || !right) break;
    output = `${output.slice(0, left.start)}pow(${left.value},${right.value})${output.slice(right.end)}`;
  }
  return output;
}

function findLeftOperand(source, index) {
  let i = skipSpacesLeft(source, index);
  if (i < 0) return null;
  if (source[i] === ")") {
    let depth = 0;
    for (let j = i; j >= 0; j -= 1) {
      if (source[j] === ")") depth += 1;
      if (source[j] === "(") depth -= 1;
      if (depth === 0) {
        let start = j;
        let nameIndex = j - 1;
        while (nameIndex >= 0 && /[A-Za-z0-9_]/.test(source[nameIndex])) nameIndex -= 1;
        if (nameIndex < j - 1 && /[A-Za-z_]/.test(source[nameIndex + 1])) start = nameIndex + 1;
        return { start, end: i + 1, value: source.slice(start, i + 1) };
      }
    }
    return null;
  }
  const end = i + 1;
  while (i >= 0 && /[\w.]/.test(source[i])) i -= 1;
  return { start: i + 1, end, value: source.slice(i + 1, end) };
}

function findRightOperand(source, index) {
  let i = skipSpacesRight(source, index);
  if (i >= source.length) return null;
  const start = i;
  if (source[i] === "+" || source[i] === "-") i = skipSpacesRight(source, i + 1);
  if (source[i] === "(") {
    const end = matchingParen(source, i);
    return end === -1 ? null : { start, end: end + 1, value: source.slice(start, end + 1) };
  }
  const identifier = source.slice(i).match(/^[A-Za-z_]\w*/)?.[0];
  if (identifier) {
    i += identifier.length;
    if (source[i] === "(") {
      const end = matchingParen(source, i);
      return end === -1 ? null : { start, end: end + 1, value: source.slice(start, end + 1) };
    }
    return { start, end: i, value: source.slice(start, i) };
  }
  while (i < source.length && /[\d.]/.test(source[i])) i += 1;
  return i === start ? null : { start, end: i, value: source.slice(start, i) };
}

function matchingParen(source, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function skipSpacesLeft(source, index) {
  let i = index;
  while (i >= 0 && /\s/.test(source[i])) i -= 1;
  return i;
}

function skipSpacesRight(source, index) {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  return i;
}
