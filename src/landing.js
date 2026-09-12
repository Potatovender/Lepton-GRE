const APP_VERSION = "20260912-enter-folder-lines2";
const LEPTON_ICON_PATH = `./src/assets/lepton-favicon.png?v=${APP_VERSION}`;

function ensureLeptonFavicon() {
  const iconHref =
    typeof URL !== "undefined" && typeof document !== "undefined" ? new URL(LEPTON_ICON_PATH, document.baseURI).href : LEPTON_ICON_PATH;
  document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach((link) => link.remove());
  for (const rel of ["icon", "shortcut icon", "apple-touch-icon"]) {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = iconHref;
    if (rel !== "apple-touch-icon") link.type = "image/png";
    if (rel === "icon") link.setAttribute("sizes", "any");
    document.head.append(link);
  }
}

ensureLeptonFavicon();

const SAMPLE_SCENE_FILES = {
  fire: "fire",
  mandelbrot: "mandelbrot set",
  water: "water effect",
  stars: "star field",
  sky: "cinematic clouds",
  tree: "tree",
  lava: "lava lamp",
  marble: "marble cube"
};

for (const link of document.querySelectorAll("[data-sample]")) {
  const sampleId = link.dataset.sample;
  if (!SAMPLE_SCENE_FILES[sampleId]) continue;
  link.href = `./app.html?sample=${encodeURIComponent(sampleId)}&v=${APP_VERSION}`;
}

for (const link of document.querySelectorAll('[data-launch-blank]')) {
  link.href = `./app.html?v=${APP_VERSION}`;
}
