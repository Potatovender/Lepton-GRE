# Lepton Language Reference

Lepton text is the lossless text representation of the Standard workspace. Order, folders, comments, settings, and draw-component order round-trip between both views.

## Comments and Folders

```text
// standalone comment
folder Atmosphere = {
  expression sky = y // inline comment
  folder Lighting = {
    expression sun = sqrt((x-4)^2+(y-2)^2)-1
  }
}
```

Folder names may contain spaces but not grammar delimiters such as `=`. Entry IDs use letters, digits, and underscores and must begin with a letter or underscore.

## Settings

Settings may be omitted; omitted values use application defaults.

```text
set x_min = -10
set x_max = 10
set y_min = -10
set y_max = 10
set max_recursion = 100
set angle_mode = radians
set background_color = 0
set ensure_square_grid = True
set aspect_ratio = 1:1
set draw_only_inside_boundary = False
set show_coordinate_grid = True
set show_grid = True
set show_x_axis = True
set show_y_axis = True
set show_x_numbers = True
set show_y_numbers = True
set unbounded_decimal_places = 3
set random_seed = 1
```

Bounds and custom aspect-ratio sides accept scalar math expressions. Invalid angle modes fall back to radians. `background_color = 0` uses the default background; another value names a colour. `show_coordinate_grid = False` is the master switch for axes, numbers, and grid lines.

## Values

### Expressions

An expression is a named formula over graph coordinates `x` and `y`. Reference it by ID without parentheses.

```text
expression radius = sqrt(x^2+y^2)
expression rings = sin(4*radius)
```

### Sliders

```text
slider amount = 5 range 0~10
```

The value, minimum, and maximum are scalar expressions. Coordinate-dependent slider values are allowed with a warning; inverted ranges are errors.

### Time Sliders

```text
time bounded t = 0 range 0~10 speed 1
time bounded_looped phase = 0 range 0~6.283 speed 0.5
time unbounded clock = 0 speed 1
```

`bounded` bounces at each endpoint. `bounded_looped` wraps from maximum to minimum. `unbounded` has no range. Speed must resolve without `x` or `y` and is measured in units per second.

### Functions

```text
function distance(a,b) = sqrt(a^2+b^2)
expression circle = distance(x,y)-4
```

Function parameters are local and shadow outer values with the same name. Calls must provide exactly the declared number of arguments.

## Colours

```text
colour sunset = 240~110+20*sin(x)~70
```

Channels are separated by `~`, accept full expressions, and are clamped to displayable RGB values. During mapped colour evaluation, `x` is the selected draw value and `y` remains the graph's vertical coordinate.

## Boundaries

```text
boundary inside = circle~True
boundary outside = circle~False
```

`True` draws where the boundary expression is less than or equal to zero. `False` draws where it is greater than or equal to zero. A boundary ID can also be used as a piecewise condition.

## Transparency

```text
transparency fade = clamp(abs(x)/4,0,1)
```

Transparency is clamped from `0` (opaque) to `1` (fully transparent). Like colour channels, mapped transparency receives the draw output as `x` and the graph vertical coordinate as `y`.

## Points

```text
point focus = (2,3)~True~default
expression px = focus.x+focus[0]
expression py = focus.y+focus[1]
```

The boolean controls dragging and the final value names a colour or `default`. Point coordinates are expressions and update while a draggable point moves.

## Draw Layers

```text
draw(rings)
draw(rings,colour=sunset)
draw(circle,boundary=inside,transparency=fade,visible=False)
```

The first value is required. Optional named components are `colour`/`color`, `boundary`/`restriction`, `transparency`, and `visible`. Component order is preserved. Missing components use default grayscale `x~x~x`, unrestricted boundary `1`, and opacity `0`.

## Piecewise Expressions

```text
expression signBand = {x<0:-1,x=0:0,1}
expression masked = {inside:radius}
```

Branches are evaluated left to right. Conditions may be boolean expressions or boundary IDs. The final comma-separated value is the optional fallback; without it, unmatched input is undefined.

## Operators and Constants

- Arithmetic: `+`, `-`, `*`, `/`, `^`.
- Comparisons: `<`, `<=`, `>`, `>=`, `=`, `==`, `!=`.
- Constants: `pi`, `e`; coordinates: `x`, `y`.
- Powers are right-associative: `2^3^2` means `2^(3^2)`.
- Implicit multiplication is accepted, for example `2sin(x)` and `3(x+1)`.
- Fractions accept `/`, `frac{a}{b}`, `frac(a,b)`, and pasted `\frac{a}{b}`.
- LaTeX multiplication `\cdot` and `\times` import as `*`; Standard view displays multiplication as `\cdot`.

## Built-ins

Unary functions:

`sin`, `cos`, `tan`, `sec`, `csc`, `cot`, `asin`, `acos`, `atan`, `arcsin`, `arccos`, `arctan`, `arcsec`, `arccsc`, `arccot`, `sinh`, `cosh`, `tanh`, `sech`, `csch`, `coth`, `arcsinh`, `arccosh`, `arctanh`, `arcsech`, `arccsch`, `arccoth`, `sqrt`, `cbrt`, `log`, `ln`, `abs`, `sign`, `floor`, `ceil`, `round`, and `exp`.

Multi-argument functions:

- `min(a,b)`, `max(a,b)`, `frac(a,b)`, `pow(a,b)`
- `clamp(value,low,high)`
- `union(a,b)` = `min(a,b)`
- `intersect(a,b)` = `max(a,b)`
- `subtract(a,b)` = `max(-a,b)`
- `random()` returns a deterministic coordinate-based value in `[0,1]` using the scene seed; it accepts no arguments.

## Naming and Diagnostics

- IDs must be unique across user values of the same reference space.
- Exact built-in or coordinate names are errors.
- Expressions and sliders receive warnings for confusing reserved substrings; parameterized functions do not.
- Function-local parameters may shadow outer entries with a warning and use the local value.
- Recursive references stop at `max_recursion` and return `0` at the base case.
- Large recursion estimates are blue warnings because the generated graph may be slow or may fail shader limits; they are not naming or syntax errors.

## Legacy Import

Legacy `F:`, `C:`, `R:`, `D~`, `S:`, and `~~~~~` input remains accepted. New exports always use the keyword grammar documented above.
