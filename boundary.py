""" Astra Rendering Engine
Module Description
=====================
This module contains the boundary class describing the restrictions implemented on the drawing class
======================
Matthew Chen, Justin Ng, Cindy Liu, Lingnan Meng
"""
from __future__ import annotations
from equation import Equation


class Boundary:
    """
    A wrapper class that maps values to colors
    """
    bounder: Equation
    check_smaller: bool

    def __init__(self, boundary: Equation = Equation("1"), checksmaller: bool = False) -> None:
        self.bounder = boundary
        self.check_smaller = checksmaller

    def in_bounds(self, x: float, y: float, angle_mode: str = "potato", env: dict = None, depth: int = 0) -> bool:
        """
        returns whether or not the x and y values are in bounds as specified by the boundary provided earlier
        """
        # i think the code is pretty readable just like look at it ig
        squarevalue = float(self.bounder.evaluate(x, y, angle_mode, env, depth))
        # you guys can decide if we actually want an inclusive/exclusive check for squarevalue right now it's inclusive
        if not self.check_smaller:
            return squarevalue >= 0
        else:
            return squarevalue <= 0


if __name__ == '__main__':
    import doctest
    doctest.testmod(verbose=True)

    import python_ta
    python_ta.check_all(config={
        'max-line-length': 120
    })
