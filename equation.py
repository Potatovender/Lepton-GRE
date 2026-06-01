""" Astra Rendering Engine
Module Description
=====================
This module contains the Color class containing the r,g,b functions required for drawing in pygame
======================
Matthew Chen, Justin Ng, Cindy Liu, Lingnan Meng
"""
from __future__ import annotations  # Fixes the "Unresolved Reference" for Node
import math


class Equation:
    """
    Represents a mathematical equation `f(x, y) = z`.
    Contains a syntax tree generated from a mathematical string expression.
    """

    tree: Node

    def tokenize(self, equas: str) -> list:
        """
        Reads the equation string from left to right, grouping characters
        into tokens based on their type (numbers, operators, functions, variables).
        """

        tokens = []
        i = 0
        # \u and \x are danger characters so be careful

        replacements = {
            '{': '(', '}': ')', '(-': '(0-',
            '\a': '`a', '\b': '`b', '\f': '`f', '\n': '`n', '\r': '`r', '\t': '`t', '\v': '`v',
            '\left(': '(', '\right)': ')'
        }

        equation = equas.replace('}{', ',').replace(' ', '')
        for x in replacements:
            equation = equation.replace(x, replacements[x])
        if equation.startswith('-'):
            equation = '0' + equation
        while i < len(equation):
            char = equation[i]

            # Numbers and decimals
            # if it sees a number then it reads the full number and makes it a token
            if char.isdigit() or char == '.':
                unit = ""
                while i < len(equation) and (equation[i].isdigit() or equation[i] == '.'):
                    unit += equation[i]
                    i += 1
                tokens.append(unit)
                # since i has already been incremented we can just leave it like this

            # Handle LaTeX/Functions (starts with \ or is a word)
            # \\ is just '\'
            # if it sees a word or smth it makes it a token
            elif char.isalpha() or char == '\\':
                unit = ""
                # If it starts with \, keep the backslash but keep going
                if char == '\\':
                    unit += char
                    i += 1
                # Keep grabbing letters until we hit a symbol or number
                while i < len(equation) and equation[i].isalpha():
                    unit += equation[i]
                    i += 1

                # Clean up: remove the leading backslash because we don't need it
                unit = unit.lstrip('\\')
                # allows for input of \left( and \right)
                if unit not in {'left', 'right'}:
                    tokens.append(unit)
            elif char == '~':
                unit = "~"
                i += 1
                # Read until we hit the closing tilde or the end of the string
                while i < len(equation) and equation[i] != '~':
                    unit += equation[i]
                    i += 1
                # Grab the closing tilde if it exists
                # note that if the entire equation gets filled it'll make a bad token
                if i < len(equation) and equation[i] == '~':
                    unit += equation[i]
                    i += 1
                tokens.append(unit)
            # 4. Handle Single Symbols (+, -, *, /, ^, (, ))
            # if it sees a symbol immediately turn it into a token
            # Note: this implementation might need to be changed if you want to
            # allow ** as an input for ^ or smth like that
            elif char in "+-*/^(),":
                tokens.append(char)
                i += 1

            else:
                # skip bad symbols
                i += 1

        # making it so that you can do stuff like 2x instead of 2*x
        final_tokens = []
        for j in range(len(tokens)):
            # runs through the full list and adds tokens to the list
            final_tokens.append(tokens[j])
            if j < len(tokens) - 1:
                curr_token = tokens[j]
                next_token = tokens[j + 1]

                # Check if current token is an operand/variable AND next is a function/variable/open parenthesis
                # If the token that was just added is a digit/x/y/) and the next digit is a letter/(
                # there are other cases of this but i'm too lazy to implement that
                if (curr_token.replace('.', '', 1).isdigit() or curr_token in ('x', 'y', ')', 'pi',
                                                                               'e') or curr_token.startswith('~')):
                    if next_token.isalpha() or next_token in ('x', 'y', '(', 'pi', 'e') or next_token.startswith('~'):
                        final_tokens.append('*')

        return final_tokens

    def __init__(self, infix_string: str) -> None:
        tokenized_input = self.tokenize(infix_string)

        # 1. Tokenize -> 2. Shunting-Yard -> 3. Stack-based Build

        """
        Precedence dictates operation order (BEDMAS).
        Replaceable represents alternative LaTeX formats mapping to standard operators.
        """
        precedence = {
            '+': (1, 2), '-': (1, 2),
            '*': (2, 2), '/': (2, 2),
            '^': (3, 2), '%': (2, 2),
            'exp': (4, 1), 'frac': (2, 2),
            'sin': (4, 1), 'cos': (4, 1), 'tan': (4, 1), 'sec': (4, 1), 'csc': (4, 1), 'cot': (4, 1),
            'arcsin': (4, 1), 'arccos': (4, 1), 'arctan': (4, 1), 'arcsec': (4, 1), 'arccsc': (4, 1), 'arccot': (4, 1),
            'sinh': (4, 1), 'cosh': (4, 1), 'tanh': (4, 1), 'sech': (4, 1), 'csch': (4, 1), 'coth': (4, 1),
            'arcsinh': (4, 1), 'arccosh': (4, 1), 'arctanh': (4, 1), 'arcsech': (4, 1), 'arccsch': (4, 1),
            'arccoth': (4, 1),
            'log': (4, 2), 'ln': (4, 1),
            'sqrt': (4, 1), 'cbrt': (4, 1),
            'abs': (4, 1), 'sign': (4, 1),
            'floor': (4, 1), 'ceil': (4, 1), 'round': (4, 1),
            'min': (4, 2), 'max': (4, 2), 'clamp': (4, 3),
            'pi': (5, 0), 'e': (5, 0)

        }
        replaceable = {
            'cdot': '*', 'times': '*'
        }
        potato = False
        output_stack = []  # This stores our completed Tree Nodes
        operator_stack = []  # This stores operators that are waiting for their children

        def apply_operator() -> None:
            """Pops an operator and its required children to create a subtree."""
            nonlocal potato
            try:
                op = operator_stack.pop()
                num_args = precedence[op][1]

                children = []
                for _ in range(num_args):
                    children.append(output_stack.pop())
                children.reverse()

                output_stack.append(Node(op, children))
            except (IndexError, KeyError):  # <--- Catch KeyError too!
                potato = True
                output_stack.append(Node('potato', []))

        # --- THE SHUNTING-YARD ALGORITHM ---
        for token in tokenized_input:

            # STEP 1: Numbers
            if token.replace('.', '', 1).isdigit():
                output_stack.append(Node(float(token)))

            # STEP 2: Variables (x, y)
            elif token in ('x', 'y'):
                output_stack.append(Node(token))

            # STEP 2.5: Custom UI Variables (e.g., ~eq~)
            # Note that if the token is a bad token this section will not trigger
            elif token.startswith('~') and token.endswith('~'):
                output_stack.append(Node(token))

            # STEP 3: Open Parenthesis
            elif token == '(':
                operator_stack.append(token)

            # STEP 4: Close Parenthesis
            elif token == ')':
                while operator_stack and operator_stack[-1] != '(':
                    apply_operator()

                # If the stack is empty, there are too many closing brackets
                if not operator_stack:
                    potato = True
                else:
                    operator_stack.pop()  # Safely remove the '('

            # STEP 5: Functions and Operators
            elif token in precedence:
                while (operator_stack and operator_stack[-1] != '(' and precedence[operator_stack[-1]][0]
                       >= precedence[token][0]):
                    apply_operator()
                operator_stack.append(token)

            # STEP 6: Replaceable LaTeX (cdot, times)
            elif token in replaceable:
                while (operator_stack and operator_stack[-1] != '(' and precedence[operator_stack[-1]][0]
                       >= precedence[replaceable[token]][0]):
                    apply_operator()
                operator_stack.append(replaceable[token])

            # STEP 7: Multi-Argument Commas
            elif token == ',':
                while operator_stack and operator_stack[-1] != '(':
                    apply_operator()

            # Fail-safe: If the tree broke during this step, abort
            if potato:
                self.tree = Node("potato", [])
                return

        # --- FINAL CLEANUP ---
        while operator_stack:
            # If there's an unclosed '(' left, the user forgot a ')'
            if operator_stack[-1] == '(':
                potato = True
                break

            apply_operator()

            if potato:
                self.tree = Node("potato", [])
                return

        # Final safety check: if it's broken or completely empty
        if potato or not output_stack:
            self.tree = Node("potato", [])
            return

        # The very last item on the output stack is the Root of our tree!
        self.tree = output_stack[0]

    def evaluate(self, x: float, y: float, angle_mode: str = "radians", env: dict = None, depth: int = 50) \
            -> float | str:
        """
        Evaluates the equation syntax tree for a specific (x, y) coordinate.
        Returns the computed float, or 'nan' on complex or invalid paths.
        """
        if depth < 0:
            return (x ** 2 + y ** 2) ** 0.5

        if env is None:
            env = {}

        mode = False if angle_mode == "degrees" else True

        try:
            result = self.tree.evaluate(x, y, mode, env)

            return result if not isinstance(result, complex) else 'nan'

        except RecursionError:
            # We hit the stack overflow!
            return (x ** 2 + y ** 2) ** 0.5

    def size(self, env: dict = None, depth: int = 50) -> int:
        """Returns the total number of nodes in this equation's evaluation tree."""
        if env is None:
            env = {}
        return self.tree.size(env, depth)

    def ast_to_string(self) -> str:
        """Returns a string representation of the parsed AST."""
        return self.tree.ast_to_string()


class Node:
    """
        The Node class of the AST, with an operation, and a sorted list of nodes
        operation is either a math operation, variable, or value
    """
    # op is either a string (the operation) or a value (a number or x or y)
    op: str
    children: list

    def __init__(self, op: str, children: list = None) -> None:
        self.op = op
        # children must be an ordered list
        self.children = children if children is not None else []

    def size(self, env: dict = None, depth: int = 50) -> int:
        """
            returns the total number of nodes in this subtree.
        """
        total_nodes = 0

        # Stack holds tuples of: (Node, current_depth)
        stack = [(self, depth)]

        while stack:
            # Pop the most recent node off our list
            current_node, current_depth = stack.pop()
            total_nodes += 1

            # If we cross the depth threshold, we count the node as a leaf (fallback) and stop expanding
            if current_depth < 0:
                continue

            # Check if this node is a UI variable
            if isinstance(current_node.op, str) and current_node.op.startswith('~') and current_node.op.endswith('~'):
                var_name = current_node.op[1:-1]

                if env and var_name in env:
                    # Push the referenced equation's tree onto the stack, and DECREMENT the depth
                    stack.append((env[var_name].tree, current_depth - 1))

            else:
                # Standard math node: push all children to the stack (depth stays the same)
                for child in current_node.children:
                    stack.append((child, current_depth))

        return total_nodes

    def ast_to_string(self) -> str:
        """
            returns a string representation of the AST ex. "2*cos(x)+5"
        """
        # base case: leaf node
        if len(self.children) == 0:
            return str(self.op)
        ni = ""
        # infix operators
        if self.op in ('+', '-', '*', '/', '^', '%') and len(self.children) == 2:
            ni += "(" + self.children[0].ast_to_string()
            ni += str(self.op)
            ni += self.children[1].ast_to_string() + ")"
            return ni

        # unary functions in prefix style
        ni += str(self.op) + "("
        for x in self.children:
            ni += x.ast_to_string() + ","
        ni = ni[:-1] + ")"
        return ni

    def evaluate(self, x: float, y: float, use_radians: bool = True, env: dict = None, depth: int = 50) \
            -> str | int | float | complex:
        """
            returns the computed value of the ast given the x,y coordinates and depending on radians and degrees.
        """
        try:
            # Evaluate children first
            vals = [c.evaluate(x, y, use_radians, env, depth) for c in self.children]

            if self.op == 'invalid' or any(c == 'invalid' for c in vals):
                # invalid input error
                return 'invalid'
            if self.op == 'nan' or any(c == 'nan' for c in vals):
                # not a number error
                return 'nan'

            # Every time you add a function to precedence add its implementation down here
            # base cases
            if isinstance(self.op, float):
                return float(self.op)
            # this is a surprise tool that will help us later
            if isinstance(self.op, complex):
                return complex(self.op)
            if self.op == '':
                return 0.0
            if self.op == 'x':
                return x
            if self.op == 'y':
                return y
            if self.op == 'pi':
                return math.pi
            if self.op == 'e':
                return math.e

            if isinstance(self.op, str) and self.op.startswith('~') and self.op.endswith('~'):
                var_name = self.op[1:-1]  # Strip the tildes to match dictionary keys

                # If the variable exists in our UI dictionary
                if env and var_name in env:
                    # Recursively evaluate the nested equation, increasing depth by 1
                    return env[var_name].evaluate(x, y, "radians" if use_radians else "degrees", env, depth - 1)
                else:
                    return 'nan'  # Variable hasn't been defined yet

            # simple operations
            if self.op == '+':
                return vals[0] + vals[1]
            if self.op == '-':
                return vals[0] - vals[1]
            if self.op == '*':
                return vals[0] * vals[1]
            if self.op == '/':
                return vals[0] / vals[1] if vals[1] != 0 else 'nan'
            # ive decided that we will allow complex values when returning this thing because i'm lazy
            if self.op == '^':
                return vals[0] ** vals[1]
            if self.op == '%':
                return vals[0] % vals[1] if vals[1] > 0 else 'nan'

            # variations on transcendentals
            if self.op == 'exp':
                return math.e ** vals[0]
            if self.op == 'frac':
                return vals[0] / vals[1] if vals[1] != 0 else 'nan'
            if self.op == 'ln':
                return math.log(vals[0]) if vals[0] > 0 else 'nan'
            if self.op == 'log':
                return math.log(vals[1], vals[0]) if (vals[0] > 0 and vals[0] != 1 and vals[1] > 0) else 'nan'
            if self.op == 'sqrt':
                return math.sqrt(vals[0]) if vals[0] >= 0 else 'nan'
            if self.op == 'cbrt':
                return vals[0] ** (1 / 3)

            # If measurements in degrees, change that
            trig_input = vals[0] if len(vals) > 0 else None
            if use_radians is False and self.op in ('sin', 'cos', 'tan', 'sec', 'csc', 'cot'):
                trig_input = math.radians(vals[0])
            # Unrestricted Trig
            if self.op == 'sin':
                return math.sin(trig_input)
            if self.op == 'cos':
                return math.cos(trig_input)
            if self.op == 'arctan':
                result = math.atan(vals[0])
                return math.degrees(result) if use_radians is False else result
            if self.op == 'arccot':
                result = math.pi / 2 - math.atan(vals[0])
                return math.degrees(result) if use_radians is False else result

            # trig with bad values
            if self.op == 'cot':
                return math.tan((math.pi / 2 - trig_input)) if math.sin(trig_input) != 0.0 else 'nan'
            if self.op == 'tan':
                return math.tan(trig_input) if math.cos(trig_input) != 0.0 else 'nan'
            if self.op == 'csc':
                return 1 / math.sin(trig_input) if math.sin(trig_input) != 0.0 else 'nan'
            if self.op == 'sec':
                return 1 / math.cos(trig_input) if math.cos(trig_input) != 0.0 else 'nan'
            if self.op == 'arcsin':
                result = math.asin(vals[0]) if vals[0] ** 2 <= 1 else 'nan'
                return math.degrees(result) if result != 'nan' and use_radians is False else result
            if self.op == 'arccos':
                result = math.acos(vals[0]) if vals[0] ** 2 <= 1 else 'nan'
                return math.degrees(result) if result != 'nan' and use_radians is False else result
            if self.op == 'arcsec':
                result = math.acos(1 / vals[0]) if vals[0] ** 2 >= 1 else 'nan'
                return math.degrees(result) if result != 'nan' and use_radians is False else result
            if self.op == 'arccsc':
                result = math.asin(1 / vals[0]) if vals[0] ** 2 >= 1 else 'nan'
                return math.degrees(result) if result != 'nan' and use_radians is False else result

            # unrestricted hyperbolic trig
            if self.op == 'sinh':
                return math.sinh(vals[0])
            if self.op == 'cosh':
                return math.cosh(vals[0])
            if self.op == 'tanh':
                return math.tanh(vals[0])
            if self.op == 'sech':
                return 1 / math.cosh(vals[0])
            if self.op == 'arcsinh':
                return math.asinh(vals[0])

            # hyperbolic trig with bad values
            if self.op == 'csch':
                return 1 / math.sin(vals[0]) if vals[0] != 0.0 else 'nan'
            if self.op == 'coth':
                return 1 / math.tan(math.pi / 2) if vals[0] != 0.0 else 'nan'
            if self.op == 'arccosh':
                return math.acosh(vals[0]) if x >= 1 else 'nan'
            if self.op == 'arcsech':
                return math.acosh(1 / vals[0]) if x > 1 else 'nan'
            if self.op == 'arccsc':
                return math.asin(1 / vals[0]) if x ** 2 != 1 else 'nan'
            if self.op == 'arctanh':
                return math.atanh(vals[0]) if x ** 2 < 1 else 'nan'
            if self.op == 'arccoth':
                return math.atanh(1 / vals[0]) if x ** 2 > 1 else 'nan'

            # number theory
            if self.op == 'abs':
                return abs(vals[0])
            if self.op == 'sign':
                return -1 if vals[0] < 0 else 1 if vals[0] > 0 else 0
            if self.op == 'floor':
                return float(math.floor(vals[0]))
            if self.op == 'ceil':
                return float(math.ceil(vals[0]))
            if self.op == 'round':
                return float(round(vals[0]))
            if self.op == 'min':
                return min(vals[0], vals[1])
            if self.op == 'max':
                return max(vals[0], vals[1])
            if self.op == 'clamp':
                return min(max(vals[0], vals[1]), vals[2])

            # Add other things after here
            # grammar isn't too important in this step since we can make the grammar whatever we want
            return 'invalid'
        except OverflowError:
            return 'nan'


if __name__ == "__main__":
    eq = Equation("log{2,x}")
    print(eq.evaluate(1, 0))
    import doctest

    doctest.testmod(verbose=True)

    import python_ta

    python_ta.check_all(config={
        'max-line-length': 120
    })
