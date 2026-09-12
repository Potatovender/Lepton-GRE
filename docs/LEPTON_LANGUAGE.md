# Lepton Language Reference

Lepton text is the lossless text representation of the Standard workspace. Order,
folders, comments, settings, and draw-component order round-trip between both
views. Loaded folders begin closed in Standard view. Expanding or collapsing
them is editor-only state and never changes this text representation. Pressing
Enter on a Standard-view data row inserts a new expression immediately below it
and preserves the current folder.

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
set max_list_size = 10000
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

In degree mode, circular trig functions take degrees and inverse circular trig
functions return degrees. Nested calls and references use the same convention in
CPU evaluation and GLSL rendering. Hyperbolic functions are unaffected.

## Values

### Expressions

An expression is a named formula over graph coordinates `x` and `y`. Reference it by ID without parentheses.

```text
expression radius = sqrt(x^2+y^2)
expression rings = sin(4*radius)
```

Powers associate to the right: `2^3^2` is `2^(3^2)` (512). Group the base for
`(2^3)^2` (64). Grouping is preserved in both Text and Standard views.

### Sliders

```text
slider amount = 5 {range=0~10}
```

The value, minimum, and maximum are scalar expressions. Coordinate-dependent slider values are allowed with a warning; inverted ranges are errors.

### Time Sliders

```text
time bounded t = 0 {range=0~10, speed=1}
time bounded_looped phase = 0
{range=0~6.283,
 speed=0.5}
time unbounded clock = 0 {speed=1}
```

`bounded` bounces at each endpoint. `bounded_looped` wraps from maximum to minimum. `unbounded` has no range. Speed must resolve without `x` or `y` and is measured in units per second.

### Functions

```text
function distance(a,b) = sqrt(a^2+b^2)
expression circle = distance(x,y)-4
```

Function parameters are local and shadow outer values with the same name. Calls must provide exactly the declared number of arguments.

Empty argument slots are errors: `distance(2,,3)` does not mean `distance(2,3)`.
Use `sqrt(value)` in Lepton text or `\sqrt{value}` when pasting LaTeX. Built-in
function names require inputs; bare `sin` is not a scalar value. `random` is the
documented zero-argument exception and is equivalent to `random()`.

Functions return expressions by default and may explicitly return a point:

```text
function offset(a,b) -> point = [a+1,b-1]
function total(a,b,c,d) = a+b+c+d
expression flattened = total(offset(x,y),offset(2,3))
```

Point addition and multiplication operate component by component. A scalar mixed with a point is applied to both coordinates. When a point-valued call is passed to another function, it fills two consecutive scalar parameters in x-then-y order. Functions and expressions share one identifier namespace and cannot use the same ID.

## Lists, Summation and Products

Choose **More data > List**. Lists are separate from points and currently contain
one-dimensional scalar expressions, including coordinates, sliders, and calls:

```text
list values = [1,2,3]
list squares = [c^2 for(c=1,10)]
expression first = values[0]
expression count = values.length
expression shifted = values+10
expression weighted = values*[2,3,4]
expression series = sum(i=1~40){sin(i*x)/i}
expression factorial = prod(i=1~5){i}
list totals = sum(i=1~3){[i,2*i]}
draw(squares)
```

- Indexing is **zero-based**; invalid/fractional/out-of-range indices are undefined.
  `.x` and `.y` remain point-only selectors. `.length` is list-only.
- Arithmetic and built-in functions act element-wise. Scalars broadcast to every
  element. List/list lengths must match; they are never truncated to fit.
  `values+10` gives `[11,12,13]`; `weighted` is `[2,6,12]`; `totals` is `[6,12]`.
- Passing a named list to a parameterized function keeps it as one list argument.
  For compatibility, an inline two-item literal can fill two scalar parameters
  only when the function's arity requires it. Named points still fill two slots.
- `[body for(index=lower,upper)]` constructs a list; it is not an imperative loop.
  Nested lists and point-valued elements are not supported in this release.
- `sum(index=lower~upper){body}` and `prod(index=lower~upper){body}` visit the exact
  lower bound, then add 1 each step while the index is <= the upper bound. Bounds
  may be fractional and may use `x`, `y`, sliders, and functions. Use `floor(...)`
  explicitly when integer bounds are desired. Bounds must evaluate to finite
  scalars. Empty sums return 0; empty products return 1 (element-wise for lists).
- Indices are local to the body. Bounds use the outer scope. Nested reductions
  can reuse an index name without overwriting it. Referenced global expressions
  retain their own graph-coordinate meaning.
- Standard displays editable LaTeX limits: `\sum_{i=1}^{40}(...)` and
  `\prod_{i=1}^{5}(...)`. In a blank math field, type `sum`/`prod`, enter `i=1`,
  press Up to enter the upper bound, then Right to enter a parenthesized body.
  The on-screen keyboard offers these operators too.
- Drawing a list paints index 0 first, then 1, etc. Each receives the draw layer's
  colour, boundary and transparency. Later elements overlay earlier ones.
  Standard shows the draw count, or a variable count for coordinate/time bounds.
- `max_list_size` limits each list to 10,000 elements by default. Oversized lists
  are blue-flagged and undefined, not silently truncated. Structural errors remain
  red. Work estimates include repeated terms and expanded references, sampled at
  x=y=1 for coordinate-dependent work. The display caps counts above 65,536.
  There is no separate summation-steps setting: very large/nested computations
  can fail GPU limits or stall. A blue warning does **not** guarantee safe runtime.
- Collection GPU evaluation requires **WebGL 2 / GLSL 3**. Scalar scenes retain the older
  shader path. CPU reference evaluation supports the same collection semantics.

## Colours

```text
colour sunset = 240~110+20*sin(x)~70
```

Channels are separated by `~`, accept full expressions, and are clamped to displayable RGB values. During mapped colour evaluation, `x` is the selected draw value and `y` remains the graph's vertical coordinate.

### HSV Colours

Choose **More data > Colour (HSV)** in the New line or row-type menu:

```text
expression wave = sin(x)+cos(y)
colourhsv spectrum = 180+90*x~0.8~1
draw(wave) {colour=spectrum}
```

The channels are **hue ~ saturation ~ value (brightness)**. Hue uses degrees,
independent of the trig angle mode, wrapping every 360 (so -60 and 300 match).
Saturation and value clamp to 0..1. `colorhsv` is an accepted spelling; export
uses `colourhsv`. Both models share one colour namespace and work for draw
layers, point colours, and the solid background. Points use their coordinates;
backgrounds sample at (0,0). HSV draw layers have the same x/y mapping as RGB.

Changing between RGB and HSV in Standard preserves the three formulas in order,
but reinterprets their units; it is not a colour-space conversion of the formulas.
Reselecting the existing type does not change any channel. Missing colour IDs
remain in the text and are flagged instead of being replaced with defaults.

## Boundaries

```text
boundary inside = 0-circle
boundary outside = circle
boundary below = y {when=lte}
boundary clipped = and(inside,below)
```

A boundary draws where its expression is greater than or equal to zero by default.

Value IDs take precedence inside expressions if a boundary and a value share a
name. This preserves existing scenes such as `expression rest = 1` followed by
`boundary rest = rest`. Use distinct boundary IDs when composing named boundaries
to avoid this ambiguity.
Use `{when=lte}` to draw where it is less than or equal to zero; the Standard editor
provides the same choice directly. Boundary expressions are edited like colour and
transparency expressions. Named boundaries can be composed with `and(a,b)`,
`or(a,b)`, `not(a)`, `xand(a,b)`, and `xor(a,b)`. A boundary ID can also be used as a
piecewise condition.

## Transparency

```text
transparency fade = clamp(abs(x)/4,0,1)
```

Transparency is clamped from `0` (opaque) to `1` (fully transparent). Like colour channels, mapped transparency receives the draw output as `x` and the graph vertical coordinate as `y`.

## Points

```text
function sample(a,b) = a^2+b^2
point focus = [2,3] {draggable=True, visible=True, colour=default, link=sample, show_label=True}
expression px = focus.x+focus[0]
expression py = focus.y+focus[1]
expression functionCoordinate = offset(x,y).x+offset(x,y)[1]
```

Point components can be selected as `.x`/`.y` or `[0]`/`[1]`. Both forms work on named points and point-returning function calls; the indexed form is designed to extend naturally to larger vectors and lists later. Properties control dragging, visibility, colour, a linked expression-output function, and whether the graph displays the coordinates and linked value. A linked function receives the point's x and y coordinates in parameter order. Point overlays and visible labels are included in image exports.

## Draw Layers

```text
draw(rings)
function wave(a,phase) = sin(a+phase)
draw(wave(x,clock))
draw(rings) {colour=sunset}
draw(circle)
{boundary=inside,
 transparency=fade,
 visible=False}
```

The first value is required. A parameterized function is written as a call, and each argument may be any expression. The Standard editor exposes one input field per declared parameter. Writing only `draw(wave)` remains accepted for older scenes and supplies `x`, `y`, then `0` to successive parameters.

Optional named components are `colour`/`color`, `boundary`/`restriction`, `transparency`, and `visible`. Property braces configure the draw layer and are distinct from piecewise braces inside an expression. Component order is preserved. Missing components use default grayscale `x~x~x`, unrestricted boundary `1`, and opacity `0`.

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
- `random` and `random()` return the same deterministic coordinate-based value in `[0,1]` using the scene seed; neither form accepts arguments. The Standard editor displays bare `random` as an upright built-in operator.

## Naming and Diagnostics

- IDs must be unique across user values of the same reference space.
- Exact built-in or coordinate names are errors.
- Expressions and sliders receive warnings for confusing reserved substrings; parameterized functions do not.
- Function-local parameters may shadow outer entries with a warning and use the local value.
- Recursive references stop at `max_recursion` and return `0` at the base case.
- Large recursion estimates are blue warnings because the generated graph may be slow or may fail shader limits; they are not naming or syntax errors.

## Legacy Import

Legacy `F:`, `C:`, `R:`, `D~`, `S:`, `~~~~~`, positional draw fields, parenthesized points, and trailing `range`/`speed` input remain accepted. New exports always use the keyword and brace-property grammar documented above.

The maintained scenes in `sample code/` always use the current grammar. Run `npm run migrate:samples` after a major syntax change, and `npm run check:samples` to ensure no migratable legacy form remains.
