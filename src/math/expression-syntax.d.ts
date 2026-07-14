export const UNARY_OPERAND_PRECEDENCE: number;
export function getOpPrecedence(op: string): number;
export function normalizeMathSyntax(expression: string): string;
export function convertPowers(expression: string): string;
