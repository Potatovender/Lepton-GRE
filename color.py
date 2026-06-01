""" Astra Rendering Engine
Module Description
=====================
This module contains the Color class containing the r,g,b functions required for drawing in pygame
======================
Matthew Chen, Justin Ng, Cindy Liu, Lingnan Meng
"""

from __future__ import annotations
from equation import Equation


class Color:
    """
    A mapping class that evaluates equations to generate 8-bit RGB color tuples.
    """
    red: Equation
    green: Equation
    blue: Equation

    def __init__(self, red: Equation = Equation("x"), green: Equation = Equation("x"), blue: Equation = Equation("x")) \
            -> None:
        self.red = red
        self.green = green
        self.blue = blue

    def get_color_tuple(self, zval: float, angle_mode: str = "potato", env: dict = None, depth: int = 0) -> tuple:
        """
        Evaluates the constituent RGB equations for a given spatial depth or iteration ('zval').
        Returns a clamped (0-255) integer RGB tuple, or (-1, -1, -1) if invalid.
        """
        rval, gval, bval = (self.red.evaluate(zval, 0, angle_mode, env, depth),
                            self.green.evaluate(zval, 0, angle_mode, env, depth),
                            self.blue.evaluate(zval, 0, angle_mode, env, depth))

        if any(c == d for c in [rval, gval, bval] for d in ['invalid', 'nan']):
            # THIS SHOULD RETURN A BASE NULL VALUE
            return -1, -1, -1
        if rval < 0:
            rval = 0
        if rval > 255:
            rval = 255
        if gval < 0:
            gval = 0
        if gval > 255:
            gval = 255
        if bval < 0:
            bval = 0
        if bval > 255:
            bval = 255
        return int(rval), int(gval), int(bval)


if __name__ == "__main__":
    r = Equation("4+x+y")
    g = Equation("2*x-y")
    b = Equation("3/x+5+3+y")
    newcolor = Color()
    print(newcolor.get_color_tuple(150))

    import doctest
    doctest.testmod(verbose=True)

    import python_ta
    python_ta.check_all(config={
        'max-line-length': 120
    })
