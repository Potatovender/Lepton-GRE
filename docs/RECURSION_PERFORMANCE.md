# Recursion Performance Audit

2026-10-01. Baseline: `77f6bacb79590fd99b2fe4bd15578ca97819ffb3`.
Device: Apple M4 Max, native Safari 18.6 and Chrome 154 (Metal, not software WebGL).
These are device-specific observations, not supported maximum scene sizes.

## Method

Three scenes expand through two recursive references per level. Each has one
draw layer and an unbounded `clock`, with spatial movement driven by `sin(clock)`.
The renderer, shader generator, uniforms, and cooperative GPU batches are the
production implementation. Each case uses a fresh worker/context, two warm-up
frames, then at least 5.5 seconds of completed-frame measurements. Half-second
windows identify consecutive periods below 15 FPS lasting **more than** two
seconds. The canvas is read back to confirm nonuniform, changing pixels.

The benchmark measures render-and-present throughput without a display-refresh
cap, not browser `requestAnimationFrame` callbacks. Rates above the screen refresh
rate are not visible display FPS. UI overhead can reduce throughput further.
Compilation is timed separately. A 70-second watchdog is reported as a timeout,
not proof of a hard render limit.

The initial Chrome sweep was noisy and overlapped other regression work; do not
use it to infer a complexity threshold. A separate repeat was run after those
processes finished. Other desktop activity and browser scheduling still limit
the precision of these measurements. Safari was measured at 960 x 600 only;
further automation was stopped rather than accessing unrelated private tabs.

## Test Equations

Shared settings: x = -2 to 2, y = -1.25 to 1.25, aspect ratio 8:5, coordinate
grid hidden. Change `max_recursion` for each trial. Shared colour:

```text
time unbounded clock = 0 {speed=1}
colour paint = 120+100*sin(x)~120+100*cos(x)~150+90*sin(x+1)
```

**Repeated-subtree recursion:**

```text
expression wave = 0.35*sin(wave)+0.35*cos(wave)+sin(x+0.25*sin(clock))*cos(y)
draw(wave) {colour=paint}
```

**Mandelbrot-style mutual recursion:**

```text
expression real = real^2-imaginary^2+x+0.2*sin(clock)
expression imaginary = 2*real*imaginary+y
expression combined = real^2+imaginary^2
draw(combined) {colour=paint}
```

**Different-argument recursion:**

```text
function branch(a,b) = 0.45*sin(branch(a+0.17,b*0.91))+0.45*cos(branch(a*0.93,b-0.13))+0.1*sin(a+b)
draw(branch(x+0.2*sin(clock),y)) {colour=paint}
```

## Expansion Counts

These are independently counted expanded **AST nodes for the drawn value**,
before driver optimization. A literal, uniform, coordinate, arithmetic operation,
or built-in call is one node. Parentheses are not nodes. References and custom
calls are substituted, parameter occurrences include their argument trees, and
the recursion base is the single literal `0`. The time uniform counts as one
node. Counts use BigInt, not the editor's capped estimate.

| Maximum depth | Repeated subtree | Mutual recursion | Different arguments |
| --- | ---: | ---: | ---: |
| 1 | 58 | 26 | 69 |
| 2 | 134 | 64 | 181 |
| 3 | 286 | 140 | 437 |
| 4 | 590 | 292 | 1,013 |
| 5 | 1,198 | 596 | 2,293 |
| 6 | 2,414 | 1,204 | 5,109 |
| 7 | 4,846 | 2,420 | 11,253 |
| 8 | 9,710 | 4,852 | 24,565 |
| 9 | 19,438 | 9,716 | 53,237 (refused) |
| 10 | 38,894 | 19,444 | - |
| 11 | 77,806 (refused) | 38,900 | - |
| 12 | - | 77,812 (refused) | - |

The editor's existing `estimateExpandedNodeCount` counts syntax tokens, including
punctuation; it is **not** this AST count. It also does not model repeated parameter
substitution exactly. This release labels scalar estimates honestly and removes
the obsolete extra contribution for the former `x+y` base case. A definition's
estimate begins with that definition in the recursion stack, whereas a draw
expands its body from the root. Consequently even uncapped row estimates differ
from the rendered tree. They must not be treated as GPU instruction counts.

## First Render Refusal

All three patterns first failed at the **existing 200,000-character expanded
expression guard**, before native shader compilation. This is not integer
overflow or a universal GPU node limit.

| Pattern | Last successful depth / expression characters | First refusal |
| --- | --- | --- |
| Repeated subtree | 10 / 128,964 | 11 |
| Mutual recursion | 11 / 126,943 | 12 |
| Different arguments | 8 / 97,766 | 9 |

There is also a 1,500,000-character total fragment-shader budget. Neither guard
was removed: merely lifting limits can make driver compilation extremely slow,
consume excessive memory, or hit GPU resource limits instead.

The actual bug was a catch-and-ignore path in the draw-layer builder. An
expansion failure became an omitted layer, leaving a valid-looking result. The
builder now returns per-layer issues, keeps independent layers, and restores
those issues with cached shader programs. Resource failures stay blue and explain
how to retry; photo/video export rejects incomplete output.

## Sustained Frame Rates

| Browser / physical pixels | Cases | Throughput at last rendering depth | Below 15 FPS for >2 s? |
| --- | --- | --- | --- |
| Safari, 960 x 600 | All three patterns | 115.4 / 213.8 / 83.2 FPS | No |
| Chrome repeat, 960 x 600 | All three patterns | 124.5 / 123.1 / 83.5 FPS | No |
| Chrome repeat, 1920 x 1200 | Different arguments, depths 1-8 | 26.4 FPS at depth 8 | No |
| Chrome repeat, 3840 x 2400 | Different arguments, depths 1-8 | 7.1 FPS at depth 8 | Yes, starting at depth 1 |

The 3840 x 2400 case is already 10.45 FPS at depth 1 (**69 expanded AST nodes**)
and remains below 15 for 5.15 seconds. At depth 8 it remains below 15 for 5.67
seconds. Every successful case produces nonuniform, changing pixels and builds
its shader only once during playback. Full per-depth measurements and 500 ms
windows are in [the audit data](benchmarks/recursion-20261001.json).

At depth 1, Chrome's cooperative draw time rises from 6.2 ms at 960 x 600 to
23.7 ms at 1920 x 1200 and 85.1 ms at 3840 x 2400. Batch counts rise from 10 to
39 to 141. This includes GPU queue/fence and scheduling time, not pure GPU ALU
time. It establishes a large resolution/batching cost, not proof that arithmetic
alone is the bottleneck. Four times the width and height means sixteen times
the pixels. A low node count therefore cannot guarantee 15 FPS.

## Warning Policy

- Scalar preflight size warning: above **16,384 estimated expanded tokens**,
  previously 4,096. It is advisory, not a claim that the graph runs below 15 FPS.
- The internal validation expansion budget remains 4,096, so increasing the
  visible threshold does not force expensive CPU expansion while editing.
- Playback warning: more than two consecutive seconds below **15 completed FPS**
  on the current device, excluding first-frame compilation and hidden tabs.
  Two seconds of recovery clears it. Pausing, editing, or resizing resets it.
- Red and yellow diagnostics retain priority. A whole-graph slow warning does
  not claim that every visible draw layer is individually expensive.

## Next Optimizations

1. **Reuse repeated subexpressions.** Generate a DAG of per-pixel temporaries,
   keyed by definition, arguments, coordinates, depth, and scope, instead of
   copying a tree into every occurrence. Confirm output parity, including colour
   and transparency coordinate remapping, before replacing expansion.
2. **Compile suitable mutual recurrences as iterations.** The Mandelbrot pair can
   reuse the previous depth's real/imaginary values. This cannot be applied blindly
   to different-argument recursion, which represents genuinely different samples.
3. **Profile GPU batching at large pixel sizes.** Cooperative batches keep input
   responsive but add fences, task scheduling, and presentation overhead. Larger
   adaptive batches may improve throughput, provided input latency stays bounded.
4. **Offer explicit preview resolution controls.** Fewer preview pixels reduce
   fragment work without simplifying expressions or changing export quality.

These are follow-up compiler/rendering projects, not silent changes to graph
semantics or reductions in image detail in this release.
