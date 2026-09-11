// Only this public surface is deployed. Never copy the entire working tree.
export const SITE_FILES = [
  "index.html", "app.html", "robots.txt", "sitemap.xml", "THIRD_PARTY_NOTICES.md",
  "src/landing.js", "src/browser-preview-live.js", "src/styles.css",
  "src/math/expression-syntax.js", "src/math/builtins.js", "src/math/colour.js", "src/math/collections.js", "packages/renderer/src/index.js",
  "src/libs/mathquill/index.global.js", "src/libs/mathquill/style.css",
  "src/libs/mathquill/LICENSE", "src/libs/mathquill/vendor.json",
  ...["hero-field", "lepton-favicon", "lepton-logo", "lepton-logo-transparent",
    "sample-contour", "sample-fire", "sample-lava-lamp", "sample-mandelbrot",
    "sample-marble-cube", "sample-ripple", "sample-sky", "sample-tree"]
    .map((name) => `src/assets/${name}.png`),
  ...["Lepton Logo", "cinematic clouds", "fire", "lava lamp", "mandelbrot set",
    "marble cube", "star field", "tree", "water effect"].map((name) => `sample code/${name}`)
];
