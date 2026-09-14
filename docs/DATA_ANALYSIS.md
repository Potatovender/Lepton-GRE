# Data Analysis Assessment

Reviewed against the September 2026 Lepton implementation. This is a proposed
roadmap, not a list of shipped features.

## What Works Today

Lepton supports formula exploration, parameter sweeps with sliders, piecewise
models, scalar lists, indexed access, comprehensions, sums/products, and visual
comparison of multiple layers. Points can inspect a formula at chosen coordinates.
Seeded scenes, saved text, and PNG export help reproduce and share a visualization.

For example, a mean can already be expressed as
`sum(i=0~values.length-1){values[i]}/values.length` for a nonempty scalar list.
This is useful for small experiments, but repeated formulas and manual data entry
make it cumbersome as an everyday analysis tool. Lists are currently one-dimensional
scalars; neither points nor tables are general list items.

## Priorities

| Priority | Capability | Why it matters |
| --- | --- | --- |
| First | Local CSV/TSV import and paste, a table editor, named columns, numeric/date parsing, explicit missing values | Analysts need to bring their own observations in and inspect the data before plotting. Local files do not require a server or internet access. |
| First | Scatter/line plots with legends, labels, units, and meaningful axis scales | A list of scalar field draw layers is not a table-to-chart workflow. Series need paired coordinates, labels, and a compact styling model. |
| First | Count, mean, median, quantiles, variance/stddev, min/max reductions | Common questions should not require hand-written reductions. Define sample versus population statistics and missing-value behavior explicitly. |
| Next | Filter, sort, mask, group, and join operations; histogram and boxplot views | Clean and compare groups without duplicating formulas. Preserve row alignment across columns. |
| Next | Linear/nonlinear regression, residuals, error bars, uncertainty and confidence intervals | Users need model-quality information and the assumptions behind uncertainty estimates. |
| Later | Time series, date axes, rolling summaries, resampling, correlation, transforms | Needed for monitoring, sensor data, economics, and signal work. |
| Later | Numerical integration/differentiation, root finding, linear algebra and matrices | Needed for scientific/engineering analysis. Each operation needs convergence and error diagnostics. |
| Specialist | Distributions, hypothesis tests, geospatial data, optimization, very large datasets | Add for a concrete audience, with appropriate units, assumptions, and testing. |

## Numerical Contract

Rendering is approximate GPU floating-point computation; scientific results
should not be read back from pixel colours. Use a separate numeric evaluation
path with documented precision, stable algorithms, and result tables. Keep the
renderer responsible for displaying those results.

Start with explicit rules for empty data, NaN/infinity, zero variance, mismatched
column lengths, missing observations, and seeded random behavior. Show sample
size and diagnostic messages alongside computed results. GPU random patterns
should not be advertised as a statistical random-number generator.

Long-running analysis should run in workers with cancellation, progress, and
bounded memory. Current coordinate-dependent list/reduction shaders can still
stall the page; blue complexity flags are estimates, not resource enforcement.

## Recommended Delivery

1. Release the current tool as an equation-based graphics and exploratory math
   application. Avoid claiming general statistical-analysis coverage yet.
2. Build one complete offline-friendly workflow: import a small table, inspect
   columns, plot a scatter series, calculate summaries, and export results plus
   reproducible source. Test missing data and malformed files from day one.
3. Add fitting and grouped comparisons after that workflow is comfortable.
4. Keep the language/evaluator contract independent of workspace UI. A future
   analysis workspace and animation/sprite workspace can share the compiler and
   renderer while offering different editing controls. Separate sites, servers,
   or desktop installers are not prerequisites for this first analysis workflow.

Do not make a general release wait for every analysis category. The current
remaining release decisions are documented in `RELEASE_READINESS.md`, including
device coverage, resource limits, and the owner's license choice.
