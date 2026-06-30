const DEFAULT_SCENE = {
  functions: [],
  colors: [],
  restrictions: [],
  draws: [],
  settings: {
    xMin: -10,
    xMax: 10,
    xPoints: 120,
    yMin: -10,
    yMax: 10,
    yPoints: 120,
    maxRecursion: 100,
    angleMode: "radians",
    backgroundColor: "0",
    ensureSquareGrid: true,
    aspectRatio: "1:1",
    drawOnlyInsideBoundary: false,
    unboundedDecimalPlaces: 3,
    unboundedIntegerDigits: 1
  }
};

const SAVED_GRAPHS_KEY = "lepton-saved-graphs-v1";
const LEPTON_ICON_PATH = "./src/assets/lepton-favicon.png?v=20260629-slider-mq-favicon2";

function ensureLeptonFavicon() {
  const iconHref =
    typeof URL !== "undefined" && typeof document !== "undefined" ? new URL(LEPTON_ICON_PATH, document.baseURI).href : LEPTON_ICON_PATH;
  for (const rel of ["icon", "shortcut icon", "apple-touch-icon"]) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.append(link);
    }
    link.href = iconHref;
    if (rel !== "apple-touch-icon") link.type = "image/png";
  }
}

const tabs = [
  ["functions", "Functions"],
  ["colors", "Colors"],
  ["restrictions", "Bounds"],
  ["draws", "Draw"],
  ["settings", "Settings"]
];

const BUILTIN_NAMES = new Set([
  "x",
  "y",
  "z",
  "pi",
  "e",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "arcsin",
  "arccos",
  "arctan",
  "arcsec",
  "arccsc",
  "arccot",
  "sinh",
  "cosh",
  "tanh",
  "sech",
  "csch",
  "coth",
  "arcsinh",
  "arccosh",
  "arctanh",
  "arcsech",
  "arccsch",
  "arccoth",
  "sqrt",
  "cbrt",
  "log",
  "ln",
  "abs",
  "sign",
  "floor",
  "ceil",
  "round",
  "min",
  "max",
  "exp",
  "frac",
  "clamp",
  "sec",
  "csc",
  "cot",
  "pow",
  "Math",
  "PI",
  "ref",
  "NaN"
]);

const EXACT_RESERVED_NAMES = new Set([...BUILTIN_NAMES].filter((name) => !["Math", "PI", "ref", "NaN"].includes(name)));
const SUBSTRING_RESERVED_NAMES = new Set([...EXACT_RESERVED_NAMES].filter((name) => !["x", "y", "z", "e"].includes(name)));
const LATEX_FUNCTIONS = {
  sin: { internal: "sin", args: 1, display: "sin" },
  cos: { internal: "cos", args: 1, display: "cos" },
  tan: { internal: "tan", args: 1, display: "tan" },
  asin: { internal: "asin", args: 1, display: "arcsin" },
  acos: { internal: "acos", args: 1, display: "arccos" },
  atan: { internal: "atan", args: 1, display: "arctan" },
  arcsin: { internal: "arcsin", args: 1, display: "arcsin" },
  arccos: { internal: "arccos", args: 1, display: "arccos" },
  arctan: { internal: "arctan", args: 1, display: "arctan" },
  arcsec: { internal: "arcsec", args: 1, display: "arcsec" },
  arccsc: { internal: "arccsc", args: 1, display: "arccsc" },
  arccot: { internal: "arccot", args: 1, display: "arccot" },
  sinh: { internal: "sinh", args: 1, display: "sinh" },
  cosh: { internal: "cosh", args: 1, display: "cosh" },
  tanh: { internal: "tanh", args: 1, display: "tanh" },
  sech: { internal: "sech", args: 1, display: "sech" },
  csch: { internal: "csch", args: 1, display: "csch" },
  coth: { internal: "coth", args: 1, display: "coth" },
  arcsinh: { internal: "arcsinh", args: 1, display: "arcsinh" },
  arccosh: { internal: "arccosh", args: 1, display: "arccosh" },
  arctanh: { internal: "arctanh", args: 1, display: "arctanh" },
  arcsech: { internal: "arcsech", args: 1, display: "arcsech" },
  arccsch: { internal: "arccsch", args: 1, display: "arccsch" },
  arccoth: { internal: "arccoth", args: 1, display: "arccoth" },
  sqrt: { internal: "sqrt", args: 1, display: "sqrt" },
  cbrt: { internal: "cbrt", args: 1, display: "cbrt" },
  log: { internal: "log", args: 1, display: "log" },
  ln: { internal: "ln", args: 1, display: "ln" },
  abs: { internal: "abs", args: 1, display: "abs" },
  sign: { internal: "sign", args: 1, display: "sign" },
  floor: { internal: "floor", args: 1, display: "floor" },
  ceil: { internal: "ceil", args: 1, display: "ceil" },
  round: { internal: "round", args: 1, display: "round" },
  exp: { internal: "exp", args: 1, display: "exp" },
  sec: { internal: "sec", args: 1, display: "sec" },
  csc: { internal: "csc", args: 1, display: "csc" },
  cot: { internal: "cot", args: 1, display: "cot" },
  min: { internal: "min", args: 2, display: "min" },
  max: { internal: "max", args: 2, display: "max" },
  clamp: { internal: "clamp", args: 3, display: "clamp" },
  frac: { internal: "frac", args: 2, display: "frac" }
};
const LATEX_SHORTCUTS = new Set(Object.keys(LATEX_FUNCTIONS));
const FUNCTION_TEXT_NAMES = new Set(Object.values(LATEX_FUNCTIONS).map((config) => config.internal));
const SETTING_TEXT_KEYS = new Set([
  "x_min",
  "x_max",
  "y_min",
  "y_max",
  "max_recursion",
  "angle_mode",
  "background_color",
  "ensure_square_grid",
  "aspect_ratio",
  "draw_only_inside_boundary",
  "unbounded_decimal_places",
  "unbounded_integer_digits"
]);
const COMMON_ASPECT_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:2", label: "3:2" },
  { value: "16:9", label: "16:9" },
  { value: "2:1", label: "2:1" }
];
const NODE_BLUE_FLAG_THRESHOLD = 2 ** 12;
const NODE_RED_FLAG_THRESHOLD = 2 ** 16;
const DEFAULT_DRAW_FUNCTION = { id: "f1", kind: "variable", expression: "x" };
const DEFAULT_DRAW_COLOR = { id: "default", label: "default", red: "x", green: "x", blue: "x" };
const DEFAULT_DRAW_BOUNDARY = { id: "default", label: "default", expression: "1", checkSmaller: false };
const LEGACY_DEFAULT_COLOR_IDS = new Set(["c1"]);
const LEGACY_DEFAULT_BOUNDARY_IDS = new Set(["rest"]);
const FUNCTION_ENTRY_KINDS = new Set(["variable", "slider", "function"]);
const TIME_VARIABLE_MODES = new Set(["bounded", "unbounded", "bounded_looped"]);
const HELP_TEXT = {
  standard: "Standard mode is the visual editor. Use tabs for functions, colors, bounds, draw layers, and settings.",
  text: "Text mode shows the whole Lepton scene as plain text. It is useful for copying, pasting, sharing, and bulk edits.",
  functions: "Functions tab entries can be variables, sliders, or parameterized functions. Variables are named formulas, sliders are adjustable numeric values, and functions accept inputs like f(x,y).",
  colors: "Colors map red, green, and blue channels to function IDs. For example colour rgb = r~g~b uses functions named r, g, and b.",
  restrictions: "Bounds draw only where their function is greater than or equal to zero, or less than or equal to zero when you flip the checkbox.",
  draws: "Draw layers connect a function, color, and bound. Layers are drawn in order and can be hidden or dragged.",
  settings: "Settings control the viewport, recursion depth, angle mode, and optional solid background color.",
  textLanguage: "Lepton text is the same graph in one copyable script. Use set, variable, slider, time, function, colour/color, boundary/restriction, and draw(...).",
  applyText: "Apply reads the script in Text mode, rebuilds the graph from it, and redraws the result.",
  refreshText: "Refresh text rewrites this script from the current Standard editor state. It asks first because unsaved text edits are replaced.",
  backgroundColor: "Default uses the grid background. Custom uses a color ID from the Colors tab as a solid canvas background.",
  settingXMin: "The left edge of the coordinate window. You can enter numbers or expressions such as -pi.",
  settingXMax: "The right edge of the coordinate window. It must be greater than x minimum when square grid is off.",
  settingYMin: "The bottom edge of the coordinate window. You can use the same math syntax as function fields.",
  settingYMax: "The top edge of the coordinate window. It must be greater than y minimum when square grid is off.",
  settingEnsureSquareGrid: "Keeps graph units visually square. If the requested bounds do not match the aspect ratio, Lepton expands the window to fit.",
  settingAspectRatio: "Controls the shape Lepton fits the square grid into. Use a preset or Custom for your own width:height ratio.",
  settingCustomAspectRatio: "Custom ratios use two math fields: the left number is width and the right number is height.",
  settingDrawOnlyInsideBoundary: "When enabled, pixels outside the active draw boundary are not drawn at all instead of showing the background.",
  settingMaxRecursion: "The maximum depth used when a variable refers back to itself or through a loop of other variables.",
  settingUnboundedDecimals: "How many digits to keep after the decimal point for unbounded time variables while they animate.",
  settingUnboundedIntegerDigits: "The minimum number of digits shown before the decimal for unbounded time variables. Larger values still expand naturally.",
  settingAngleMode: "Chooses whether trig functions read angles as radians or degrees.",
  settingBackgroundColorId: "Choose the color ID used as the solid background when Background color is set to Custom.",
  boundaryDirection: "Unchecked draws when the function value is greater than or equal to zero. Checked draws when the function value is less than or equal to zero.",
  tutorial: "Open a guided overview of Lepton GRE concepts and workflows."
};

let scene = structuredClone(DEFAULT_SCENE);
let displayMode = "standard";
let activeTab = "functions";
let sidebarWidth = Number(localStorage.getItem("lepton-sidebar-width") ?? "380");
let sidebarCollapsed = localStorage.getItem("lepton-sidebar-collapsed") === "true";
let viewport = loadViewport();
let panRenderFrame = 0;
let tutorialStep = null;
const TUTORIAL_STEPS = [
  {
    mode: "standard",
    tab: "functions",
    title: "Step 1: Choose an entry type",
    body: "The Functions tab now starts each row as a variable. Keep variable for ordinary formulas like eq = sin(x)+cos(y), switch to slider for a draggable value, or switch to function when you want inputs like f(x,y)."
  },
  {
    mode: "standard",
    tab: "functions",
    title: "Step 2: Use variables, sliders, and functions",
    body: "Variables can reference other IDs. Sliders expose a value between editable min and max endpoints. Functions add an inputs box; inside function f(x,banana), those input names override any outer variables with the same names."
  },
  {
    mode: "standard",
    tab: "colors",
    title: "Step 3: Make a colour",
    body: "Colours point their red, green, and blue channels at function IDs. A simple colour can use the same function three times; richer graphs use separate r, g, and b functions."
  },
  {
    mode: "standard",
    tab: "restrictions",
    title: "Step 4: Add a boundary",
    body: "Boundaries decide where a layer draws. Unchecked draws when the boundary function is >= 0. Checked draws when it is <= 0. Use the default boundary for no restriction."
  },
  {
    mode: "standard",
    tab: "draws",
    title: "Step 5: Connect a draw layer",
    body: "Draw chooses the function, colour, and boundary to render. Blank graphs offer f1, default colour, and default boundary so there is always a valid starting layer."
  },
  {
    mode: "text",
    tab: "draws",
    title: "Step 6: Share or bulk edit",
    body: "Text mode is the same graph as script. Settings appear first, followed by variable, slider, time, function, colour, boundary, and draw(...) lines. Apply reads text back into the visual editor."
  }
];
const listControls = {
  functions: { query: "", sort: "custom" },
  colors: { query: "", sort: "custom" },
  restrictions: { query: "", sort: "custom" }
};
const editorHistory = new Map();
const sceneHistory = { undo: [], redo: [], last: "" };
const playingTimeIds = new Set();
const timeVariableDirections = new Map();
const entryScrollTops = new Map();
let pendingScrollTarget = null;
let keyboardOpen = false;
let keyboardTab = "pad";
let activeKeyboardTarget = null;
let helpTooltipTimer = null;
let activeHelpTarget = null;
let pointerSelectionField = null;
let lastPointerClientX = null;
let boundaryPulseUntil = 0;
let boundaryPulseTimer = 0;
let aspectRatioCustomOpen = false;
let animationFrameId = 0;
let animationLastTimestamp = 0;
const TIME_VARIABLE_RATE = 1;
let saveDialogOpen = false;
let libraryDialogOpen = false;
let saveNameDraft = "";
let hasUnsavedChanges = false;

const root = document.querySelector("#app");
window.__leptonForceGradient = false;

function renderApp() {
  rememberEntryScroll();
  hideHelpTooltip();
  prunePlayingTimeIds();
  const diagnostics = validateScene();
  const scrollKey = panelScrollKey();
  root.innerHTML = `
    <main class="app-shell ${sidebarCollapsed ? "app-shell-sidebar-collapsed" : ""}" style="--sidebar-width: ${sidebarWidth}px">
      <section class="expression-panel ${displayMode === "text" ? "expression-panel-text" : ""}" aria-label="Expression editor">
        <header class="panel-header">
          <div class="brand-row">
            <a class="brand-link" href="./index.html" aria-label="Go to Lepton landing page">
              <img src="./src/assets/lepton-logo-transparent.png" alt="" />
              <strong>Lepton GRE</strong>
            </a>
            <button class="tutorial-button" data-action="tutorial" type="button">What do I do?</button>
            <button class="toolbar-button" data-action="new-graph" type="button">New</button>
            <button class="toolbar-button ${hasUnsavedChanges ? "primary" : ""}" data-action="open-save-dialog" type="button">Save</button>
            <button class="toolbar-button" data-action="open-library" type="button">Load</button>
          </div>
          <div class="display-row" aria-label="Display mode">
            <button class="display-button" data-display-mode="standard" aria-selected="${displayMode === "standard"}">${helpDash("Standard", "standard")}</button>
            <button class="display-button" data-display-mode="text" aria-selected="${displayMode === "text"}">${helpDash("Text", "text")}</button>
          </div>
        </header>
        <nav class="tab-row" aria-label="Editor sections" ${displayMode === "text" ? "hidden" : ""}>
          ${tabs
            .map(([id, label]) => `<button class="tab-button" data-tab="${id}" aria-selected="${id === activeTab}">${helpDash(label, id)}</button>`)
            .join("")}
        </nav>
        <div class="entry-list ${displayMode === "text" ? "entry-list-text" : ""}">${renderPanel()}</div>
        <button class="keyboard-toggle" data-action="toggle-keyboard" type="button" aria-pressed="${keyboardOpen}" aria-label="${keyboardOpen ? "Hide keyboard" : "Show keyboard"}">⌨</button>
        ${keyboardOpen ? renderKeyboardPanel() : ""}
      </section>
      <div class="sidebar-resizer" role="separator" aria-label="Resize expression panel" tabindex="0"></div>
      <section class="renderer-pane" aria-label="Grid renderer">
        <button class="sidebar-toggle" data-action="toggle-sidebar" aria-label="${sidebarCollapsed ? "Show expression panel" : "Hide expression panel"}" aria-pressed="${sidebarCollapsed}">
          <span aria-hidden="true"></span>
        </button>
        <canvas class="grid-canvas"></canvas>
        <div class="grid-boundary-overlay" aria-hidden="true"></div>
        <div class="render-overlay">${scene.settings.angleMode} · depth ${scene.settings.maxRecursion} · ${diagnostics.summary}</div>
      </section>
      ${renderSavedGraphsDialog()}
    </main>
  `;
  if (root.dataset) root.dataset.panelKey = scrollKey;

  bindEvents();
  bindCanvasPan();
  restoreEntryScroll();
  renderScene(diagnostics);
  queueMathLayoutReflow();
}

function panelScrollKey() {
  return displayMode === "text" ? "text" : activeTab;
}

function sortLabel(sort) {
  if (sort === "az") return "ID A-Z";
  if (sort === "za") return "ID Z-A";
  return "In order";
}

function normalizeFunctionEntry(entry) {
  const kind = FUNCTION_ENTRY_KINDS.has(entry?.kind) ? entry.kind : "variable";
  return {
    id: String(entry?.id ?? ""),
    kind,
    expression: String(entry?.expression ?? ""),
    params: Array.isArray(entry?.params) ? entry.params.map((param) => String(param).trim()).filter(Boolean) : [],
    sliderMin: String(entry?.sliderMin ?? "0"),
    sliderMax: String(entry?.sliderMax ?? "10"),
    time: Boolean(entry?.time),
    timeMode: TIME_VARIABLE_MODES.has(entry?.timeMode) ? entry.timeMode : "bounded"
  };
}

function formatSliderValue(value, entry = null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  if (Math.abs(number) < 1e-12) return "0";
  if (entry?.time && normalizeTimeMode(entry.timeMode) === "unbounded") {
    return formatUnboundedTimeValue(number);
  }
  return Number(number.toPrecision(6)).toString();
}

function formatUnboundedTimeValue(value) {
  const decimals = clampInteger(scene.settings.unboundedDecimalPlaces ?? 3, 0, 12);
  const integerDigits = clampInteger(scene.settings.unboundedIntegerDigits ?? 1, 1, 24);
  const sign = value < 0 ? "-" : "";
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  const padded = integer.padStart(integerDigits, "0");
  return decimals > 0 ? `${sign}${padded}.${fraction}` : `${sign}${padded}`;
}

function clampInteger(value, min, max) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function functionEntryExpression(entry) {
  return String(normalizeFunctionEntry(entry).expression ?? "");
}

function functionEntryParams(entry) {
  return normalizeFunctionEntry(entry).params;
}

function functionEntryKind(entry) {
  return normalizeFunctionEntry(entry).kind;
}

function envEntry(env, name) {
  const value = env?.[name];
  if (!value) return null;
  return typeof value === "string" ? normalizeFunctionEntry({ id: name, kind: "variable", expression: value }) : normalizeFunctionEntry(value);
}

function envExpression(env, name) {
  const entry = envEntry(env, name);
  return entry ? functionEntryExpression(entry) : "";
}

function envFunctionDefinitions(env) {
  return Object.fromEntries(
    Object.entries(env ?? {})
      .map(([id, entry]) => [id, envEntry(env, id)])
      .filter(([, entry]) => entry && entry.kind === "function")
  );
}

function nextSort(sort) {
  if (sort === "custom") return "az";
  if (sort === "az") return "za";
  return "custom";
}

function keyboardMode() {
  const target = activeKeyboardElement();
  return keyboardModeForElement(target);
}

function keyboardModeForElement(target) {
  return target?.classList?.contains("entry-id") ? "id" : "math";
}

function activeKeyboardElement() {
  const active = document.activeElement;
  if (active?.matches?.("[data-field]")) return active;
  if (activeKeyboardTarget) {
    const target = root.querySelector(`[data-field="${cssEscape(activeKeyboardTarget)}"]`);
    if (target) return target;
  }
  return root.querySelector(".mathquill-field[data-field]");
}

function renderKeyboardPanel() {
  const mode = keyboardMode();
  return `
    <section class="keyboard-panel" aria-label="On-screen keyboard">
      <div class="keyboard-header">
        <strong>${mode === "id" ? "ID keyboard" : "Math keyboard"}</strong>
        <button class="keyboard-close" data-action="close-keyboard" type="button" aria-label="Hide keyboard">×</button>
      </div>
      ${mode === "id" ? renderIdKeyboard() : renderMathKeyboard()}
    </section>
  `;
}

function renderIdKeyboard() {
  const rows = ["abcdefghi", "jklmnopqr", "stuvwxyz_", "0123456789"];
  return `
    <div class="keyboard-grid keyboard-grid-letters">
      ${rows.flatMap((row) => [...row].map((key) => keyboardButton(key, key))).join("")}
      ${keyboardButton("Backspace", "⌫", "keyboard-wide")}
      ${keyboardButton("ArrowLeft", "←")}
      ${keyboardButton("ArrowRight", "→")}
    </div>
  `;
}

function renderMathKeyboard() {
  const primary = [
    "7", "8", "9", "+", "-", "4", "5", "6", "*", "/", "1", "2", "3", "^", "sqrt", "0", ".", ",", "x", "y",
    "pi", "(", ")", "sin", "cos", "tan", "abs", "e", "Backspace", "ArrowLeft", "ArrowRight"
  ];
  const extraPriority = ["sec", "csc", "cot"];
  const extra = Object.keys(LATEX_FUNCTIONS)
    .filter((name) => !primary.includes(name) && !["frac"].includes(name))
    .sort((left, right) => {
      const leftIndex = extraPriority.indexOf(left);
      const rightIndex = extraPriority.indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? 100 : leftIndex) - (rightIndex === -1 ? 100 : rightIndex);
      }
      return left.localeCompare(right);
    });
  const variables = scene.functions.map((entry) => entry.id).filter(Boolean);
  return `
    <div class="keyboard-tabs" role="tablist" aria-label="Keyboard tabs">
      <button class="keyboard-tab" data-keyboard-tab="pad" aria-selected="${keyboardTab === "pad"}" type="button">Pad</button>
      <button class="keyboard-tab" data-keyboard-tab="variables" aria-selected="${keyboardTab === "variables"}" type="button">Variables</button>
    </div>
    ${keyboardTab === "variables" ? `
      <div class="keyboard-library">
        ${variables.length ? variables.map((id) => keyboardButton(id, id)).join("") : `<span class="keyboard-empty">No variables yet</span>`}
      </div>
    ` : `
      <div class="keyboard-grid">
        ${primary.map((key) => keyboardButton(key, key === "Backspace" ? "⌫" : key === "ArrowLeft" ? "←" : key === "ArrowRight" ? "→" : key)).join("")}
      </div>
      <details class="keyboard-extra">
        <summary>More functions</summary>
        <div class="keyboard-library">${extra.map((key) => keyboardButton(key, key)).join("")}</div>
      </details>
    `}
  `;
}

function keyboardButton(value, label, className = "") {
  return `<button class="keyboard-key ${className}" data-key="${escapeHtml(value)}" type="button">${escapeHtml(label)}</button>`;
}

function rememberEntryScroll() {
  const key = root.dataset?.panelKey;
  const list = root.querySelector(".entry-list");
  if (!key || !list) return;
  entryScrollTops.set(key, list.scrollTop);
}

function restoreEntryScroll() {
  const list = root.querySelector(".entry-list");
  if (!list) return;

  if (pendingScrollTarget) {
    const { kind, index } = pendingScrollTarget;
    pendingScrollTarget = null;
    const addButton = root.querySelector(`[data-add="${cssEscape(kind)}"]`);
    const row = root.querySelector(`[data-entry-kind="${cssEscape(kind)}"][data-entry-index="${index}"]`);
    const target = addButton ?? row;
    if (target) {
      target.scrollIntoView({ block: "nearest" });
      return;
    }
  }

  list.scrollTop = entryScrollTops.get(panelScrollKey()) ?? 0;
}

function sceneSnapshot() {
  return JSON.stringify(scene);
}

function recordSceneHistory(previous = sceneSnapshot()) {
  const current = sceneSnapshot();
  if (previous === current) return;
  markUnsavedChange();
  const lastUndo = sceneHistory.undo[sceneHistory.undo.length - 1];
  if (lastUndo !== previous) {
    sceneHistory.undo.push(previous);
    if (sceneHistory.undo.length > 100) sceneHistory.undo.shift();
  }
  sceneHistory.redo = [];
  sceneHistory.last = current;
}

function markUnsavedChange() {
  hasUnsavedChanges = true;
  updateSaveButtonState();
}

function markSaved() {
  hasUnsavedChanges = false;
  updateSaveButtonState();
}

function updateSaveButtonState() {
  const button = root?.querySelector?.('[data-action="open-save-dialog"]');
  if (!button) return;
  button.classList.toggle("primary", hasUnsavedChanges);
}

function restoreSceneHistory(direction) {
  const from = direction === "undo" ? sceneHistory.undo : sceneHistory.redo;
  const to = direction === "undo" ? sceneHistory.redo : sceneHistory.undo;
  if (!from.length) return false;
  syncFields();
  to.push(sceneSnapshot());
  const source = from.pop();
  scene = JSON.parse(source);
  sceneHistory.last = source;
  viewport = sceneViewport();
  saveViewport();
  markUnsavedChange();
  renderApp();
  return true;
}

function isEditableTarget(target) {
  const element = target?.nodeType === Node.TEXT_NODE ? target.parentElement : target;
  if (!element?.closest) return false;
  return Boolean(element.closest("input, textarea, [contenteditable='true'], .mq-editable-field, .mathquill-field"));
}

function handleGlobalHistoryKeydown(event) {
  const key = event.key.toLowerCase();
  if (!(event.metaKey || event.ctrlKey)) return;
  if (key !== "z" && key !== "y") return;
  if (closestMathFieldTarget(event.target)) {
    if (handleFieldHistoryKeydown(event)) event.preventDefault();
    return;
  }
  if (isEditableTarget(event.target)) return;
  const direction = key === "y" || event.shiftKey ? "redo" : "undo";
  if (restoreSceneHistory(direction)) {
    event.preventDefault();
  }
}

function closestMathFieldTarget(target) {
  const element = target?.nodeType === Node.TEXT_NODE ? target.parentElement : target;
  return element?.closest?.(".mathquill-field, .mq-editable-field") ?? null;
}

function keepHorizontalCaretVisible(field) {
  const cursor = field.querySelector(".mq-cursor");
  const selection = field.querySelector(".mq-selection");
  if (selection) return;
  const target = cursor;
  if (!target) return;
  const fieldRect = field.getBoundingClientRect();
  const cursorRect = target.getBoundingClientRect();
  const inset = 18;
  if (cursorRect.right > fieldRect.right - inset) {
    field.scrollLeft += cursorRect.right - fieldRect.right + inset;
  } else if (cursorRect.left < fieldRect.left + inset) {
    field.scrollLeft -= fieldRect.left + inset - cursorRect.left;
  }
}

function scrollFieldNearPointer(field, event) {
  if (field.scrollWidth <= field.clientWidth) return;
  const rect = field.getBoundingClientRect();
  const rightEdge = 44;
  const leftEdge = 64;
  const maxStep = 7;
  if (event.clientX > rect.right - rightEdge) {
    const pressure = event.clientX - (rect.right - rightEdge);
    field.scrollLeft += clampNumber(pressure * 0.12, 1, maxStep);
  } else if (event.clientX < rect.left + leftEdge) {
    const pressure = rect.left + leftEdge - event.clientX;
    field.scrollLeft -= clampNumber(pressure * 0.12, 1, maxStep);
  }
}

function scrollFieldHorizontally(field, event) {
  if (field.scrollWidth <= field.clientWidth) return false;
  const horizontal = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!horizontal) return false;
  field.scrollLeft += horizontal;
  return true;
}

function keepTextInputCaretVisible(field, event = null) {
  if (field.selectionStart == null || field.selectionEnd == null) return;
  if (field.selectionStart !== field.selectionEnd) return;
  const caretIndex = textInputVisibleCaretIndex(field, event);
  if (caretIndex === field.value.length) {
    field.scrollLeft = field.scrollWidth;
    return;
  }
  const caretLeft = textWidthForInput(field, field.value.slice(0, caretIndex));
  const inset = 20;
  const visibleLeft = field.scrollLeft;
  const visibleRight = field.scrollLeft + field.clientWidth;
  if (caretLeft < visibleLeft + inset) {
    field.scrollLeft = Math.max(0, caretLeft - inset);
  } else if (caretLeft > visibleRight - inset) {
    field.scrollLeft = Math.max(0, caretLeft - field.clientWidth + inset);
  }
}

function textInputVisibleCaretIndex(field, event = null) {
  if (field.selectionStart === field.selectionEnd || !event) {
    return field.selectionEnd ?? field.selectionStart ?? field.value.length;
  }
  const rect = field.getBoundingClientRect();
  const midpoint = rect.left + rect.width / 2;
  return event.clientX < midpoint ? field.selectionStart : field.selectionEnd;
}

function textWidthForInput(field, text) {
  const style = getComputedStyle(field);
  const canvas = textWidthForInput.canvas ??= document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`;
  const padding = parseFloat(style.paddingLeft || "0") + 2;
  return context.measureText(text).width + padding;
}

function insertIntoTextField(field, text) {
  field.focus();
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  field.setRangeText(text, start, end, "end");
  field.dispatchEvent(new Event("input", { bubbles: true }));
  keepTextInputCaretVisible(field);
}

function activateKeyboardTarget(target) {
  const previousTarget = activeKeyboardTarget;
  const previousMode = keyboardMode();
  const field = target?.closest?.("[data-field]");
  if (field) activeKeyboardTarget = field.dataset.field;
  const nextMode = keyboardModeForElement(field);
  if (keyboardOpen && previousTarget !== activeKeyboardTarget && previousMode !== nextMode) {
    renderApp();
    requestAnimationFrame(() => {
      const nextField = activeKeyboardElement();
      nextField?.focus?.();
    });
  }
}

function syncMathApiField(field) {
  const mathField = field.__mathField;
  if (!mathField) return;
  field.dataset.value = mathField.latex();
  updateField(field);
  const diagnostics = validateScene();
  updateStatusLights(diagnostics);
  renderScene(diagnostics);
  requestAnimationFrame(() => keepHorizontalCaretVisible(field));
}

function insertKeyboardValue(value) {
  const target = activeKeyboardElement();
  if (!target) return;
  if (target.classList?.contains("mathquill-field")) {
    const mathField = target.__mathField;
    if (!mathField) return;
    mathField.focus();
    if (value === "Backspace" || value === "ArrowLeft" || value === "ArrowRight") {
      mathField.keystroke(value);
    } else if (value === "sqrt") {
      mathField.cmd("\\sqrt");
    } else if (value === "pi") {
      mathField.cmd("\\pi");
    } else if (LATEX_FUNCTIONS[value] && value !== "frac") {
      mathField.typedText(`${value}(`);
    } else {
      mathField.typedText(value);
    }
    syncMathApiField(target);
    return;
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const idMode = target.classList.contains("entry-id");
    if (value === "Backspace") {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? start;
      if (start !== end) {
        target.setRangeText("", start, end, "end");
      } else if (start > 0) {
        target.setRangeText("", start - 1, end, "end");
      }
      target.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (value === "ArrowLeft" || value === "ArrowRight") {
      const delta = value === "ArrowLeft" ? -1 : 1;
      const next = Math.max(0, Math.min(target.value.length, (target.selectionStart ?? target.value.length) + delta));
      target.setSelectionRange(next, next);
    } else if (idMode) {
      if (/^[A-Za-z0-9_]$/.test(value)) insertIntoTextField(target, value);
    } else {
      insertIntoTextField(target, keyboardTextForValue(value));
    }
    keepTextInputCaretVisible(target);
  }
}

function keyboardTextForValue(value) {
  if (value === "pi") return "pi";
  if (value === "sqrt") return "sqrt(";
  if (LATEX_FUNCTIONS[value] && value !== "frac") return `${LATEX_FUNCTIONS[value].internal}(`;
  return value;
}

function handleDocumentSelectionScroll() {
  const target = activeKeyboardElement();
  if (!target) return;
  if (target.classList?.contains("mathquill-field")) {
    keepHorizontalCaretVisible(target);
  } else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    keepTextInputCaretVisible(target);
  }
}

function beginSelectionPointerScroll(field) {
  pointerSelectionField = field;
}

function handleDocumentPointerScroll(event) {
  lastPointerClientX = event.clientX;
  const field = pointerSelectionField;
  if (!field || !event.buttons) return;
  scrollFieldNearPointer(field, event);
  if (field.classList?.contains("mathquill-field")) {
    keepHorizontalCaretVisible(field);
  } else if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    keepTextInputCaretVisible(field, event);
  }
}

function stopSelectionPointerScroll() {
  pointerSelectionField = null;
  lastPointerClientX = null;
}

function renderPanel() {
  const diagnostics = validateScene();

  if (displayMode === "text") {
    return `
      <div class="text-mode-panel">
        ${tutorialCoachmark()}
        <div class="text-language-help">
          <span>${helpDash("Lepton language", "textLanguage")}</span>
        </div>
        <div class="scene-text-editor">
          <pre class="scene-text-highlight" data-scene-highlight aria-hidden="true">${highlightLeptonText(exportScene())}</pre>
          <textarea class="scene-textarea" data-scene-text spellcheck="false">${escapeHtml(exportScene())}</textarea>
        </div>
        <div class="text-mode-actions">
          <span class="text-action-wrap"><button class="toolbar-button primary" data-action="apply-text">Apply</button>${helpMark("applyText")}</span>
          <span class="text-action-wrap"><button class="toolbar-button" data-action="refresh-text">Refresh text</button>${helpMark("refreshText")}</span>
        </div>
      </div>
    `;
  }

  if (activeTab === "functions") {
    return [
      tutorialCoachmark(),
      listControlBar("functions", "functions"),
      ...visibleEntries(scene.functions, "functions").map(
        ([entry, index]) => expressionRow(diagnostics.functions[index]?.status ?? "invalid", diagnostics.functions[index]?.message ?? "", functionRowContent(entry, index), "functions", index)
      ),
      addRow("Add function", "functions")
    ].join("");
  }

  if (activeTab === "colors") {
    return [
      tutorialCoachmark(),
      listControlBar("colors", "colors"),
      ...visibleEntries(scene.colors, "colors").map(
        ([entry, index]) => expressionRow(diagnostics.colors[index]?.status ?? "invalid", diagnostics.colors[index]?.message ?? "", `
          <input class="entry-id" data-field="colors.${index}.id" value="${escapeHtml(entry.id)}" placeholder="ID" aria-label="Color id" />
          <label class="channel-row"><span class="channel-label">red channel</span>${searchableReference(`colors.${index}.red`, scene.functions, entry.red, "Red function")}</label>
          <label class="channel-row"><span class="channel-label">green channel</span>${searchableReference(`colors.${index}.green`, scene.functions, entry.green, "Green function")}</label>
          <label class="channel-row"><span class="channel-label">blue channel</span>${searchableReference(`colors.${index}.blue`, scene.functions, entry.blue, "Blue function")}</label>
        `, "colors", index)
      ),
      addRow("Add color", "colors")
    ].join("");
  }

  if (activeTab === "restrictions") {
    return [
      tutorialCoachmark(),
      listControlBar("restrictions", "bounds"),
      ...visibleEntries(scene.restrictions, "restrictions").map(
        ([entry, index]) => expressionRow(diagnostics.restrictions[index]?.status ?? "invalid", diagnostics.restrictions[index]?.message ?? "", `
          <input class="entry-id" data-field="restrictions.${index}.id" value="${escapeHtml(entry.id)}" placeholder="ID" aria-label="Restriction id" />
          <label class="settings-row"><span>Function reference</span>${searchableReference(`restrictions.${index}.expression`, scene.functions, entry.expression, "Boundary function")}</label>
          <label class="inline-check"><input type="checkbox" data-field="restrictions.${index}.checkSmaller" ${entry.checkSmaller ? "checked" : ""} /> draw when less than or equal to 0 ${helpMark("boundaryDirection")}</label>
        `, "restrictions", index)
      ),
      addRow("Add boundary", "restrictions")
    ].join("");
  }

  if (activeTab === "draws") {
    return [
      tutorialCoachmark(),
      timePlaybackControls(),
      ...scene.draws.map(
        (entry, index) => expressionRow(diagnostics.draws[index]?.status ?? "invalid", diagnostics.draws[index]?.message ?? "", `
          <div class="draw-layer-toolbar">
            <button class="draw-drag-handle" data-draw-handle="${index}" draggable="true" title="Drag to reorder draw layer" aria-label="Drag to reorder draw layer">↕</button>
            <button class="draw-visibility" data-toggle-draw="${index}" aria-pressed="${entry.hidden ? "true" : "false"}">${entry.hidden ? "Show" : "Hide"}</button>
          </div>
          ${searchableReference(`draws.${index}.equationId`, drawFunctionEntries(), entry.equationId, "Draw function")}
          ${searchableReference(`draws.${index}.colorId`, drawColorEntries(), entry.colorId, "Draw color")}
          ${searchableReference(`draws.${index}.restrictionId`, drawBoundaryEntries(), entry.restrictionId, "Draw boundary")}
        `, "draws", index, { rowClass: entry.hidden ? "expression-row-hidden" : "", attrs: `data-draw-index="${index}"` })
      ),
      addRow("Add draw layer", "draws")
    ].join("");
  }

  const gridStatus = diagnostics.settings[0] ?? { status: "valid", message: "Grid rendering settings are valid" };
  return `
    ${tutorialCoachmark()}
    <div class="settings-grid">
      <section class="settings-section">
        <h3 class="settings-section-title">
          <span class="entry-status ${gridStatus.status}" title="${escapeHtml(gridStatus.message)}" aria-label="${escapeHtml(gridStatus.message)}"></span>
          Grid rendering
        </h3>
        ${settingsMathField("xMin", "x minimum", "settingXMin")}
        ${settingsMathField("xMax", "x maximum", "settingXMax")}
        ${settingsMathField("yMin", "y minimum", "settingYMin")}
        ${settingsMathField("yMax", "y maximum", "settingYMax")}
        <label class="inline-check">
          <input type="checkbox" data-field="settings.ensureSquareGrid" ${scene.settings.ensureSquareGrid !== false ? "checked" : ""} />
          ensure square grid ${helpMark("settingEnsureSquareGrid")}
        </label>
        <label class="settings-row">
          <span>Aspect ratio ${helpMark("settingAspectRatio")}</span>
          <select class="compact-field" data-aspect-ratio-preset>
            ${aspectRatioOptions()}
          </select>
        </label>
        ${isCustomAspectRatio() ? aspectRatioFields() : ""}
        <label class="inline-check">
          <input type="checkbox" data-field="settings.drawOnlyInsideBoundary" ${scene.settings.drawOnlyInsideBoundary ? "checked" : ""} />
          draw only inside boundary ${helpMark("settingDrawOnlyInsideBoundary")}
        </label>
      </section>
      <section class="settings-section">
        <h3>Calculation</h3>
        ${settingsField("maxRecursion", "max recursion depth", "number", "settingMaxRecursion")}
      </section>
      <section class="settings-section">
        <h3>Numerical settings</h3>
        ${settingsField("unboundedDecimalPlaces", "unbounded time decimal places", "number", "settingUnboundedDecimals")}
        ${settingsField("unboundedIntegerDigits", "minimum integer digits", "number", "settingUnboundedIntegerDigits")}
      </section>
      <label class="settings-row">
        <span>Angle mode ${helpMark("settingAngleMode")}</span>
        <select class="compact-field" data-field="settings.angleMode">
          <option value="radians" ${scene.settings.angleMode === "radians" ? "selected" : ""}>radians</option>
          <option value="degrees" ${scene.settings.angleMode === "degrees" ? "selected" : ""}>degrees</option>
        </select>
      </label>
      <label class="settings-row">
        <span>Background color ${helpMark("backgroundColor")}</span>
        <select class="compact-field" data-background-mode>
          <option value="0" ${scene.settings.backgroundColor === "0" ? "selected" : ""}>Default</option>
          <option value="custom" ${scene.settings.backgroundColor !== "0" ? "selected" : ""}>Custom</option>
        </select>
      </label>
      ${scene.settings.backgroundColor !== "0" ? `
        <label class="settings-row">
          <span>Background color ID ${helpMark("settingBackgroundColorId")}</span>
          ${searchableReference("settings.backgroundColor", scene.colors, scene.settings.backgroundColor, "Background color")}
        </label>
      ` : ""}
    </div>
  `;
}

function timePlaybackControls() {
  const timeVariables = scene.functions.map(normalizeFunctionEntry).filter((entry) => entry.kind === "slider" && entry.time && entry.id);
  const hasTimeVariables = timeVariables.length > 0;
  const anyPlaying = timeVariables.some((entry) => playingTimeIds.has(entry.id));
  return `
    <div class="draw-playbar">
      <button class="toolbar-button" data-action="toggle-global-time" type="button" ${hasTimeVariables ? "" : "disabled"}>
        ${anyPlaying ? "Stop time" : "Play time"}
      </button>
      <span>${hasTimeVariables ? `${playingTimeIds.size} playing` : "No time variables"}</span>
    </div>
  `;
}

function renderSavedGraphsDialog() {
  if (saveDialogOpen) return renderSaveGraphDialog();
  if (libraryDialogOpen) return renderSavedGraphLibrary();
  return "";
}

function renderSaveGraphDialog() {
  return `
    <div class="modal-backdrop" data-action="close-save-dialog">
      <section class="modal-card save-graph-card" role="dialog" aria-modal="true" aria-label="Save graph">
        <header class="modal-header">
          <h2>Save graph</h2>
          <button class="modal-close" data-action="close-save-dialog" type="button" aria-label="Close save dialog">×</button>
        </header>
        <label class="save-name-row">
          <span>Name</span>
          <input class="compact-field" data-save-name value="${escapeHtml(saveNameDraft)}" placeholder="Graph name" />
        </label>
        <div class="modal-actions">
          <button class="toolbar-button" data-action="close-save-dialog" type="button">Cancel</button>
          <button class="toolbar-button primary" data-action="confirm-save-graph" type="button">Save graph</button>
        </div>
      </section>
    </div>
  `;
}

function renderSavedGraphLibrary() {
  const graphs = loadSavedGraphs();
  return `
    <div class="modal-backdrop" data-action="close-save-dialog">
      <section class="modal-card saved-library-card" role="dialog" aria-modal="true" aria-label="Saved graphs">
        <header class="modal-header">
          <h2>Saved graphs</h2>
          <button class="modal-close" data-action="close-save-dialog" type="button" aria-label="Close saved graphs">×</button>
        </header>
        <div class="saved-graph-list">
          ${graphs.length ? graphs.map(savedGraphRow).join("") : `<p class="saved-empty">No saved graphs yet.</p>`}
        </div>
      </section>
    </div>
  `;
}

function savedGraphRow(graph) {
  return `
    <article class="saved-graph-row">
      <img class="saved-graph-thumb" src="${escapeHtml(graph.thumbnail)}" alt="" />
      <div class="saved-graph-meta">
        <strong>${escapeHtml(graph.name)}</strong>
        <span>${escapeHtml(formatSavedGraphDate(graph.createdAt))}</span>
      </div>
      <div class="saved-graph-actions">
        <button class="toolbar-button primary" data-load-saved-graph="${escapeHtml(graph.id)}" type="button">Load</button>
        <button class="toolbar-button" data-delete-saved-graph="${escapeHtml(graph.id)}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function formatSavedGraphDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved locally";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function listControlBar(kind, label) {
  const state = listControls[kind];
  const placeholder = `search for ${label} by ID`;
  return `
    <div class="list-controls" data-list-controls="${kind}">
      <input class="list-search compact-field" data-entry-search="${kind}" value="${escapeHtml(state.query)}" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(placeholder)}" />
      <button class="list-sort compact-field" data-entry-sort="${kind}" type="button" aria-label="Sort ${escapeHtml(kind)} by ID: ${sortLabel(state.sort)}">${sortLabel(state.sort)}</button>
    </div>
  `;
}

function visibleEntries(entries, kind) {
  const state = listControls[kind] ?? { query: "", sort: "custom" };
  const query = state.query.trim().toLowerCase();
  let indexed = entries.map((entry, index) => [entry, index]);
  if (query) {
    indexed = indexed.filter(([entry]) => entry.id.toLowerCase().includes(query));
  }
  if (state.sort !== "custom") {
    indexed.sort(([left], [right]) => {
      const order = left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: "base" });
      return state.sort === "az" ? order : -order;
    });
  }
  return indexed;
}

function functionRowContent(entry, index) {
  const normalized = normalizeFunctionEntry(entry);
  return `
    <div class="function-row-head">
      <input class="entry-id" data-field="functions.${index}.id" value="${escapeHtml(normalized.id)}" placeholder="ID" aria-label="Function id" />
      ${functionKindSelector(normalized.kind, index)}
    </div>
    ${normalized.kind === "slider" ? sliderRowContent(normalized, index) : ""}
    ${normalized.kind === "function" ? functionSignatureContent(normalized, index) : ""}
    ${normalized.kind !== "slider" ? mathEditor(`functions.${index}.expression`, normalized.expression, "Function expression", false, "enter function here") : ""}
  `;
}

function functionKindSelector(kind, index) {
  return `
    <div class="function-kind-selector" aria-label="Function entry type">
      ${["variable", "slider", "function"].map((entryKind) => `
        <button class="function-kind-button" type="button" data-function-kind="${index}.${entryKind}" aria-pressed="${kind === entryKind}">
          ${entryKind}
        </button>
      `).join("")}
    </div>
  `;
}

function functionSignatureContent(entry, index) {
  return `
    <label class="function-params-row">
      <span>inputs</span>
      <input class="compact-field" data-field="functions.${index}.params" value="${escapeHtml(entry.params.join(","))}" placeholder="x,y" aria-label="Function input parameters" />
    </label>
  `;
}

function sliderRowContent(entry, index) {
  const min = evaluateScalarSetting(entry.sliderMin);
  const max = evaluateScalarSetting(entry.sliderMax);
  const value = evaluateScalarSetting(entry.expression);
  const rangeUsable = Number.isFinite(min) && Number.isFinite(max) && max > min;
  const clamped = rangeUsable && Number.isFinite(value) ? clampNumber(value, min, max) : min;
  const isPlaying = entry.time && playingTimeIds.has(entry.id);
  const isUnboundedTime = entry.time && normalizeTimeMode(entry.timeMode) === "unbounded";
  return `
    <div class="slider-controls">
      <label class="slider-value-row">
        <span>value</span>
        ${mathEditor(`functions.${index}.expression`, entry.expression, "Slider value", true, "value")}
      </label>
      ${isUnboundedTime ? "" : `<div class="slider-track-row">
        <label><span>minimum</span>${mathEditor(`functions.${index}.sliderMin`, entry.sliderMin, "Slider minimum", true, "min")}</label>
        <input
          class="slider-range"
          type="range"
          data-slider-value="${index}"
          min="${escapeHtml(String(rangeUsable ? min : 0))}"
          max="${escapeHtml(String(rangeUsable ? max : 1))}"
          step="any"
          value="${escapeHtml(String(rangeUsable ? clamped : 0))}"
          ${rangeUsable ? "" : "disabled"}
          aria-label="Slider value"
        />
        <label><span>maximum</span>${mathEditor(`functions.${index}.sliderMax`, entry.sliderMax, "Slider maximum", true, "max")}</label>
      </div>`}
      <div class="slider-time-row">
        <label class="inline-check"><input type="checkbox" data-field="functions.${index}.time" ${entry.time ? "checked" : ""} /> time variable</label>
        ${entry.time ? `
          <select class="compact-field" data-field="functions.${index}.timeMode" aria-label="Time variable mode">
            <option value="bounded" ${entry.timeMode === "bounded" ? "selected" : ""}>bounded</option>
            <option value="unbounded" ${entry.timeMode === "unbounded" ? "selected" : ""}>unbounded</option>
            <option value="bounded_looped" ${entry.timeMode === "bounded_looped" ? "selected" : ""}>bounded looped</option>
          </select>
          <button class="toolbar-button slider-play-button" data-time-play="${escapeHtml(entry.id)}" type="button">${isPlaying ? "Stop" : "Play"}</button>
        ` : ""}
      </div>
    </div>
  `;
}

function mathEditor(field, value, label, small = false, placeholder = "") {
  const source = normalizeExpressionDisplayText(value);
  const latex = latexSourceFromExpression(source);
  const placeholderAttr = placeholder ? ` data-placeholder="${escapeHtml(placeholder)}"` : "";
  return `
    <div class="mathquill-editor ${small ? "mathquill-editor-small" : ""}">
      <span class="mathquill-field ${small ? "mathquill-field-small" : ""}" data-field="${field}" data-value="${escapeHtml(latex)}"${placeholderAttr} aria-label="${escapeHtml(label)}"></span>
    </div>
  `;
}

function expressionRow(status, message, content, kind = null, index = null, options = {}) {
  const entryAttrs = kind ? `data-entry-kind="${kind}" data-entry-index="${index}"` : "";
  const statusLabel = status === "valid" ? "status: valid" : message || `status: ${status}`;
  return `
    <div class="expression-row ${options.rowClass ?? ""}" title="${escapeHtml(message)}" ${entryAttrs} ${options.attrs ?? ""}>
      <span class="entry-status ${status}" title="${escapeHtml(statusLabel)}" aria-label="${escapeHtml(statusLabel)}"></span>
      <div class="entry-content">${content}</div>
      ${kind ? `<button class="row-action" data-delete="${kind}" data-index="${index}" title="Delete entry" aria-label="Delete entry">×</button>` : `<button class="row-action" title="More options" aria-label="More options">⋯</button>`}
    </div>
  `;
}

function addRow(label, kind) {
  return `
    <button class="add-row" data-add="${kind}">
      <span class="entry-status"></span>
      <span>${label}</span>
    </button>
  `;
}

function settingsField(key, label, type = "number", helpKey = "") {
  return `
    <label class="settings-row">
      <span>${label}${helpKey ? ` ${helpMark(helpKey)}` : ""}</span>
      <input class="compact-field" type="${type}" data-field="settings.${key}" value="${escapeHtml(scene.settings[key])}" />
    </label>
  `;
}

function settingsMathField(key, label, helpKey = "") {
  return `
    <div class="settings-row settings-row-math">
      <span>${label}${helpKey ? ` ${helpMark(helpKey)}` : ""}</span>
      ${mathEditor(`settings.${key}`, String(scene.settings[key] ?? ""), label, true, "enter function here")}
    </div>
  `;
}

function aspectRatioParts() {
  const raw = String(scene.settings.aspectRatio ?? "1:1");
  const index = raw.indexOf(":");
  if (index === -1) return [raw || "1", "1"];
  return [raw.slice(0, index) || "1", raw.slice(index + 1) || "1"];
}

function aspectRatioFields() {
  const [left, right] = aspectRatioParts();
  return `
    <div class="settings-row settings-row-ratio">
      <span>custom ratio ${helpMark("settingCustomAspectRatio")}</span>
      <div class="ratio-fields">
        ${mathEditor("settings.aspectRatioLeft", left, "Aspect ratio left side", true, "enter function here")}
        <span class="ratio-separator">:</span>
        ${mathEditor("settings.aspectRatioRight", right, "Aspect ratio right side", true, "enter function here")}
      </div>
    </div>
  `;
}

function isCustomAspectRatio() {
  const value = String(scene.settings.aspectRatio ?? "1:1");
  return aspectRatioCustomOpen || !COMMON_ASPECT_RATIOS.some((ratio) => ratio.value === value);
}

function aspectRatioOptions() {
  const value = String(scene.settings.aspectRatio ?? "1:1");
  return [
    ...COMMON_ASPECT_RATIOS.map((ratio) => `<option value="${ratio.value}" ${ratio.value === value ? "selected" : ""}>${ratio.label}</option>`),
    `<option value="custom" ${isCustomAspectRatio() ? "selected" : ""}>Custom</option>`
  ].join("");
}

function options(entries, selected) {
  const hasSelected = entries.some((entry) => entry.id === selected);
  return [
    ...(hasSelected || !selected ? [] : [`<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (missing)</option>`]),
    ...entries.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === selected ? "selected" : ""}>${escapeHtml(entry.label ?? entry.id)}</option>`)
  ].join("");
}

function helpMark(key) {
  return `<span class="help-marker" data-help="${escapeHtml(HELP_TEXT[key] ?? "")}" aria-label="${escapeHtml(HELP_TEXT[key] ?? "")}">?</span>`;
}

function helpDash(label, key) {
  return `<span class="help-dash" data-help="${escapeHtml(HELP_TEXT[key] ?? "")}">${escapeHtml(label)}</span>`;
}

function tutorialCoachmark() {
  if (tutorialStep === null) return "";
  const step = TUTORIAL_STEPS[tutorialStep];
  if (!step || step.mode !== displayMode || (displayMode === "standard" && step.tab !== activeTab)) return "";
  return `
    <section class="tutorial-panel" aria-live="polite">
      <div class="tutorial-header">
        <div>
          <p class="tutorial-kicker">Lepton Tutorial ${tutorialStep + 1}/${TUTORIAL_STEPS.length}</p>
          <h2>${escapeHtml(step.title)}</h2>
        </div>
      </div>
      <p>${escapeHtml(step.body)}</p>
      <div class="tutorial-actions">
        <button class="toolbar-button primary" data-action="tutorial-next">${tutorialStep === TUTORIAL_STEPS.length - 1 ? "Finish" : "Next"}</button>
        <button class="toolbar-button" data-action="tutorial-skip">Skip to end</button>
      </div>
    </section>
  `;
}

function searchableReference(field, entries, selected, label) {
  return `
    <div class="reference-picker">
      <input class="compact-field reference-filter" data-reference-filter="${escapeHtml(field)}" value="" placeholder="Search ${escapeHtml(label.toLowerCase())}" aria-label="Search ${escapeHtml(label)}" />
      <select class="compact-field reference-field" data-field="${escapeHtml(field)}" aria-label="${escapeHtml(label)}">
        ${options(entries, selected)}
      </select>
    </div>
  `;
}

function bindEvents() {
  bindSidebarResize();
  bindHelpTooltips();
  root.onfocusin = (event) => activateKeyboardTarget(event.target);
  root.onclick = (event) => {
    if (event.target?.closest?.("[data-field]")) activateKeyboardTarget(event.target);
  };

  root.querySelector('[data-action="open-save-dialog"]')?.addEventListener("click", () => {
    syncFields();
    saveNameDraft = defaultSavedGraphName();
    saveDialogOpen = true;
    libraryDialogOpen = false;
    renderApp();
  });
  root.querySelector('[data-action="new-graph"]')?.addEventListener("click", () => {
    syncFields();
    const before = sceneSnapshot();
    scene = structuredClone(DEFAULT_SCENE);
    viewport = sceneViewport();
    if (isValidViewport(viewport)) saveViewport();
    recordSceneHistory(before);
    markUnsavedChange();
    activeTab = "functions";
    displayMode = "standard";
    renderApp();
  });
  root.querySelector('[data-action="open-library"]')?.addEventListener("click", () => {
    syncFields();
    libraryDialogOpen = true;
    saveDialogOpen = false;
    renderApp();
  });
  root.querySelectorAll('[data-action="close-save-dialog"]').forEach((target) => {
    target.addEventListener("click", (event) => {
      if (target.classList?.contains("modal-backdrop") && event.target !== target) return;
      saveDialogOpen = false;
      libraryDialogOpen = false;
      renderApp();
    });
  });
  root.querySelector('[data-action="confirm-save-graph"]')?.addEventListener("click", () => {
    syncFields();
    const name = root.querySelector("[data-save-name]")?.value?.trim() || defaultSavedGraphName();
    saveCurrentGraph(name);
    saveDialogOpen = false;
    libraryDialogOpen = true;
    renderApp();
  });
  root.querySelectorAll("[data-load-saved-graph]").forEach((button) => {
    button.addEventListener("click", () => {
      const saved = loadSavedGraphs().find((graph) => graph.id === button.dataset.loadSavedGraph);
      if (!saved) return;
      const before = sceneSnapshot();
      scene = importScene(saved.scene);
      viewport = sceneViewport();
      if (isValidViewport(viewport)) saveViewport();
      sceneHistory.undo = [];
      sceneHistory.redo = [];
      sceneHistory.last = sceneSnapshot();
      if (before !== sceneSnapshot()) sceneHistory.undo.push(before);
      markSaved();
      saveDialogOpen = false;
      libraryDialogOpen = false;
      renderApp();
    });
  });
  root.querySelectorAll("[data-delete-saved-graph]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteSavedGraph(button.dataset.deleteSavedGraph);
      renderApp();
    });
  });

  root.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      renderApp();
    });
  });

  root.querySelectorAll("[data-display-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      displayMode = button.dataset.displayMode;
      renderApp();
    });
  });

  root.querySelector('[data-action="tutorial"]')?.addEventListener("click", () => {
    syncFields();
    tutorialStep = 0;
    displayMode = TUTORIAL_STEPS[0].mode;
    activeTab = TUTORIAL_STEPS[0].tab;
    renderApp();
  });

  root.querySelector('[data-action="tutorial-next"]')?.addEventListener("click", () => {
    syncFields();
    tutorialStep = tutorialStep === null ? 0 : tutorialStep + 1;
    if (tutorialStep >= TUTORIAL_STEPS.length) {
      tutorialStep = null;
    } else {
      displayMode = TUTORIAL_STEPS[tutorialStep].mode;
      activeTab = TUTORIAL_STEPS[tutorialStep].tab;
    }
    renderApp();
  });

  root.querySelector('[data-action="tutorial-skip"]')?.addEventListener("click", () => {
    tutorialStep = null;
    renderApp();
  });

  root.querySelectorAll("[data-entry-search]").forEach((field) => {
    field.addEventListener("input", () => {
      const kind = field.dataset.entrySearch;
      const value = field.value;
      listControls[kind].query = value;
      renderApp();
      const nextField = root.querySelector(`[data-entry-search="${cssEscape(kind)}"]`);
      nextField?.focus();
      nextField?.setSelectionRange(value.length, value.length);
    });
  });

  root.querySelectorAll("[data-entry-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.entrySort;
      listControls[kind].sort = nextSort(listControls[kind].sort);
      renderApp();
    });
  });

  root.querySelector('[data-action="toggle-keyboard"]')?.addEventListener("click", () => {
    keyboardOpen = !keyboardOpen;
    renderApp();
  });
  root.querySelector('[data-action="close-keyboard"]')?.addEventListener("click", () => {
    keyboardOpen = false;
    renderApp();
  });
  root.querySelectorAll("[data-function-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      const [rawIndex, kind] = button.dataset.functionKind.split(".");
      const index = Number(rawIndex);
      if (!FUNCTION_ENTRY_KINDS.has(kind) || !scene.functions[index]) return;
      const before = sceneSnapshot();
      const entry = normalizeFunctionEntry(scene.functions[index]);
      entry.kind = kind;
      scene.functions[index] = entry;
      recordSceneHistory(before);
      renderApp();
    });
  });
  root.querySelectorAll("[data-slider-value]").forEach((slider) => {
    slider.addEventListener("input", () => {
      const index = Number(slider.dataset.sliderValue);
      updateSliderValue(index, slider.value);
    });
    slider.addEventListener("pointerdown", (event) => {
      slider.setPointerCapture?.(event.pointerId);
      updateSliderFromPointer(slider, event);
    });
    slider.addEventListener("pointermove", (event) => {
      if (event.buttons !== 1) return;
      updateSliderFromPointer(slider, event);
    });
  });
  root.querySelector('[data-action="toggle-global-time"]')?.addEventListener("click", () => {
    toggleGlobalTimePlayback();
  });
  root.querySelectorAll("[data-time-play]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleTimePlayback(button.dataset.timePlay);
    });
  });
  root.querySelectorAll("[data-keyboard-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      keyboardTab = button.dataset.keyboardTab;
      renderApp();
    });
  });
  root.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => insertKeyboardValue(button.dataset.key));
  });

  root.querySelectorAll("[data-reference-filter]").forEach((field) => {
    field.addEventListener("input", () => {
      filterReferencePicker(field);
    });
  });

  root.querySelector('[data-action="render"]')?.addEventListener("click", () => {
    syncFields();
    triggerBoundaryOverlay();
    renderApp();
  });
  root.querySelector('[data-action="toggle-sidebar"]')?.addEventListener("click", () => {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem("lepton-sidebar-collapsed", String(sidebarCollapsed));
    renderApp();
  });
  root.querySelector('[data-action="apply-text"]')?.addEventListener("click", () => {
    const text = root.querySelector("[data-scene-text]")?.value ?? "";
    const before = sceneSnapshot();
    scene = importScene(text);
    viewport = sceneViewport();
    saveViewport();
    recordSceneHistory(before);
    renderApp();
  });
  root.querySelector('[data-action="refresh-text"]')?.addEventListener("click", () => {
    if (!confirmTextRefresh()) return;
    const field = root.querySelector("[data-scene-text]");
    if (field) field.value = exportScene();
    updateTextHighlight();
    triggerBoundaryOverlay();
  });
  root.querySelector("[data-scene-text]")?.addEventListener("input", () => {
    markUnsavedChange();
    updateTextHighlight();
  });
  root.querySelector("[data-scene-text]")?.addEventListener("scroll", () => syncTextHighlightScroll());
  root.querySelector("[data-aspect-ratio-preset]")?.addEventListener("change", (event) => {
    const before = sceneSnapshot();
    aspectRatioCustomOpen = event.target.value === "custom";
    if (!aspectRatioCustomOpen) scene.settings.aspectRatio = event.target.value;
    viewport = sceneViewport();
    if (isValidViewport(viewport)) saveViewport();
    recordSceneHistory(before);
    triggerBoundaryOverlay();
    renderApp();
  });
  root.querySelector("[data-background-mode]")?.addEventListener("change", (event) => {
    const before = sceneSnapshot();
    scene.settings.backgroundColor = event.target.value === "custom" ? scene.colors[0]?.id ?? "0" : "0";
    recordSceneHistory(before);
    renderApp();
  });
  root.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
    const before = sceneSnapshot();
    scene = structuredClone(DEFAULT_SCENE);
    viewport = loadViewport(true);
    recordSceneHistory(before);
    renderApp();
  });
  root.querySelector('[data-action="export"]')?.addEventListener("click", () => {
    window.prompt("Copy exported scene", exportScene());
  });
  root.querySelector('[data-action="import"]')?.addEventListener("click", () => {
    const raw = window.prompt("Paste exported scene");
    if (raw) {
      const before = sceneSnapshot();
      scene = importScene(raw);
      recordSceneHistory(before);
      renderApp();
    }
  });

  const MQ = window.MathQuill.getInterface(3);
  root.querySelectorAll(".mathquill-field[data-field]").forEach((el) => {
    const fieldName = el.dataset.field;
    const initialValue = el.dataset.value ?? "";

    const mathField = MQ.MathField(el, {
      autoCommands: "sqrt sum",
      autoOperatorNames: "sin cos tan ln log exp min max clamp round floor ceil abs sign sinh cosh tanh arcsin arccos arctan sec csc cot arccot arcsec arccsc sech csch coth arcsinh arccosh arctanh arcsech arccsch arccoth cbrt asin acos atan",
      handlers: {
        edit: () => {
          if (el.dataset.initializing === "true") return;
          const latex = mathField.latex();
          el.dataset.value = latex;

          const cleanExpr = latexToLeptonText(latex);
          requestAnimationFrame(() => keepHorizontalCaretVisible(el));

          const [collection, rawIndex, property] = fieldName.split(".");
          const index = Number(rawIndex);
          const before = sceneSnapshot();
          if (collection === "settings") {
            updateSettingValue(rawIndex, cleanExpr);
            viewport = sceneViewport();
            if (isValidViewport(viewport)) saveViewport();
            triggerBoundaryOverlay();
          } else if (collection === "functions" && property === "expression") {
            const assignment = parseAssignment(cleanExpr);
            if (assignment) {
              const entry = normalizeFunctionEntry(scene.functions[index]);
              entry.id = assignment.id;
              entry.expression = assignment.expression;
              scene.functions[index] = entry;
              const idInput = root.querySelector(`[data-field="functions.${index}.id"]`);
              if (idInput) idInput.value = assignment.id;
            } else {
              const entry = normalizeFunctionEntry(scene.functions[index]);
              entry.expression = cleanExpr;
              scene.functions[index] = entry;
            }
          } else if (collection === "functions") {
            const entry = normalizeFunctionEntry(scene.functions[index]);
            entry[property] = cleanExpr;
            scene.functions[index] = entry;
          } else {
            scene[collection][index][property] = cleanExpr;
          }
          recordSceneHistory(before);

          const diagnostics = validateScene();
          updateStatusLights(diagnostics);
          renderScene(diagnostics);
        }
      }
    });

    el.mathquillInstance = mathField;
    el.dataset.initializing = "true";
    mathField.latex(initialValue);
    delete el.dataset.initializing;
    el.__mathField = mathField;
  });

  root.querySelectorAll(".mathquill-field").forEach((field) => {
    field.addEventListener("focusin", () => activateKeyboardTarget(field));
    field.addEventListener("pointerdown", () => {
      activateKeyboardTarget(field);
      beginSelectionPointerScroll(field);
    });
    field.addEventListener("mousedown", () => {
      activateKeyboardTarget(field);
      beginSelectionPointerScroll(field);
    });
    field.addEventListener("keydown", (event) => {
      if (handleFieldHistoryKeydown(event)) {
        event.preventDefault();
        return;
      }
      if (event.key === "Enter" && field.dataset.field?.startsWith("functions.") && field.dataset.field?.endsWith(".expression")) {
        event.preventDefault();
        syncFields();
        const before = sceneSnapshot();
        const target = addEntry("functions");
        recordSceneHistory(before);
        pendingScrollTarget = target;
        renderApp();
        return;
      }
      requestAnimationFrame(() => keepHorizontalCaretVisible(field));
    });
    field.addEventListener("keyup", () => requestAnimationFrame(() => keepHorizontalCaretVisible(field)));
    field.addEventListener("mouseup", () => requestAnimationFrame(() => keepHorizontalCaretVisible(field)));
    field.addEventListener("pointermove", (event) => {
      if (event.buttons) {
        scrollFieldNearPointer(field, event);
      }
    });
    field.addEventListener("mousemove", (event) => {
      if (event.buttons) {
        scrollFieldNearPointer(field, event);
      }
    });
    field.addEventListener(
      "wheel",
      (event) => {
      if (scrollFieldHorizontally(field, event)) event.preventDefault();
      },
      { passive: false }
    );
  });

  root.querySelectorAll("input, textarea").forEach((field) => {
    field.addEventListener("focusin", () => activateKeyboardTarget(field));
    field.addEventListener("pointerdown", () => {
      activateKeyboardTarget(field);
      beginSelectionPointerScroll(field);
    });
    field.addEventListener("mousedown", () => {
      activateKeyboardTarget(field);
      beginSelectionPointerScroll(field);
    });
    field.addEventListener("input", () => keepTextInputCaretVisible(field));
    field.addEventListener("keyup", () => keepTextInputCaretVisible(field));
    field.addEventListener("mouseup", () => keepTextInputCaretVisible(field));
    field.addEventListener("pointermove", (event) => {
      if (event.buttons) {
        scrollFieldNearPointer(field, event);
        keepTextInputCaretVisible(field, event);
      }
    });
    field.addEventListener("mousemove", (event) => {
      if (event.buttons) {
        scrollFieldNearPointer(field, event);
        keepTextInputCaretVisible(field, event);
      }
    });
    field.addEventListener(
      "wheel",
      (event) => {
        if (scrollFieldHorizontally(field, event)) event.preventDefault();
      },
      { passive: false }
    );
  });

  root.querySelectorAll("input.entry-id[data-field]").forEach((field) => {
    field.addEventListener("input", () => {
      const before = sceneSnapshot();
      updateField(field);
      recordSceneHistory(before);
      const diagnostics = validateScene();
      updateStatusLights(diagnostics);
      renderScene(diagnostics);
    });
  });

  root.querySelectorAll("[data-field]").forEach((field) => {
    field.addEventListener("change", () => {
      const before = sceneSnapshot();
      updateField(field);
      recordSceneHistory(before);
      renderApp();
    });
  });

  root.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      const before = sceneSnapshot();
      const kind = button.dataset.add;
      if (listControls[kind]) {
        listControls[kind].query = "";
        listControls[kind].sort = "custom";
      }
      const target = addEntry(kind);
      recordSceneHistory(before);
      pendingScrollTarget = target;
      renderApp();
    });
  });

  root.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      const before = sceneSnapshot();
      deleteEntry(button.dataset.delete, Number(button.dataset.index));
      recordSceneHistory(before);
      renderApp();
    });
  });

  root.querySelectorAll("[data-toggle-draw]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      const before = sceneSnapshot();
      toggleDrawHidden(Number(button.dataset.toggleDraw));
      recordSceneHistory(before);
      renderApp();
    });
  });

  root.querySelectorAll("[data-draw-handle]").forEach((handle) => {
    handle.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", String(handle.dataset.drawHandle));
      event.dataTransfer?.setDragImage(handle, handle.offsetWidth / 2, handle.offsetHeight / 2);
    });
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      startDrawPointerDrag(Number(handle.dataset.drawHandle), event);
    });
  });

  root.querySelectorAll("[data-draw-index]").forEach((row) => {
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      row.classList.add("expression-row-drop-target");
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("expression-row-drop-target");
    });
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("expression-row-drop-target");
      const from = Number(event.dataTransfer?.getData("text/plain"));
      const to = Number(row.dataset.drawIndex);
      syncFields();
      const before = sceneSnapshot();
      moveDrawLayer(from, to);
      recordSceneHistory(before);
      renderApp();
    });
  });
}

function updateTextHighlight() {
  const field = root.querySelector("[data-scene-text]");
  const highlight = root.querySelector("[data-scene-highlight]");
  if (!field || !highlight) return;
  highlight.innerHTML = highlightLeptonText(field.value);
  syncTextHighlightScroll();
}

function syncTextHighlightScroll() {
  const field = root.querySelector("[data-scene-text]");
  const highlight = root.querySelector("[data-scene-highlight]");
  if (!field || !highlight) return;
  highlight.scrollTop = field.scrollTop;
  highlight.scrollLeft = field.scrollLeft;
}

function bindHelpTooltips() {
  root.querySelectorAll("[data-help]").forEach((target) => {
    const eventTarget = target.closest("button, label") ?? target;
    eventTarget.addEventListener("mouseenter", () => scheduleHelpTooltip(target));
    eventTarget.addEventListener("focusin", () => scheduleHelpTooltip(target));
    eventTarget.addEventListener("mouseleave", () => hideHelpTooltip(target));
    eventTarget.addEventListener("focusout", () => hideHelpTooltip(target));
  });
}

function confirmTextRefresh() {
  return window.confirm("Are you sure you want to refresh text? You will lose unsaved text edits in this text box.");
}

function scheduleHelpTooltip(target) {
  clearHelpTooltipTimer();
  activeHelpTarget = target;
  helpTooltipTimer = setTimeout(() => showHelpTooltip(target), 450);
}

function clearHelpTooltipTimer() {
  if (!helpTooltipTimer) return;
  clearTimeout(helpTooltipTimer);
  helpTooltipTimer = null;
}

function helpTooltipElement() {
  let tooltip = document.querySelector(".help-tooltip-layer");
  if (tooltip || !document.body) return tooltip;
  tooltip = document.createElement("div");
  tooltip.className = "help-tooltip-layer";
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  return tooltip;
}

function showHelpTooltip(target) {
  if (activeHelpTarget !== target) return;
  const text = target.dataset.help ?? "";
  if (!text.trim()) return;
  const tooltip = helpTooltipElement();
  if (!tooltip) return;
  tooltip.textContent = text;
  tooltip.hidden = false;
  tooltip.classList.add("is-visible");
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";

  const rect = target.getBoundingClientRect();
  const margin = 10;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
  const position = helpTooltipPosition(
    rect,
    { width: Math.min(tooltip.offsetWidth, viewportWidth - margin * 2), height: tooltip.offsetHeight },
    { width: viewportWidth, height: viewportHeight },
    margin
  );
  tooltip.style.left = `${position.left}px`;
  tooltip.style.top = `${position.top}px`;
}

function hideHelpTooltip(target = null) {
  if (target && activeHelpTarget !== target) return;
  clearHelpTooltipTimer();
  activeHelpTarget = null;
  const tooltip = document.querySelector(".help-tooltip-layer");
  if (!tooltip) return;
  tooltip.classList.remove("is-visible");
  tooltip.hidden = true;
}

function helpTooltipPosition(targetRect, tooltipSize, viewportSize, margin = 10) {
  const width = Math.min(tooltipSize.width, viewportSize.width - margin * 2);
  const height = tooltipSize.height;
  const left = clampNumber(
    targetRect.left + targetRect.width / 2 - width / 2,
    margin,
    Math.max(margin, viewportSize.width - width - margin)
  );
  let top = targetRect.top - height - 9;
  if (top < margin) {
    top = targetRect.bottom + 9;
  }
  top = clampNumber(top, margin, Math.max(margin, viewportSize.height - height - margin));
  return { left, top };
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function filterReferencePicker(field) {
  const picker = field.closest(".reference-picker");
  const select = picker?.querySelector("select[data-field]");
  if (!select) return;
  const query = field.value.trim().toLowerCase();
  let firstVisible = null;
  for (const option of select.options) {
    const visible = !query || option.value.toLowerCase().includes(query);
    option.hidden = !visible;
    option.disabled = !visible;
    if (visible && !firstVisible) firstVisible = option;
  }
  if (query) {
    const exact = Array.from(select.options).find((option) => option.value.toLowerCase() === query);
    if (exact) {
      select.value = exact.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } else {
    for (const option of select.options) {
      option.hidden = false;
      option.disabled = false;
    }
  }
}

function handleFieldHistoryKeydown(event) {
  const key = event.key.toLowerCase();
  if (!(event.metaKey || event.ctrlKey)) return false;
  if (key !== "z" && key !== "y") return false;
  const direction = key === "y" || event.shiftKey ? "redo" : "undo";
  return restoreSceneHistory(direction);
}

function startDrawPointerDrag(from, event) {
  if (!Number.isInteger(from)) return;
  let targetRow = null;

  const clearTarget = () => {
    targetRow?.classList.remove("expression-row-drop-target");
    targetRow = null;
  };

  const onMove = (moveEvent) => {
    const row = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest?.("[data-draw-index]");
    if (row === targetRow) return;
    clearTarget();
    if (row) {
      targetRow = row;
      targetRow.classList.add("expression-row-drop-target");
    }
  };

  const onUp = (upEvent) => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    const row = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest?.("[data-draw-index]") ?? targetRow;
    const to = Number(row?.dataset.drawIndex);
    clearTarget();
    syncFields();
    const before = sceneSnapshot();
    moveDrawLayer(from, to);
    recordSceneHistory(before);
    renderApp();
  };

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

function bindSidebarResize() {
  const resizer = root.querySelector(".sidebar-resizer");
  if (!resizer) return;

  const onMove = (event) => {
    sidebarWidth = Math.max(220, Math.min(Math.max(360, window.innerWidth - 260), event.clientX));
    localStorage.setItem("lepton-sidebar-width", String(sidebarWidth));
    root.querySelector(".app-shell")?.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
    renderScene(validateScene());
  };

  const onUp = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
  };

  resizer.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });
}

function bindCanvasPan() {
  const pane = root.querySelector(".renderer-pane");
  const canvas = root.querySelector(".grid-canvas");
  if (!pane || !canvas) return;

  let drag = null;
  pane.addEventListener("pointerdown", (event) => {
    if (event.target !== canvas) return;
    event.preventDefault();
    pane.setPointerCapture(event.pointerId);
    drag = {
      x: event.clientX,
      y: event.clientY,
      start: { ...viewport }
    };
    pane.classList.add("is-panning");
  });

  pane.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const startViewport = displayViewportForSize(drag.start, rect.width, rect.height);
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const unitsX = (startViewport.xMax - startViewport.xMin) * (dx / Math.max(1, rect.width));
    const unitsY = (startViewport.yMax - startViewport.yMin) * (dy / Math.max(1, rect.height));
    viewport = {
      xMin: drag.start.xMin - unitsX,
      xMax: drag.start.xMax - unitsX,
      yMin: drag.start.yMin + unitsY,
      yMax: drag.start.yMax + unitsY
    };
    saveViewport();
    schedulePanRender();
  });

  const stopPan = (event) => {
    if (!drag) return;
    pane.releasePointerCapture?.(event.pointerId);
    pane.classList.remove("is-panning");
    drag = null;
  };
  pane.addEventListener("pointerup", stopPan);
  pane.addEventListener("pointercancel", stopPan);
  pane.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const visibleViewport = displayViewportForSize(viewport, rect.width, rect.height);
      const xRatio = (event.clientX - rect.left) / Math.max(1, rect.width);
      const yRatio = 1 - (event.clientY - rect.top) / Math.max(1, rect.height);
      const width = visibleViewport.xMax - visibleViewport.xMin;
      const height = visibleViewport.yMax - visibleViewport.yMin;
      const centerX = visibleViewport.xMin + width * xRatio;
      const centerY = visibleViewport.yMin + height * yRatio;
      const zoom = Math.max(0.2, Math.min(5, Math.exp(event.deltaY * 0.001)));
      viewport = {
        xMin: centerX - (centerX - visibleViewport.xMin) * zoom,
        xMax: centerX + (visibleViewport.xMax - centerX) * zoom,
        yMin: centerY - (centerY - visibleViewport.yMin) * zoom,
        yMax: centerY + (visibleViewport.yMax - centerY) * zoom
      };
      saveViewport();
      schedulePanRender();
    },
    { passive: false }
  );
}

function schedulePanRender() {
  if (panRenderFrame) return;
  panRenderFrame = requestAnimationFrame(() => {
    panRenderFrame = 0;
    renderScene(validateScene());
  });
}

function updateSettingValue(key, value) {
  if (["ensureSquareGrid", "drawOnlyInsideBoundary"].includes(key)) {
    scene.settings[key] = Boolean(value);
    return;
  }
  if (key === "aspectRatioLeft" || key === "aspectRatioRight") {
    const [left, right] = aspectRatioParts();
    const nextLeft = key === "aspectRatioLeft" ? String(value ?? "").trim() : left;
    const nextRight = key === "aspectRatioRight" ? String(value ?? "").trim() : right;
    scene.settings.aspectRatio = `${nextLeft || "1"}:${nextRight || "1"}`;
    aspectRatioCustomOpen = true;
    return;
  }
  if (key === "angleMode") {
    scene.settings.angleMode = normalizeAngleMode(value);
    return;
  }
  if (key === "backgroundColor") {
    scene.settings.backgroundColor = String(value ?? "").trim() || "0";
    return;
  }
  if (key === "aspectRatio") {
    scene.settings.aspectRatio = String(value ?? "").trim() || "1:1";
    aspectRatioCustomOpen = true;
    return;
  }
  if (["maxRecursion", "unboundedDecimalPlaces", "unboundedIntegerDigits"].includes(key)) {
    const number = Number(value);
    if (Number.isFinite(number)) scene.settings[key] = number;
    return;
  }
  scene.settings[key] = String(value ?? "").trim();
}

function updateField(field) {
  const [collection, rawIndex, property] = field.dataset.field.split(".");
  let value = readFieldValue(field);
  if (property === "id") value = value.trim();

  if (collection === "settings") {
    updateSettingValue(rawIndex, value);
    if (["xMin", "xMax", "yMin", "yMax", "ensureSquareGrid", "aspectRatio", "aspectRatioLeft", "aspectRatioRight", "drawOnlyInsideBoundary"].includes(rawIndex)) {
      viewport = sceneViewport();
      if (isValidViewport(viewport)) saveViewport();
      triggerBoundaryOverlay();
    }
    return;
  }

  if (collection === "functions" && property === "expression") {
    const assignment = parseAssignment(value);
    if (assignment) {
      const entry = normalizeFunctionEntry(scene.functions[Number(rawIndex)]);
      entry.id = assignment.id;
      entry.expression = assignment.expression;
      scene.functions[Number(rawIndex)] = entry;
      return;
    }
  }

  if (collection === "functions") {
    const entry = normalizeFunctionEntry(scene.functions[Number(rawIndex)]);
    entry[property] = property === "params" ? parseFunctionParams(value) : value;
    scene.functions[Number(rawIndex)] = entry;
  } else {
    scene[collection][Number(rawIndex)][property] = value;
  }
  if (field.classList?.contains("mathquill-field")) {
    field.dataset.value = latexSourceFromExpression(value);
  }
}

function parseFunctionParams(value) {
  return String(value ?? "")
    .split(",")
    .map((param) => param.trim())
    .filter(Boolean);
}

function updateSliderFromPointer(slider, event) {
  const rect = slider.getBoundingClientRect();
  const min = Number(slider.min);
  const max = Number(slider.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || rect.width <= 0) return;
  const ratio = clampNumber((event.clientX - rect.left) / rect.width, 0, 1);
  const value = min + ratio * (max - min);
  slider.value = String(value);
  updateSliderValue(Number(slider.dataset.sliderValue), slider.value);
}

function updateSliderValue(index, value) {
  setSliderExpression(index, value, true);
  refreshAfterSliderChange();
}

function setSliderExpression(index, value, syncField = false) {
  if (!scene.functions[index]) return;
  const entry = normalizeFunctionEntry(scene.functions[index]);
  entry.expression = formatSliderValue(value, entry);
  scene.functions[index] = entry;
  markUnsavedChange();
  if (!syncField) return;
  const valueField = root.querySelector(`[data-field="functions.${index}.expression"]`);
  if (valueField) {
    valueField.dataset.value = latexSourceFromExpression(entry.expression);
    const mathField = valueField.mathquillInstance;
    if (mathField) mathField.latex(valueField.dataset.value);
  }
  const rangeField = root.querySelector(`[data-slider-value="${index}"]`);
  if (rangeField) rangeField.value = String(value);
}

function refreshAfterSliderChange() {
  const diagnostics = validateScene();
  updateStatusLights(diagnostics);
  renderScene(diagnostics);
}

function timeVariableEntries() {
  return scene.functions
    .map((entry, index) => ({ entry: normalizeFunctionEntry(entry), index }))
    .filter(({ entry }) => entry.kind === "slider" && entry.time && entry.id);
}

function prunePlayingTimeIds() {
  const ids = new Set(timeVariableEntries().map(({ entry }) => entry.id));
  for (const id of [...playingTimeIds]) {
    if (!ids.has(id)) playingTimeIds.delete(id);
  }
  for (const id of [...timeVariableDirections.keys()]) {
    if (!ids.has(id)) timeVariableDirections.delete(id);
  }
  if (!playingTimeIds.size) stopAnimationLoop();
}

function toggleGlobalTimePlayback() {
  syncFields();
  const entries = timeVariableEntries();
  if (!entries.length) return;
  const allPlaying = entries.every(({ entry }) => playingTimeIds.has(entry.id));
  if (allPlaying || playingTimeIds.size) {
    playingTimeIds.clear();
    timeVariableDirections.clear();
    stopAnimationLoop();
  } else {
    entries.forEach(({ entry }) => {
      playingTimeIds.add(entry.id);
      if (!timeVariableDirections.has(entry.id)) timeVariableDirections.set(entry.id, 1);
    });
    startAnimationLoop();
  }
  renderApp();
}

function toggleTimePlayback(id) {
  syncFields();
  const cleanId = String(id ?? "");
  if (!cleanId) return;
  if (playingTimeIds.has(cleanId)) {
    playingTimeIds.delete(cleanId);
    timeVariableDirections.delete(cleanId);
  } else {
    const exists = timeVariableEntries().some(({ entry }) => entry.id === cleanId);
    if (exists) {
      playingTimeIds.add(cleanId);
      if (!timeVariableDirections.has(cleanId)) timeVariableDirections.set(cleanId, 1);
    }
  }
  if (playingTimeIds.size) startAnimationLoop();
  else stopAnimationLoop();
  renderApp();
}

function startAnimationLoop() {
  if (animationFrameId) return;
  animationLastTimestamp = 0;
  animationFrameId = requestAnimationFrame(stepTimeAnimation);
}

function stopAnimationLoop() {
  if (!animationFrameId) return;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
  animationLastTimestamp = 0;
}

function stepTimeAnimation(timestamp) {
  animationFrameId = 0;
  if (!playingTimeIds.size) {
    animationLastTimestamp = 0;
    return;
  }
  const deltaSeconds = animationLastTimestamp ? Math.min(0.1, (timestamp - animationLastTimestamp) / 1000) : 0;
  animationLastTimestamp = timestamp;
  if (deltaSeconds > 0) {
    advanceTimeVariables(deltaSeconds);
    refreshAfterSliderChange();
  }
  animationFrameId = requestAnimationFrame(stepTimeAnimation);
}

function advanceTimeVariables(deltaSeconds) {
  const entries = timeVariableEntries();
  for (const { entry, index } of entries) {
    if (!playingTimeIds.has(entry.id)) continue;
    const current = evaluateScalarSetting(entry.expression);
    const min = evaluateScalarSetting(entry.sliderMin);
    const max = evaluateScalarSetting(entry.sliderMax);
    const mode = normalizeTimeMode(entry.timeMode);
    const base = Number.isFinite(current) ? current : Number.isFinite(min) ? min : 0;
    let next = base + deltaSeconds * TIME_VARIABLE_RATE;
    if (mode !== "unbounded" && Number.isFinite(min) && Number.isFinite(max) && max > min) {
      if (mode === "bounded_looped") {
        const span = max - min;
        next = min + positiveModulo(next - min, span);
      } else {
        const direction = timeVariableDirections.get(entry.id) ?? 1;
        const reflected = reflectBoundedTimeValue(base + direction * deltaSeconds * TIME_VARIABLE_RATE, min, max, direction);
        next = reflected.value;
        timeVariableDirections.set(entry.id, reflected.direction);
      }
    }
    setSliderExpression(index, next, activeTab === "functions" && displayMode === "standard");
  }
  prunePlayingTimeIds();
}

function reflectBoundedTimeValue(value, min, max, direction = 1) {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return { value: min, direction: 1 };
  const currentDirection = direction < 0 ? -1 : 1;
  if (value >= min && value <= max) return { value, direction: currentDirection };
  const cycle = span * 2;
  const distance = currentDirection > 0 ? value - min : max - value;
  const offset = positiveModulo(distance, cycle);
  if (currentDirection > 0) {
    if (offset <= span) return { value: min + offset, direction: 1 };
    return { value: max - (offset - span), direction: -1 };
  }
  if (offset <= span) return { value: max - offset, direction: -1 };
  return { value: min + (offset - span), direction: 1 };
}

function positiveModulo(value, modulus) {
  if (!Number.isFinite(value) || !Number.isFinite(modulus) || modulus <= 0) return 0;
  return ((value % modulus) + modulus) % modulus;
}

function readFieldValue(field) {
  if (field.type === "checkbox") return field.checked;
  if (field.classList?.contains("mathquill-field") || field.classList?.contains("mq-editable-field")) {
    return latexToLeptonText(field.dataset.value ?? "");
  }
  return stripChannelPrefix(field.value);
}

function syncFields() {
  root.querySelectorAll("[data-field]").forEach((field) => updateField(field));
}

function resolveFunctionEntry(id) {
  const entry = scene.functions.find((item) => item.id === id);
  return entry ? normalizeFunctionEntry(entry) : (id === DEFAULT_DRAW_FUNCTION.id ? DEFAULT_DRAW_FUNCTION : null);
}

function resolveColorEntry(id) {
  return scene.colors.find((entry) => entry.id === id) ??
    (id === DEFAULT_DRAW_COLOR.id || LEGACY_DEFAULT_COLOR_IDS.has(id) ? DEFAULT_DRAW_COLOR : null);
}

function resolveBoundaryEntry(id) {
  return scene.restrictions.find((entry) => entry.id === id) ??
    (id === DEFAULT_DRAW_BOUNDARY.id || LEGACY_DEFAULT_BOUNDARY_IDS.has(id) ? DEFAULT_DRAW_BOUNDARY : null);
}

function drawFunctionEntries() {
  return scene.functions.length ? scene.functions.map(normalizeFunctionEntry) : [DEFAULT_DRAW_FUNCTION];
}

function drawColorEntries() {
  return scene.colors.some((entry) => entry.id === DEFAULT_DRAW_COLOR.id)
    ? scene.colors
    : [DEFAULT_DRAW_COLOR, ...scene.colors];
}

function drawBoundaryEntries() {
  return scene.restrictions.some((entry) => entry.id === DEFAULT_DRAW_BOUNDARY.id)
    ? scene.restrictions
    : [DEFAULT_DRAW_BOUNDARY, ...scene.restrictions];
}

function sceneFunctionEnv(includeDefault = false) {
  const entries = scene.functions.map((entry) => {
    const normalized = normalizeFunctionEntry(entry);
    return [normalized.id, normalized];
  });
  if (includeDefault && !scene.functions.some((entry) => entry.id === DEFAULT_DRAW_FUNCTION.id)) {
    entries.push([DEFAULT_DRAW_FUNCTION.id, DEFAULT_DRAW_FUNCTION]);
  }
  return Object.fromEntries(entries);
}

function addEntry(kind) {
  if (kind === "functions") {
    scene.functions.push({ id: `f${scene.functions.length + 1}`, kind: "variable", expression: "" });
    return { kind, index: scene.functions.length - 1 };
  }
  if (kind === "colors") {
    scene.colors.push({ id: `c${scene.colors.length + 1}`, red: scene.functions[0]?.id ?? "", green: scene.functions[0]?.id ?? "", blue: scene.functions[0]?.id ?? "" });
    return { kind, index: scene.colors.length - 1 };
  }
  if (kind === "restrictions") {
    scene.restrictions.push({ id: `r${scene.restrictions.length + 1}`, expression: scene.functions[0]?.id ?? "", checkSmaller: false });
    return { kind, index: scene.restrictions.length - 1 };
  }
  if (kind === "draws") {
    scene.draws.push({
      equationId: drawFunctionEntries()[0]?.id ?? "",
      colorId: drawColorEntries()[0]?.id ?? "",
      restrictionId: drawBoundaryEntries()[0]?.id ?? "",
      hidden: false
    });
    return { kind, index: scene.draws.length - 1 };
  }
  return null;
}

function toggleDrawHidden(index) {
  if (!scene.draws[index]) return;
  scene.draws[index].hidden = !scene.draws[index].hidden;
}

function moveDrawLayer(from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return;
  if (from < 0 || from >= scene.draws.length || to < 0 || to >= scene.draws.length || from === to) return;
  const [entry] = scene.draws.splice(from, 1);
  scene.draws.splice(to, 0, entry);
}

function deleteEntry(kind, index) {
  if (!Array.isArray(scene[kind]) || !scene[kind][index]) return;
  const removed = scene[kind][index];
  scene[kind].splice(index, 1);
  if (kind === "functions") {
    const replacement = scene.functions[0]?.id ?? "";
    scene.draws.forEach((draw) => {
      if (draw.equationId === removed.id) draw.equationId = replacement;
    });
    scene.colors.forEach((color) => {
      if (color.red === removed.id) color.red = replacement;
      if (color.green === removed.id) color.green = replacement;
      if (color.blue === removed.id) color.blue = replacement;
    });
    scene.restrictions.forEach((restriction) => {
      if (restriction.expression === removed.id) restriction.expression = replacement;
    });
  }
  if (kind === "colors") {
    const replacement = scene.colors[0]?.id ?? "";
    scene.draws.forEach((draw) => {
      if (draw.colorId === removed.id) draw.colorId = replacement;
    });
    if (scene.settings.backgroundColor === removed.id) {
      scene.settings.backgroundColor = replacement || "0";
    }
  }
  if (kind === "restrictions") {
    const replacement = scene.restrictions[0]?.id ?? "";
    scene.draws.forEach((draw) => {
      if (draw.restrictionId === removed.id) draw.restrictionId = replacement;
    });
  }
}

function renderScene(diagnostics = validateScene()) {
  try {
    window.__leptonRenderHit = (window.__leptonRenderHit ?? 0) + 1;
    const canvas = root.querySelector(".grid-canvas");
    if (!canvas) return;
    const viewportIssue = diagnostics.settings?.find((item) => item.status === "invalid");
    if (viewportIssue) {
      drawErrorState(canvas, viewportIssue.message);
      return;
    }

    if (renderSceneWebGl(canvas)) {
      return;
    }

    renderSceneCpu(canvas);
  } catch (error) {
    window.__leptonRuntimeError = error.message;
    const overlay = root.querySelector(".render-overlay");
    if (overlay) {
      overlay.textContent = `Render error: ${error.message}`;
    }
  }
}

function drawErrorState(canvas, message) {
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (gl) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.98, 0.94, 0.94, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  } else {
    drawErrorCanvas(canvas, message);
  }

  const overlay = root.querySelector(".render-overlay");
  if (overlay) {
    overlay.textContent = `Expression error: ${message}`;
  }
}

function renderSceneCpu(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const backgroundColor = resolveBackgroundColor();
  drawGrid(ctx, rect.width, rect.height, backgroundColor.custom ? backgroundColor.rgb : null);

  const env = buildRuntimeEnv(sceneFunctionEnv(true));
  const visibleViewport = displayViewportForSize(viewport, rect.width, rect.height);
  updateBoundaryOverlay(canvas, visibleViewport);
  const clipViewport = scene.settings.drawOnlyInsideBoundary ? sceneViewport() : null;
  const shouldClip = clipViewport && isValidViewport(clipViewport);
  const xPoints = axis(visibleViewport.xMin, visibleViewport.xMax, scene.settings.xPoints);
  const yPoints = axis(visibleViewport.yMin, visibleViewport.yMax, scene.settings.yPoints);
  const pixelWidth = rect.width / Math.max(1, xPoints.length - 1);
  const pixelHeight = rect.height / Math.max(1, yPoints.length - 1);

  for (const draw of scene.draws) {
    if (draw.hidden) continue;
    const fn = resolveFunctionEntry(draw.equationId);
    const color = resolveColorEntry(draw.colorId);
    const restriction = resolveBoundaryEntry(draw.restrictionId);
    if (!fn || !color || !restriction) continue;

    let evaluate;
    let red;
    let green;
    let blue;
    let boundary;
    try {
      evaluate = compileExpression(fn.expression, fn.kind === "function" ? new Set(fn.params) : new Set());
      red = compileExpression(color.red);
      green = compileExpression(color.green);
      blue = compileExpression(color.blue);
      boundary = compileExpression(restriction.expression);
    } catch {
      continue;
    }

    for (let yi = 0; yi < yPoints.length; yi += 1) {
      for (let xi = 0; xi < xPoints.length; xi += 1) {
        const x = xPoints[xi];
        const y = yPoints[yi];
        if (shouldClip && (x < clipViewport.xMin || x > clipViewport.xMax || y < clipViewport.yMin || y > clipViewport.yMax)) continue;
        const previousLocals = env.__locals;
        if (fn.kind === "function") {
          env.__locals = Object.fromEntries(fn.params.map((param) => [param, param === "x" ? x : param === "y" ? y : 0]));
        }
        const boundaryValue = boundary(x, y, env);
        if (fn.kind === "function") env.__locals = previousLocals;
        if (!Number.isFinite(boundaryValue)) continue;
        if (restriction.checkSmaller ? boundaryValue > 0 : boundaryValue < 0) continue;

        if (fn.kind === "function") {
          env.__locals = Object.fromEntries(fn.params.map((param) => [param, param === "x" ? x : param === "y" ? y : 0]));
        }
        const z = evaluate(x, y, env);
        if (fn.kind === "function") env.__locals = previousLocals;
        if (!Number.isFinite(z)) continue;

        ctx.fillStyle = `rgb(${channel(red(z, 0, env))}, ${channel(green(z, 0, env))}, ${channel(blue(z, 0, env))})`;
        ctx.fillRect(xi * pixelWidth, rect.height - (yi + 1) * pixelHeight, Math.ceil(pixelWidth), Math.ceil(pixelHeight));
      }
    }
  }
}

function renderSceneWebGl(canvas) {
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) return false;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const visibleViewport = displayViewportForSize(viewport, rect.width, rect.height);
  updateBoundaryOverlay(canvas, visibleViewport);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const fragmentSource = buildFragmentShader();
  window.__leptonFragmentSource = fragmentSource;
  const vertexSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const program = createProgram(gl, vertexSource, fragmentSource);
  if (!program) {
    window.__leptonGlError = gl.getError();
    gl.clearColor(0.98, 0.94, 0.94, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return true;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(program);

  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), canvas.width, canvas.height);
  gl.uniform4f(
    gl.getUniformLocation(program, "u_bounds"),
    visibleViewport.xMin,
    visibleViewport.xMax,
    visibleViewport.yMin,
    visibleViewport.yMax
  );
  const clipViewport = sceneViewport();
  const clipEnabled = scene.settings.drawOnlyInsideBoundary && isValidViewport(clipViewport);
  const safeClipViewport = clipEnabled ? clipViewport : visibleViewport;
  gl.uniform1i(gl.getUniformLocation(program, "u_clip_enabled"), clipEnabled ? 1 : 0);
  gl.uniform4f(
    gl.getUniformLocation(program, "u_clip_bounds"),
    safeClipViewport.xMin,
    safeClipViewport.xMax,
    safeClipViewport.yMin,
    safeClipViewport.yMax
  );
  const backgroundColor = resolveBackgroundColor();
  gl.clearColor(backgroundColor.rgb[0] / 255, backgroundColor.rgb[1] / 255, backgroundColor.rgb[2] / 255, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  return true;
}

function resolveBackgroundColor() {
  const fallback = { custom: false, rgb: [247, 250, 252] };
  const id = scene.settings.backgroundColor ?? "0";
  if (id === "0") return fallback;
  const color = scene.colors.find((entry) => entry.id === id);
  if (!color) return fallback;
  try {
    const env = buildRuntimeEnv(sceneFunctionEnv());
    const red = compileExpression(color.red)(0, 0, env);
    const green = compileExpression(color.green)(0, 0, env);
    const blue = compileExpression(color.blue)(0, 0, env);
    return { custom: true, rgb: [channel(red), channel(green), channel(blue)] };
  } catch {
    return fallback;
  }
}

function backgroundColorGlsl() {
  const color = resolveBackgroundColor().rgb.map((value) => (value / 255).toFixed(6));
  return `vec3(${color.join(", ")})`;
}

function buildFragmentShader() {
  if (window.__leptonForceGradient) {
    return `
      precision highp float;
      uniform vec2 u_resolution;
      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        gl_FragColor = vec4(uv.x, uv.y, 0.65, 1.0);
      }
    `;
  }

  const env = sceneFunctionEnv(true);
  const layers = scene.draws
    .map((draw) => {
      if (draw?.hidden) return null;
      const fn = resolveFunctionEntry(draw?.equationId);
      const color = resolveColorEntry(draw?.colorId);
      const restriction = resolveBoundaryEntry(draw?.restrictionId);
      if (!fn || !color || !restriction) return null;
      if (
        validateExpression(fn.expression, env, [fn.id], fn.kind === "function" ? new Set(fn.params) : new Set()).status === "invalid" ||
        validateExpression(color.red, env).status === "invalid" ||
        validateExpression(color.green, env).status === "invalid" ||
        validateExpression(color.blue, env).status === "invalid" ||
        validateExpression(restriction.expression, env).status === "invalid"
      ) {
        return null;
      }
      try {
        return {
          expr: expressionToGlsl(fn.expression, env, null, [], scene.settings.angleMode, fn.kind === "function" ? defaultParamGlslMap(fn.params) : {}),
          red: expressionToGlsl(color.red, env, "z", [], scene.settings.angleMode),
          green: expressionToGlsl(color.green, env, "z", [], scene.settings.angleMode),
          blue: expressionToGlsl(color.blue, env, "z", [], scene.settings.angleMode),
          bound: expressionToGlsl(restriction.expression, env, null, [], scene.settings.angleMode),
          boundCheck: restriction.checkSmaller ? "boundValue <= 0.0" : "boundValue >= 0.0"
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const layerShader = layers.length
    ? layers
        .map(
          (layer, index) => `
      {
        float boundValue = ${layer.bound};
        if (${layer.boundCheck}) {
          float z = ${layer.expr};
          color = clamp(vec3(${layer.red}, ${layer.green}, ${layer.blue}) / 255.0, 0.0, 1.0);
          painted = true;
        }
      }`
        )
        .join("\n")
    : "";
  const backgroundColor = backgroundColorGlsl();

  return `
      precision highp float;
      uniform vec2 u_resolution;
      uniform vec4 u_bounds;
      uniform vec4 u_clip_bounds;
      uniform bool u_clip_enabled;

    float frac(float a, float b) { return b == 0.0 ? 0.0 : a / b; }
    float ln(float value) { return value > 0.0 ? log(value) : 0.0; }
    float sec(float value) { return 1.0 / cos(value); }
    float csc(float value) { return 1.0 / sin(value); }
    float cot(float value) { return 1.0 / tan(value); }
    float arccot(float value) { return 1.5707963267948966 - atan(value); }
    float arcsec(float value) { return acos(1.0 / value); }
    float arccsc(float value) { return asin(1.0 / value); }
    float cbrt(float value) { return sign(value) * pow(abs(value), 1.0 / 3.0); }
    float sinh1(float value) { return (exp(value) - exp(-value)) / 2.0; }
    float cosh1(float value) { return (exp(value) + exp(-value)) / 2.0; }
    float tanh1(float value) { float p = exp(2.0 * value); return (p - 1.0) / (p + 1.0); }
    float sech(float value) { return 1.0 / cosh1(value); }
    float csch(float value) { return 1.0 / sinh1(value); }
    float coth(float value) { return 1.0 / tanh1(value); }
    float arcsinh(float value) { return log(value + sqrt(value * value + 1.0)); }
    float arccosh(float value) { return log(value + sqrt(value - 1.0) * sqrt(value + 1.0)); }
    float arctanh(float value) { return 0.5 * log((1.0 + value) / (1.0 - value)); }
    float arcsech(float value) { return arccosh(1.0 / value); }
    float arccsch(float value) { return arcsinh(1.0 / value); }
    float arccoth(float value) { return arctanh(1.0 / value); }
    float round1(float value) { return floor(value + 0.5); }
    float clamp3(float value, float low, float high) { return clamp(value, low, high); }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float x = mix(u_bounds.x, u_bounds.y, uv.x);
      float y = mix(u_bounds.z, u_bounds.w, uv.y);
      vec3 color = ${backgroundColor};
      bool painted = false;
      if (u_clip_enabled && (x < u_clip_bounds.x || x > u_clip_bounds.y || y < u_clip_bounds.z || y > u_clip_bounds.w)) {
        gl_FragColor = vec4(color, 1.0);
        return;
      }
      ${layerShader}
      gl_FragColor = vec4(color, 1.0);
    }
  `;
}

function drawGrid(ctx, width, height, solidBackground = null) {
  ctx.fillStyle = solidBackground ? `rgb(${solidBackground.join(", ")})` : "#f8fafc";
  ctx.fillRect(0, 0, width, height);
  if (solidBackground) return;
  ctx.strokeStyle = "#e1e5ec";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#7a8493";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function displayViewportForSize(baseViewport, width, height) {
  if (!isValidViewport(baseViewport)) {
    baseViewport = {
      xMin: Number(DEFAULT_SCENE.settings.xMin),
      xMax: Number(DEFAULT_SCENE.settings.xMax),
      yMin: Number(DEFAULT_SCENE.settings.yMin),
      yMax: Number(DEFAULT_SCENE.settings.yMax)
    };
  }
  if (scene.settings.ensureSquareGrid === false) {
    return { ...baseViewport };
  }
  const targetAspect = Math.max(1, width) / Math.max(1, height);
  const xRange = baseViewport.xMax - baseViewport.xMin;
  const yRange = baseViewport.yMax - baseViewport.yMin;
  const currentAspect = xRange / Math.max(Number.EPSILON, yRange);
  const centerX = (baseViewport.xMin + baseViewport.xMax) / 2;
  const centerY = (baseViewport.yMin + baseViewport.yMax) / 2;

  if (currentAspect < targetAspect) {
    const adjustedX = yRange * targetAspect;
    return {
      xMin: centerX - adjustedX / 2,
      xMax: centerX + adjustedX / 2,
      yMin: baseViewport.yMin,
      yMax: baseViewport.yMax
    };
  }

  const adjustedY = xRange / targetAspect;
  return {
    xMin: baseViewport.xMin,
    xMax: baseViewport.xMax,
    yMin: centerY - adjustedY / 2,
    yMax: centerY + adjustedY / 2
  };
}

function updateBoundaryOverlay(canvas = root.querySelector(".grid-canvas"), visibleViewport = null) {
  const overlay = root.querySelector(".grid-boundary-overlay");
  if (!overlay || !canvas) return;
  if (Date.now() > boundaryPulseUntil) {
    overlay.classList.remove("active");
    return;
  }

  const rect = canvas.getBoundingClientRect();
  visibleViewport ??= displayViewportForSize(viewport, rect.width, rect.height);
  let boundary = sceneViewport();
  if (!isValidViewport(boundary)) {
    boundary = {
      xMin: Number(DEFAULT_SCENE.settings.xMin),
      xMax: Number(DEFAULT_SCENE.settings.xMax),
      yMin: Number(DEFAULT_SCENE.settings.yMin),
      yMax: Number(DEFAULT_SCENE.settings.yMax)
    };
  }

  const visibleX = visibleViewport.xMax - visibleViewport.xMin;
  const visibleY = visibleViewport.yMax - visibleViewport.yMin;
  const left = ((boundary.xMin - visibleViewport.xMin) / visibleX) * rect.width;
  const right = ((boundary.xMax - visibleViewport.xMin) / visibleX) * rect.width;
  const top = ((visibleViewport.yMax - boundary.yMax) / visibleY) * rect.height;
  const bottom = ((visibleViewport.yMax - boundary.yMin) / visibleY) * rect.height;
  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;
  overlay.style.width = `${right - left}px`;
  overlay.style.height = `${bottom - top}px`;
  overlay.classList.add("active");
}

function triggerBoundaryOverlay() {
  boundaryPulseUntil = Date.now() + 2600;
  window.clearTimeout(boundaryPulseTimer);
  boundaryPulseTimer = window.setTimeout(() => updateBoundaryOverlay(), 2600);
}

function drawErrorCanvas(canvas, message) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, rect.width, rect.height);
  drawGrid(ctx, rect.width, rect.height);
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.strokeStyle = "#e4a4a0";
  ctx.lineWidth = 1;
  ctx.fillRect(24, 24, Math.min(520, rect.width - 48), 92);
  ctx.strokeRect(24, 24, Math.min(520, rect.width - 48), 92);
  ctx.fillStyle = "#9f2f2a";
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText("Expression error", 42, 58);
  ctx.fillStyle = "#5c6675";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(message, 42, 84);
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    window.__leptonShaderLog = gl.getProgramInfoLog(program);
    console.warn(window.__leptonShaderLog);
    return null;
  }

  return program;
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    window.__leptonShaderLog = gl.getShaderInfoLog(shader);
    console.warn(window.__leptonShaderLog);
    return null;
  }

  return shader;
}

function axis(min, max, count) {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

function compileExpression(source, localNames = new Set()) {
  let js = normalizeMathSyntax(normalizeExpressionText(source));
  js = rewriteCustomFunctionCalls(js, sceneFunctionEnv(true), (entry, args) => {
    if (args.length !== entry.params.length) {
      throw new Error(`Function ${entry.id} expects ${entry.params.length} input${entry.params.length === 1 ? "" : "s"}`);
    }
    return `call("${entry.id}", [${args.join(",")}], x, y)`;
  });
  js = convertPowers(js)
    .replaceAll(/~([A-Za-z]\w*)~/g, 'ref("$1", x, y)')
    .replaceAll(/\bpi\b/g, "Math.PI")
    .replaceAll(/\be\b/g, "Math.E")
    .replaceAll(/\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|abs|sign|floor|ceil|round|min|max|exp|log|pow)\b/g, "Math.$1")
    .replaceAll(/\barc(sin|cos|tan)\b/g, "Math.a$1");

  js = rewriteBareIdentifiers(
    js,
    (name) => localNames.has(name) ? `local("${name}")` : `ref("${name}", x, y)`,
    new Set(["Math", "E", "PI", "call", "local"]),
    localNames
  );

  return new Function(
    "x",
    "y",
    "env",
    `
      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
      const frac = (a, b) => b === 0 ? NaN : a / b;
      const ln = (value) => value > 0 ? Math.log(value) : NaN;
      const sec = (value) => 1 / Math.cos(value);
      const csc = (value) => 1 / Math.sin(value);
      const cot = (value) => 1 / Math.tan(value);
      const arccot = (value) => Math.PI / 2 - Math.atan(value);
      const arcsec = (value) => Math.acos(1 / value);
      const arccsc = (value) => Math.asin(1 / value);
      const cbrt = (value) => Math.cbrt(value);
      const sech = (value) => 1 / Math.cosh(value);
      const csch = (value) => 1 / Math.sinh(value);
      const coth = (value) => 1 / Math.tanh(value);
      const arcsinh = (value) => Math.asinh(value);
      const arccosh = (value) => Math.acosh(value);
      const arctanh = (value) => Math.atanh(value);
      const arcsech = (value) => Math.acosh(1 / value);
      const arccsch = (value) => Math.asinh(1 / value);
      const arccoth = (value) => Math.atanh(1 / value);
      const runtime = env.__runtime ?? { depth: 0, maxDepth: ${recursionLimit()} };
      const local = (name) => env.__locals?.[name] ?? NaN;
      const ref = (name, rx, ry) => {
        if (!env[name]) return NaN;
        if (runtime.depth >= runtime.maxDepth) return 0;
        runtime.depth += 1;
        try {
          return env[name](rx, ry, env);
        } finally {
          runtime.depth -= 1;
        }
      };
      const call = (name, values, rx, ry) => {
        return env.__call ? env.__call(name, values, rx, ry, env) : NaN;
      };
      return ${js};
    `
  );
}

function buildRuntimeEnv(expressions) {
  const runtimeEnv = {};
  const definitions = {};
  for (const [id, rawEntry] of Object.entries(expressions)) {
    const entry = envEntry(expressions, id);
    if (!entry) continue;
    definitions[id] = entry;
    runtimeEnv[id] = (x, y, env) => {
      const localNames = entry.kind === "function" ? new Set(entry.params) : new Set();
      const previousLocals = env.__locals;
      if (entry.kind === "function") {
        env.__locals = Object.fromEntries(entry.params.map((param) => [param, param === "x" ? x : param === "y" ? y : 0]));
      }
      try {
        return compileExpression(entry.expression, localNames)(x, y, env);
      } finally {
        if (entry.kind === "function") env.__locals = previousLocals;
      }
    };
  }
  Object.defineProperty(runtimeEnv, "__defs", { value: definitions, enumerable: false, configurable: true });
  Object.defineProperty(runtimeEnv, "__call", {
    value: (name, values, x, y, env) => {
      const definition = definitions[name];
      const runtime = env.__runtime ?? { depth: 0, maxDepth: recursionLimit() };
      if (!definition || definition.kind !== "function") return NaN;
      if (values.length !== definition.params.length) return NaN;
      if (runtime.depth >= runtime.maxDepth) return 0;
      const previousLocals = env.__locals;
      env.__locals = Object.fromEntries(definition.params.map((param, index) => [param, values[index]]));
      runtime.depth += 1;
      try {
        return compileExpression(definition.expression, new Set(definition.params))(x, y, env);
      } finally {
        runtime.depth -= 1;
        env.__locals = previousLocals;
      }
    },
    enumerable: false,
    configurable: true
  });
  return attachRuntimeGuard(runtimeEnv);
}

function rewriteCustomFunctionCalls(expression, env, build) {
  const definitions = envFunctionDefinitions(env);
  let output = "";
  let index = 0;
  while (index < expression.length) {
    const match = expression.slice(index).match(/^[A-Za-z_]\w*/);
    if (!match) {
      output += expression[index];
      index += 1;
      continue;
    }
    const name = match[0];
    const nameStart = index;
    index += name.length;
    if (!definitions[name] || expression[index] !== "(") {
      output += expression.slice(nameStart, index);
      continue;
    }
    const close = matchingParen(expression, index);
    if (close === -1) {
      output += expression.slice(nameStart);
      break;
    }
    const args = splitFunctionArgs(expression.slice(index + 1, close)).map((arg) => arg.trim()).filter((arg) => arg.length);
    output += build(definitions[name], args);
    index = close + 1;
  }
  return output;
}

function expressionToGlsl(source, env = {}, zName = null, stack = [], angleMode = "radians", localMap = {}) {
  if (stack.length > recursionLimit()) {
    return recursionBaseGlsl(zName);
  }
  let expression = normalizeExpressionText(source);
  expression = rewriteCustomFunctionCalls(expression, env, (entry, args) => {
    if (args.length !== entry.params.length) {
      throw new Error(`Function ${entry.id} expects ${entry.params.length} input${entry.params.length === 1 ? "" : "s"}`);
    }
    const expandedArgs = args.map((arg) => expressionToGlsl(arg, env, zName, stack, angleMode, localMap));
    const nextLocalMap = Object.fromEntries(entry.params.map((param, index) => [param, `(${expandedArgs[index]})`]));
    return `(${expressionToGlsl(entry.expression, env, zName, [...stack, entry.id], angleMode, nextLocalMap)})`;
  });
  expression = inlineCustomVariables(expression, env, stack, zName, angleMode, localMap);
  expression = inlineBareVariables(expression, env, stack, zName, angleMode, localMap);
  expression = normalizeMathSyntax(expression);
  expression = expression
    .replaceAll(/\barcsin\b/g, "asin")
    .replaceAll(/\barccos\b/g, "acos")
    .replaceAll(/\barctan\b/g, "atan")
    .replaceAll(/\barccot\b/g, "arccot")
    .replaceAll(/\bsinh\b/g, "sinh1")
    .replaceAll(/\bcosh\b/g, "cosh1")
    .replaceAll(/\btanh\b/g, "tanh1")
    .replaceAll(/\bln\b/g, "log")
    .replaceAll(/\blog\b/g, "log")
    .replaceAll(/\bround\b/g, "round1")
    .replaceAll(/\bmin\b/g, "min")
    .replaceAll(/\bmax\b/g, "max")
    .replaceAll(/\bclamp\b/g, "clamp3")
    .replaceAll(/\bpi\b/g, "3.141592653589793")
    .replaceAll(/\be\b/g, "2.718281828459045");

  if (zName) {
    expression = expression.replaceAll(/\bx\b/g, zName);
  }

  expression = convertTrigForAngleMode(expression, angleMode);
  expression = convertPowers(expression);
  expression = normalizeGlslNumbers(expression);
  if (expression.length > 200000) {
    throw new Error("Expanded expression is too large");
  }
  if (!/^[\dA-Za-z_+\-*/().,\s~]+$/.test(expression)) {
    throw new Error(`Unsupported GLSL expression: ${source}`);
  }
  return expression;
}

function normalizeMathSyntax(expression) {
  return String(expression)
    .replaceAll(/(\d|\))([A-Za-z_])/g, "$1*$2")
    .replaceAll(/\b([xy])(\d)/g, "$1*$2")
    .replaceAll(/(\d|\b[xy]\b|\))\(/g, "$1*(")
    .replaceAll(/\)(\d|[A-Za-z_])/g, ")*$1");
}

function normalizeGlslNumbers(expression) {
  return expression.replaceAll(/\b\d+(?:\.\d+)?\b/g, (match) => (match.includes(".") ? match : `${match}.0`));
}

function convertTrigForAngleMode(expression, angleMode) {
  if (angleMode !== "degrees") return expression;
  return wrapFunctionArguments(expression, new Set(["sin", "cos", "tan", "sec", "csc", "cot"]), (name, argument) => `${name}((${argument})*0.017453292519943295)`);
}

function wrapFunctionArguments(expression, names, wrap) {
  let output = "";
  let index = 0;
  while (index < expression.length) {
    const match = expression.slice(index).match(/^[A-Za-z_]\w*/);
    if (!match) {
      output += expression[index];
      index += 1;
      continue;
    }

    const name = match[0];
    const nameStart = index;
    index += name.length;
    if (!names.has(name) || expression[index] !== "(") {
      output += expression.slice(nameStart, index);
      continue;
    }

    const open = index;
    let depth = 0;
    let close = -1;
    for (let i = open; i < expression.length; i += 1) {
      if (expression[i] === "(") depth += 1;
      if (expression[i] === ")") depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
    if (close === -1) {
      output += expression.slice(nameStart);
      break;
    }
    output += wrap(name, expression.slice(open + 1, close));
    index = close + 1;
  }
  return output;
}

function recursionBaseGlsl(zName) {
  return "0.0";
}

function inlineCustomVariables(expression, env, stack, zName, angleMode = "radians", localMap = {}) {
  return expression.replaceAll(/~([A-Za-z]\w*)~/g, (_, name) => {
    if (localMap[name]) {
      return `(${localMap[name]})`;
    }
    const entry = envEntry(env, name);
    if (!entry) {
      throw new Error(`Unknown reference ~${name}~`);
    }
    if (stack.length >= recursionLimit()) {
      return `(${recursionBaseGlsl(zName)})`;
    }
    return `(${expressionToGlsl(entry.expression, env, zName, [...stack, name], angleMode, entry.kind === "function" ? defaultParamGlslMap(entry.params, zName) : {})})`;
  });
}

function inlineBareVariables(expression, env, stack, zName, angleMode = "radians", localMap = {}) {
  return rewriteBareIdentifiers(
    expression,
    (name) => {
      if (localMap[name]) {
        return `(${localMap[name]})`;
      }
      const entry = envEntry(env, name);
      if (!entry) {
        throw new Error(`Unknown variable: ${name}`);
      }
      if (stack.length >= recursionLimit()) {
        return `(${recursionBaseGlsl(zName)})`;
      }
      return `(${expressionToGlsl(entry.expression, env, zName, [...stack, name], angleMode, entry.kind === "function" ? defaultParamGlslMap(entry.params, zName) : {})})`;
    },
    new Set(),
    new Set(Object.keys(localMap))
  );
}

function defaultParamGlslMap(params, zName = null) {
  return Object.fromEntries(
    params.map((param) => [param, param === "x" ? "x" : param === "y" ? "y" : param === "z" && zName ? zName : "0.0"])
  );
}

function rewriteBareIdentifiers(expression, replace, extraReserved, overrideNames = new Set()) {
  const stringRanges = [];
  expression.replaceAll(/"[^"]*"/g, (match, offset) => {
    stringRanges.push([offset, offset + match.length]);
    return match;
  });

  return expression.replaceAll(/\b[A-Za-z_]\w*\b/g, (name, offset) => {
    if (stringRanges.some(([start, end]) => offset >= start && offset < end)) return name;
    if (overrideNames.has(name)) return replace(name);
    if (BUILTIN_NAMES.has(name) || extraReserved.has(name)) return name;
    return replace(name);
  });
}

function convertPowers(expression) {
  let output = expression;
  let guard = 0;
  while (output.includes("^") && guard < 200) {
    guard += 1;
    const index = output.indexOf("^");
    const left = findLeftOperand(output, index - 1);
    const right = findRightOperand(output, index + 1);
    if (!left || !right) break;
    output = `${output.slice(0, left.start)}pow(${left.value},${right.value})${output.slice(right.end)}`;
  }
  return output;
}

function findLeftOperand(source, index) {
  let i = skipSpacesLeft(source, index);
  if (i < 0) return null;
  if (source[i] === ")") {
    let depth = 0;
    for (let j = i; j >= 0; j -= 1) {
      if (source[j] === ")") depth += 1;
      if (source[j] === "(") depth -= 1;
      if (depth === 0) return { start: j, end: i + 1, value: source.slice(j, i + 1) };
    }
    return null;
  }
  const end = i + 1;
  while (i >= 0 && /[\w.]/.test(source[i])) i -= 1;
  return { start: i + 1, end, value: source.slice(i + 1, end) };
}

function findRightOperand(source, index) {
  let i = skipSpacesRight(source, index);
  if (i >= source.length) return null;
  if (source[i] === "(") {
    const end = matchingParen(source, i);
    return end === -1 ? null : { start: i, end: end + 1, value: source.slice(i, end + 1) };
  }
  const start = i;
  if (source[i] === "-") i += 1;
  while (i < source.length && /[\w.]/.test(source[i])) i += 1;
  return i === start ? null : { start, end: i, value: source.slice(start, i) };
}

function skipSpacesLeft(source, index) {
  let i = index;
  while (i >= 0 && /\s/.test(source[i])) i -= 1;
  return i;
}

function skipSpacesRight(source, index) {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  return i;
}

function validateScene() {
  const env = sceneFunctionEnv();
  const drawEnv = sceneFunctionEnv(true);
  const duplicateIds = {
    functions: duplicateEntryIds(scene.functions),
    colors: duplicateEntryIds(scene.colors),
    restrictions: duplicateEntryIds(scene.restrictions)
  };
  const diagnostics = {
    functions: [],
    colors: [],
    restrictions: [],
    draws: [],
    settings: [],
    hasErrors: false,
    summary: "GLSL ready"
  };
  diagnostics.settings = [viewportDiagnostic()];
  const timeVariableCount = scene.functions
    .map(normalizeFunctionEntry)
    .filter((entry) => entry.kind === "slider" && entry.time).length;

  diagnostics.functions = scene.functions.map((rawEntry) => {
    const entry = normalizeFunctionEntry(rawEntry);
    const label = entry.kind === "slider" ? "Slider" : entry.kind === "function" ? "Function" : "Variable";
    const idResult = validateEntryId(entry.id, label, env);
    if (idResult.status === "invalid") return idResult;
    const duplicateDiagnostic = duplicateIdDiagnostic(entry.id, label, duplicateIds.functions);
    if (entry.kind === "slider") {
      return combineDiagnostics([
        duplicateDiagnostic,
        idResult,
        sliderCoordinateDiagnostic(entry),
        timeVariableDiagnostic(entry, timeVariableCount),
        sliderRangeDiagnostic(entry),
        validateExpression(entry.expression, env, [entry.id]),
        validateExpression(entry.sliderMin, env),
        validateExpression(entry.sliderMax, env)
      ]);
    }
    if (entry.kind === "function") {
      const params = new Set(entry.params);
      return combineDiagnostics([
        duplicateDiagnostic,
        idResult,
        validateFunctionParams(entry, env),
        validateExpression(entry.expression, env, [entry.id], params)
      ]);
    }
    return combineDiagnostics([duplicateDiagnostic, idResult, validateExpression(entry.expression, env, [entry.id])]);
  });
  diagnostics.colors = scene.colors.map((entry) => {
    const idResult = validateEntryId(entry.id, "Color", env);
    if (idResult.status === "invalid") return idResult;
    const duplicateDiagnostic = duplicateIdDiagnostic(entry.id, "Color", duplicateIds.colors);
    return combineDiagnostics([
      duplicateDiagnostic,
      idResult,
      validateExpression(entry.red, env),
      validateExpression(entry.green, env),
      validateExpression(entry.blue, env)
    ]);
  });
  diagnostics.restrictions = scene.restrictions.map((entry) => {
    const idResult = validateEntryId(entry.id, "Boundary", env);
    if (idResult.status === "invalid") return idResult;
    const duplicateDiagnostic = duplicateIdDiagnostic(entry.id, "Boundary", duplicateIds.restrictions);
    return combineDiagnostics([duplicateDiagnostic, idResult, validateExpression(entry.expression, env)]);
  });
  diagnostics.draws = scene.draws.map((entry) => {
    if (entry.hidden) {
      return { status: "valid", message: "Draw layer hidden" };
    }
    const missing = [];
    const fn = resolveFunctionEntry(entry.equationId);
    const color = resolveColorEntry(entry.colorId);
    const restriction = resolveBoundaryEntry(entry.restrictionId);
    if (!fn) missing.push("function");
    if (!color) missing.push("color");
    if (!restriction) missing.push("boundary");
    if (missing.length) return { status: "invalid", message: `Missing ${missing.join(", ")}` };
    const affected = combineDiagnostics([
      validateExpression(fn.expression, drawEnv, [fn.id], fn.kind === "function" ? new Set(fn.params) : new Set()),
      validateExpression(color.red, drawEnv),
      validateExpression(color.green, drawEnv),
      validateExpression(color.blue, drawEnv),
      validateExpression(restriction.expression, drawEnv)
    ]);
    return affected.status === "invalid"
      ? { status: "invalid", message: `Draw layer skipped: ${affected.message}` }
      : affected.status === "warning" || affected.status === "info"
        ? affected
      : { status: "valid", message: "Draw layer is valid" };
  });

  const all = [...diagnostics.functions, ...diagnostics.colors, ...diagnostics.restrictions, ...diagnostics.draws, ...diagnostics.settings];
  const firstError = all.find((item) => item.status === "invalid");
  const firstInfo = all.find((item) => item.status === "info");
  const firstWarning = all.find((item) => item.status === "warning");
  diagnostics.hasErrors = Boolean(firstError);
  diagnostics.summary = firstError ? firstError.message : firstInfo ? firstInfo.message : firstWarning ? firstWarning.message : "GLSL ready";
  return diagnostics;
}

function sliderRangeDiagnostic(entry) {
  if (entry.time && normalizeTimeMode(entry.timeMode) === "unbounded") {
    return { status: "valid", message: "Unbounded time has no slider range" };
  }
  const min = evaluateScalarSetting(entry.sliderMin);
  const max = evaluateScalarSetting(entry.sliderMax);
  if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
    return { status: "invalid", message: `Slider "${entry.id}" minimum is greater than maximum` };
  }
  return { status: "valid", message: "Slider range is valid" };
}

function sliderCoordinateDiagnostic(entry) {
  const identifiers = expressionIdentifiers(entry.expression);
  const coordinate = identifiers.find((name) => name === "x" || name === "y");
  if (coordinate) {
    return {
      status: "warning",
      message: `Slider "${entry.id}" uses coordinate "${coordinate}"; sliders are usually numeric values or references to variables`
    };
  }
  return { status: "valid", message: "Slider value is numeric" };
}

function timeVariableDiagnostic(entry, timeVariableCount) {
  if (entry.kind === "slider" && entry.time && timeVariableCount > 1) {
    return {
      status: "warning",
      message: "Multiple time variables are declared; this can make animation behavior harder to predict"
    };
  }
  return { status: "valid", message: "Time variable setup is valid" };
}

function expressionIdentifiers(source) {
  const normalized = normalizeExpressionText(source);
  return [...normalized.matchAll(/\b[A-Za-z_]\w*\b/g)].map((match) => match[0]);
}

function viewportDiagnostic() {
  const ratio = parseAspectRatioSetting();
  if (!ratio.valid) {
    return { status: "invalid", message: ratio.message };
  }
  const valid = isValidViewport(sceneViewport());
  if (valid) return { status: "valid", message: "Grid rendering settings are valid" };
  return scene.settings.ensureSquareGrid !== false
    ? { status: "warning", message: "Invalid bounds; square grid is using the default viewport" }
    : { status: "invalid", message: "Invalid bounds: minimum values must be less than maximum values" };
}

function isValidViewport(candidate) {
  return (
    Number.isFinite(candidate.xMin) &&
    Number.isFinite(candidate.xMax) &&
    Number.isFinite(candidate.yMin) &&
    Number.isFinite(candidate.yMax) &&
    candidate.xMin < candidate.xMax &&
    candidate.yMin < candidate.yMax
  );
}

function duplicateEntryIds(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const id = entry.id.trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id));
}

function duplicateIdDiagnostic(id, label, duplicates) {
  return duplicates.has(id.trim())
    ? { status: "invalid", message: `${label} name "${id}" is duplicated` }
    : null;
}

function validateEntryId(id, label, env = {}) {
  const trimmed = id.trim();
  if (!trimmed) {
    return { status: "invalid", message: `${label} name cannot be blank` };
  }
  if (!/^[A-Za-z_]\w*$/.test(trimmed)) {
    return { status: "invalid", message: `${label} name must start with a letter or underscore` };
  }
  if (EXACT_RESERVED_NAMES.has(trimmed)) {
    return { status: "invalid", message: `${label} name "${trimmed}" shadows a built-in name` };
  }
  const substring = [...SUBSTRING_RESERVED_NAMES]
    .sort((left, right) => right.length - left.length)
    .find((name) => trimmed !== name && trimmed.includes(name));
  if (substring) {
    return { status: "warning", message: `${label} name "${trimmed}" contains reserved name "${substring}"` };
  }
  return { status: "valid", message: `${label} name is valid` };
}

function validateFunctionParams(entry, env) {
  const seen = new Set();
  for (const param of entry.params) {
    if (!/^[A-Za-z_]\w*$/.test(param)) {
      return { status: "invalid", message: `Function input "${param}" must start with a letter or underscore` };
    }
    if (seen.has(param)) {
      return { status: "invalid", message: `Function input "${param}" is duplicated` };
    }
    seen.add(param);
  }
  const shadow = entry.params.find((param) => {
    const target = envEntry(env, param);
    return target && target.id !== entry.id && target.kind !== "function";
  });
  if (shadow) {
    return { status: "warning", message: `Input "${shadow}" shadows an outer variable or slider inside this function` };
  }
  return { status: "valid", message: "Function inputs are valid" };
}

function validateExpression(source, env, stack = [], localNames = new Set()) {
  try {
    const normalized = normalizeExpressionText(source);
    assertCompleteExpression(normalized);
    if (/\b[A-Za-z]\w*\(\s*\)/.test(normalized)) {
      throw new Error("Empty function argument");
    }
    const nodeCount = estimateExpandedNodeCount(source, env, stack, new Map(), localNames);
    if (nodeCount > NODE_RED_FLAG_THRESHOLD) {
      throw new Error(`Equation is too large (${formatNodeCount(nodeCount)} nodes); refusing to generate`);
    }
    if (nodeCount > NODE_BLUE_FLAG_THRESHOLD) {
      return { status: "info", message: `Equation is large (${formatNodeCount(nodeCount)} nodes); rendering may be slower` };
    }
    expressionToGlsl(source, env, null, stack, scene.settings.angleMode, Object.fromEntries([...localNames].map((name) => [name, name === "x" ? "x" : name === "y" ? "y" : "0.0"])));
    const runtimeEnv = buildRuntimeEnv(env);
    const previousLocals = runtimeEnv.__locals;
    runtimeEnv.__locals = Object.fromEntries([...localNames].map((name) => [name, name === "x" ? 1 : name === "y" ? 1 : 0]));
    try {
      compileExpression(source, localNames)(1, 1, runtimeEnv);
    } finally {
      runtimeEnv.__locals = previousLocals;
    }
    return { status: "valid", message: "Expression is valid" };
  } catch (error) {
    return { status: "invalid", message: error.message };
  }
}

function estimateExpandedNodeCount(source, env = {}, stack = [], memo = new Map(), localNames = new Set()) {
  const normalized = normalizeExpressionText(source).replaceAll(/~([A-Za-z]\w*)~/g, "$1");
  let total = countLocalExpressionNodes(normalized);
  const identifiers = normalized.matchAll(/\b[A-Za-z_]\w*\b/g);
  for (const match of identifiers) {
    const name = match[0];
    const entry = envEntry(env, name);
    if (BUILTIN_NAMES.has(name) || localNames.has(name) || !entry) continue;
    if (stack.length >= recursionLimit()) {
      total = cappedNodeAdd(total, 2);
      continue;
    }
    const memoKey = `${name}:${stack.length}`;
    if (memo.has(memoKey)) {
      total = cappedNodeAdd(total, Math.max(0, memo.get(memoKey) - 1));
      continue;
    }
    const value = estimateExpandedNodeCount(entry.expression, env, [...stack, name], memo, entry.kind === "function" ? new Set(entry.params) : new Set());
    memo.set(memoKey, value);
    total = cappedNodeAdd(total, Math.max(0, value - 1));
  }
  return total;
}

function countLocalExpressionNodes(source) {
  const tokens = String(source).match(/\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|[+\-*/^(),]/g);
  return Math.max(1, tokens?.length ?? 1);
}

function cappedNodeAdd(left, right) {
  const total = left + right;
  return total > NODE_RED_FLAG_THRESHOLD + 1 ? NODE_RED_FLAG_THRESHOLD + 1 : total;
}

function formatNodeCount(value) {
  if (value > NODE_RED_FLAG_THRESHOLD) return `>${NODE_RED_FLAG_THRESHOLD.toLocaleString()}`;
  return value.toLocaleString();
}

function assertCompleteExpression(source) {
  const trimmed = String(source ?? "").trim();
  if (!trimmed) throw new Error("Expression is blank");
  if (/[+\-*/^,]$/.test(trimmed)) throw new Error("Expression ends with an operator");
  let parenDepth = 0;
  let braceDepth = 0;
  for (const char of trimmed) {
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (char === "{") braceDepth += 1;
    if (char === "}") braceDepth -= 1;
    if (parenDepth < 0 || braceDepth < 0) throw new Error("Expression has unmatched closing bracket");
  }
  if (parenDepth || braceDepth) throw new Error("Expression has unmatched opening bracket");
}

function updateStatusLights(diagnostics) {
  const group = diagnostics[activeTab] ?? [];
  if (activeTab === "settings") {
    const gridStatus = diagnostics.settings?.[0];
    const status = root.querySelector(".settings-section-title .entry-status");
    if (status && gridStatus) {
      status.classList.toggle("valid", gridStatus.status === "valid");
      status.classList.toggle("invalid", gridStatus.status === "invalid");
      status.classList.toggle("info", gridStatus.status === "info");
      status.classList.toggle("warning", gridStatus.status === "warning");
      status.setAttribute("title", gridStatus.message);
      status.setAttribute("aria-label", gridStatus.message);
    }
  }
  root.querySelectorAll(".expression-row").forEach((row, index) => {
    const status = row.querySelector(".entry-status");
    const item = group[index];
    if (!status || !item) return;
    status.classList.toggle("valid", item.status === "valid");
    status.classList.toggle("invalid", item.status === "invalid");
    status.classList.toggle("info", item.status === "info");
    status.classList.toggle("warning", item.status === "warning");
    status.setAttribute("aria-label", item.message);
    row.setAttribute("title", item.message);
  });

  const overlay = root.querySelector(".render-overlay");
  if (overlay) {
    overlay.textContent = diagnostics.hasErrors
      ? `Some layers skipped: ${diagnostics.summary}`
      : `${scene.settings.angleMode} · depth ${scene.settings.maxRecursion} · ${diagnostics.summary}`;
  }
}

function combineDiagnostics(items) {
  const present = items.filter(Boolean);
  return present.find((item) => item.status === "invalid") ??
    present.find((item) => item.status === "info") ??
    present.find((item) => item.status === "warning") ??
    { status: "valid", message: "Color is valid" };
}

function handleMathBeforeInput(field, event) {
  if (!["/", "÷"].includes(event.data)) return;
  const currentSource = serializeMathField(field);
  if (/[+\-*^/]/.test(currentSource)) return;
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const textNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer : null;
  if (!textNode) return;
  const before = textNode.textContent.slice(0, range.startOffset);
  const division = before.match(/([A-Za-z_]\w*|\d+(?:\.\d+)?|\([^()]*\))$/);
  if (!division) return;

  event.preventDefault();
  pushEditorHistory(field);
  const numerator = division[1];
  textNode.textContent = `${before.slice(0, -numerator.length)}${textNode.textContent.slice(range.startOffset)}`;
  const frac = createMathAtom("frac", [numerator, ""]);
  range.insertNode(frac);
  focusMathSlot(frac, 1);
  field.dataset.preserveVisualCaret = "true";
  syncMathField(field);
  field.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function handleAbsoluteDelimiterInput(field, event) {
  if (event.defaultPrevented || event.inputType !== "insertText" || event.data !== "|") return false;
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  const slot = closestMathSlot(range.startContainer);
  const atom = slot?.closest(".mq-atom");

  if (slot && atom?.dataset.command === "abs" && isCaretAtEndOf(slot, range) && !isOpeningAbsoluteContext(slot, range)) {
    event.preventDefault();
    placeCaretAfterNode(atom);
    field.dataset.preserveVisualCaret = "true";
    syncMathField(field);
    field.dispatchEvent(new InputEvent("input", { bubbles: true }));
    return true;
  }

  event.preventDefault();
  pushEditorHistory(field);
  const selectedSource = range.toString();
  range.deleteContents();
  const abs = createMathAtom("abs", [selectedSource]);
  range.insertNode(abs);
  focusMathSlot(abs, 0);
  field.dataset.preserveVisualCaret = "true";
  syncMathField(field);
  field.dispatchEvent(new InputEvent("input", { bubbles: true }));
  return true;
}

function isOpeningAbsoluteContext(slot, range) {
  const before = range.cloneRange();
  before.selectNodeContents(slot);
  before.setEnd(range.startContainer, range.startOffset);
  const text = before.toString().trim();
  return !text || /[+\-*/^(,]$/.test(text);
}

function handlePlainMathInsert(field, event) {
  if (event.defaultPrevented || event.inputType !== "insertText" || !event.data) return;
  event.preventDefault();
  pushEditorHistory(field);
  insertTextAtSelection(event.data);
  if (/[^A-Za-z0-9_]/.test(event.data)) {
    completeVisibleIdentifierConstants(field);
  }
  field.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function completeIdentifierConstants(source) {
  return String(source ?? "")
    .replaceAll(/\bpi\b/g, "π")
    .replaceAll(/\btheta\b/g, "θ");
}

function completeVisibleIdentifierConstants(field) {
  const selection = window.getSelection();
  const offset = getCaretOffset(field);
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const nextText = completeIdentifierConstants(node.textContent ?? "");
    if (nextText !== node.textContent) node.textContent = nextText;
    node = walker.nextNode();
  }
  if (selection) setCaretOffset(field, Math.min(offset, field.textContent?.length ?? offset));
  syncMathField(field);
}

function normalizeMathFieldDom(field) {
  const lists = Array.from(field.querySelectorAll("ul, ol")).reverse();
  if (!lists.length) return;

  for (const list of lists) {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode("+"));
    for (const child of Array.from(list.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent.trim() === "") continue;
      if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "LI") {
        for (const liChild of Array.from(child.childNodes)) {
          if (liChild.nodeType === Node.TEXT_NODE && liChild.textContent.trim() === "") continue;
          fragment.appendChild(liChild);
        }
        continue;
      }
      fragment.appendChild(child);
    }
    list.replaceWith(fragment);
  }
  placeCaretAtEnd(field);
}

function expandCompletedFunctionCall(field) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const textNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer : null;
  if (!textNode) return;
  const before = textNode.textContent.slice(0, range.startOffset);
  const call = before.match(/(?:^|[^A-Za-z\\])([A-Za-z]+)\(([^()]*)\)$/);
  if (!call) return;

  const name = call[1];
  if (!LATEX_SHORTCUTS.has(name)) return;
  const rawCall = `${name}(${call[2]})`;
  const start = range.startOffset - rawCall.length;
  const args = splitFunctionArgs(call[2]);
  if (args.length !== LATEX_FUNCTIONS[name].args) return;
  textNode.textContent = `${textNode.textContent.slice(0, start)}${textNode.textContent.slice(range.startOffset)}`;
  const atom = createMathAtom(name, args);
  range.setStart(textNode, start);
  range.collapse(true);
  range.insertNode(atom);
  placeCaretAfterNode(atom);
  field.dataset.preserveVisualCaret = "true";
}

function expandTrailingFraction(field) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const textNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer : null;
  if (!textNode) return;
  const currentSource = serializeMathField(field);
  if (/[+\-*^/]/.test(currentSource.replace(/\/$/, ""))) return;
  const before = textNode.textContent.slice(0, range.startOffset);
  const division = before.match(/([A-Za-z_]\w*|\d+(?:\.\d+)?|\([^()]*\))\/$/);
  if (!division) return;

  const numerator = division[1];
  const start = range.startOffset - numerator.length - 1;
  textNode.textContent = `${textNode.textContent.slice(0, start)}${textNode.textContent.slice(range.startOffset)}`;
  range.setStart(textNode, start);
  range.collapse(true);
  const frac = createMathAtom("frac", [numerator, ""]);
  range.insertNode(frac);
  focusMathSlot(frac, 1);
  field.dataset.preserveVisualCaret = "true";
}

function handleSlotExitInput(field, event) {
  if (!event.data || !/[)+\-*]/.test(event.data)) return false;
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  const slot = closestMathSlot(range.startContainer);
  if (!slot || !isCaretAtEndOf(slot, range)) return false;

  const atom = slot.closest(".mq-atom");
  if (!atom) return false;
  event.preventDefault();
  placeCaretAfterNode(atom);
  if (event.data !== ")") {
    insertTextAtSelection(event.data);
  }
  field.dataset.preserveVisualCaret = "true";
  syncMathField(field);
  field.dispatchEvent(new InputEvent("input", { bubbles: true }));
  return true;
}

function syncMathField(field) {
  const source = serializeMathField(field);
  field.dataset.source = source;
  const raw = root.querySelector(`textarea[data-source-field="${cssEscape(field.dataset.field)}"]`);
  if (raw) raw.value = source;
}

function refreshMathFieldDisplay(field) {
  const source = field.dataset.source ?? "";
  if (!isReadyForVisualRefresh(source)) return;
  renderMathFieldDisplay(field);
}

function renderMathFieldDisplay(field) {
  const source = field.dataset.source ?? "";
  const html = renderEditableLatex(source);
  if (field.innerHTML === html) return;
  field.innerHTML = html;
  field.dataset.source = source;
  reflowMathLayout(field);
  requestAnimationFrame(() => reflowMathLayout(field));
  placeCaretAtEnd(field);
}

function queueMathLayoutReflow() {
  reflowMathLayout(root);
  requestAnimationFrame(() => {
    reflowMathLayout(root);
    requestAnimationFrame(() => reflowMathLayout(root));
  });
}

function reflowMathLayout(container = root) {
  container.querySelectorAll(".mq-radical, .latex-radical").forEach((radical) => {
    const prefix = radical.querySelector(":scope > .mq-radical-symbol, :scope > .latex-radical-symbol");
    const stem = radical.querySelector(":scope > .mq-radicand, :scope > .latex-radicand");
    if (!prefix || !stem) return;
    prefix.style.transform = "none";
    const stemHeight = stem.getBoundingClientRect().height;
    const symbolHeight = prefix.getBoundingClientRect().height || parseFloat(getComputedStyle(prefix).fontSize) || 16;
    const scaleY = Math.max(1, stemHeight / symbolHeight);
    prefix.style.transform = `scale(1, ${scaleY.toFixed(3)})`;
  });
}

function shouldAutoRefreshVisualSource(source) {
  const value = String(source ?? "").trim();
  if (!value) return true;
  if (/^[A-Za-z_]\w*\^(?:[A-Za-z_]\w*|\d+(?:\.\d+)?)$/.test(value)) return true;
  for (const config of Object.values(LATEX_FUNCTIONS)) {
    const call = parseFunctionCall(value, config.internal);
    if (call && call.length === config.args && call.every((arg) => !/[()]/.test(arg))) return true;
  }
  if (/^frac\{[^{}]*\}\{[^{}]*\}$/.test(value)) return true;
  return false;
}

function isReadyForVisualRefresh(source) {
  const value = String(source ?? "");
  if (!value.trim()) return true;
  if (hasUnmatchedGrouping(value)) return false;
  if (hasUnmatchedAbsoluteBars(value)) return false;
  if (hasIncompletePower(value)) return false;
  return true;
}

function hasUnmatchedGrouping(source) {
  let parenDepth = 0;
  let braceDepth = 0;
  for (const char of String(source ?? "")) {
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (char === "{") braceDepth += 1;
    if (char === "}") braceDepth -= 1;
    if (parenDepth < 0 || braceDepth < 0) return true;
  }
  return parenDepth !== 0 || braceDepth !== 0;
}

function hasUnmatchedAbsoluteBars(source) {
  const bareBars = String(source ?? "")
    .replaceAll(/\\left\|/g, "")
    .replaceAll(/\\right\|/g, "")
    .replaceAll(/\\lvert/g, "")
    .replaceAll(/\\rvert/g, "")
    .split("")
    .filter((char) => char === "|").length;
  return bareBars % 2 !== 0;
}

function hasIncompletePower(source) {
  const power = splitTopLevel(String(source ?? ""), "^");
  if (!power) return false;
  const grouped = splitPowerOperands(source, power.index);
  return !grouped.exponent.trim();
}

function hasRenderableLatex(source) {
  const commands = Object.keys(LATEX_FUNCTIONS).join("|");
  return new RegExp(`\\\\(?:operatorname|${commands}|left\\||lvert|lfloor|lceil)\\b`).test(source);
}

function hasInternalRenderableCall(source) {
  const names = [...new Set(Object.values(LATEX_FUNCTIONS).map((config) => config.internal))].join("|");
  return new RegExp(`\\b(?:${names})\\(`).test(source);
}

function renderEditableLatex(source) {
  if (!source) return "";
  try {
    const trimmed = String(source).trim();
    const ast = (trimmed.startsWith("\\") || /\\(?:operatorname|frac|sqrt|left)\b/.test(trimmed))
      ? parseLatex(trimmed)
      : parseLeptonText(trimmed);
    return astToEditableHtml(ast);
  } catch (e) {
    return escapeHtml(source);
  }
}

function renderEditableExpression(source) {
  const trimmed = String(source ?? "");
  if (!trimmed) return "";

  const additive = splitTopLevelAdditive(trimmed);
  if (additive) {
    return `${renderEditableExpression(additive.left)}${escapeHtml(additive.operator)}${renderEditableExpression(additive.right)}`;
  }

  const fraction = splitTopLevelFraction(trimmed);
  if (fraction) {
    return `${renderEditableExpression(fraction.prefix)}${atomEditableHtml("frac", [fraction.numerator, fraction.denominator])}${renderEditableExpression(fraction.suffix)}`;
  }

  const power = splitTopLevel(trimmed, "^");
  if (power) {
    const grouped = splitPowerOperands(trimmed, power.index);
    if (!grouped.exponent.trim()) return escapeHtml(trimmed).replaceAll(/\bpi\b/g, "π");
    return `${renderEditableExpression(grouped.prefix)}<span class="mq-power" data-command="power"><span class="mq-base">${renderEditableExpression(grouped.base)}</span><span class="mq-exponent">${renderEditableExpression(stripWrappingGroup(grouped.exponent))}</span></span>${renderEditableExpression(grouped.suffix)}`;
  }

  const bareFrac = parseBareBraceArgs(trimmed, "frac", 2);
  if (bareFrac) {
    return atomEditableHtml("frac", bareFrac);
  }

  const bareSqrt = parseBareBraceArgs(trimmed, "sqrt", 1);
  if (bareSqrt) {
    return atomEditableHtml("sqrt", bareSqrt);
  }

  const commandIndex = nextLatexCommandIndex(trimmed);
  const internalIndex = nextInternalCallIndex(trimmed);
  const parenIndex = nextParentheticalIndex(trimmed);

  if (parenIndex !== -1 && (commandIndex === -1 || parenIndex < commandIndex) && (internalIndex === -1 || parenIndex < internalIndex)) {
    const closeIndex = matchingParen(trimmed, parenIndex);
    if (closeIndex !== -1) {
      return `${renderEditableExpression(trimmed.slice(0, parenIndex))}(${renderEditableExpression(trimmed.slice(parenIndex + 1, closeIndex))})${renderEditableExpression(trimmed.slice(closeIndex + 1))}`;
    }
  }

  if (commandIndex !== -1) {
    const parsed = parseEditableLatexCommandAt(trimmed, commandIndex);
    if (parsed) {
      return `${renderEditableExpression(trimmed.slice(0, commandIndex))}${parsed.html}${renderEditableExpression(trimmed.slice(parsed.end))}`;
    }
  }

  if (internalIndex !== -1) {
    const parsed = parseEditableInternalCallAt(trimmed, internalIndex);
    if (parsed) {
      return `${renderEditableExpression(trimmed.slice(0, internalIndex))}${parsed.html}${renderEditableExpression(trimmed.slice(parsed.end))}`;
    }
  }

  if (parenIndex !== -1) {
    const closeIndex = matchingParen(trimmed, parenIndex);
    if (closeIndex !== -1) {
      return `${renderEditableExpression(trimmed.slice(0, parenIndex))}(${renderEditableExpression(trimmed.slice(parenIndex + 1, closeIndex))})${renderEditableExpression(trimmed.slice(closeIndex + 1))}`;
    }
  }

  return escapeHtml(trimmed).replaceAll(/\bpi\b/g, "π");
}

function parseEditableLatexCommandAt(source, index) {
  for (const command of Object.keys(LATEX_FUNCTIONS)) {
    const marker = `\\${command}`;
    if (!source.startsWith(marker, index)) continue;
    const expectedArgs = LATEX_FUNCTIONS[command].args;
    const args = [];
    let cursor = index + marker.length;
    while (args.length < expectedArgs && source[cursor] === "{") {
      const end = matchingBrace(source, cursor);
      if (end === -1) {
        args.push(source.slice(cursor + 1));
        cursor = source.length;
        break;
      }
      args.push(source.slice(cursor + 1, end));
      cursor = end + 1;
    }
    while (args.length < expectedArgs) args.push("");
    return { end: cursor, html: atomEditableHtml(command, args) };
  }

  const paired = parseEditablePairedLatexDelimiterAt(source, index);
  if (paired) return paired;
  return null;
}

function parseEditablePairedLatexDelimiterAt(source, index) {
  const pairs = [
    { open: "\\left|", close: "\\right|", fallbackClose: "\\right", command: "abs" },
    { open: "\\lvert", close: "\\rvert", command: "abs" },
    { open: "\\lfloor", close: "\\rfloor", command: "floor" },
    { open: "\\lceil", close: "\\rceil", command: "ceil" }
  ];

  for (const pair of pairs) {
    if (!source.startsWith(pair.open, index)) continue;
    const start = index + pair.open.length;
    let end = source.indexOf(pair.close, start);
    let closeLength = pair.close.length;
    if (end === -1 && pair.fallbackClose) {
      end = source.indexOf(pair.fallbackClose, start);
      closeLength = pair.fallbackClose.length;
    }
    if (end === -1) return null;
    return { end: end + closeLength, html: atomEditableHtml(pair.command, [source.slice(start, end)]) };
  }
  return null;
}

function parseEditableInternalCallAt(source, index) {
  for (const [name, config] of Object.entries(LATEX_FUNCTIONS)) {
    const marker = `${config.internal}(`;
    if (!source.startsWith(marker, index)) continue;
    const openIndex = index + config.internal.length;
    const closeIndex = matchingParen(source, openIndex);
    if (closeIndex === -1) return null;
    const args = splitFunctionArgs(source.slice(openIndex + 1, closeIndex));
    if (args.length !== config.args) return null;
    return { end: closeIndex + 1, html: atomEditableHtml(name, args) };
  }
  return null;
}

function atomEditableHtml(command, args) {
  const slot = (arg, index) => `<span class="mq-slot" data-slot="${index}" contenteditable="true">${renderEditableExpression(arg)}</span>`;
  if (command === "frac") {
    return `<span class="mq-atom mq-frac" data-command="frac" contenteditable="false"><span class="mq-num">${slot(args[0] ?? "", 0)}</span><span class="mq-den">${slot(args[1] ?? "", 1)}</span></span>`;
  }
  if (command === "sqrt") {
    return `<span class="mq-atom mq-radical" data-command="sqrt" contenteditable="false"><span class="mq-radical-symbol">√</span><span class="mq-radicand">${slot(args[0] ?? "", 0)}</span></span>`;
  }
  if (command === "abs") {
    return `<span class="mq-atom mq-delimited" data-command="abs" contenteditable="false"><span class="mq-delimiter">|</span>${slot(args[0] ?? "", 0)}<span class="mq-delimiter">|</span></span>`;
  }
  if (command === "floor") {
    return `<span class="mq-atom mq-delimited" data-command="floor" contenteditable="false"><span class="mq-delimiter">⌊</span>${slot(args[0] ?? "", 0)}<span class="mq-delimiter">⌋</span></span>`;
  }
  if (command === "ceil") {
    return `<span class="mq-atom mq-delimited" data-command="ceil" contenteditable="false"><span class="mq-delimiter">⌈</span>${slot(args[0] ?? "", 0)}<span class="mq-delimiter">⌉</span></span>`;
  }
  const renderedArgs = args.map((arg, index) => slot(arg, index)).join('<span class="mq-separator">, </span>');
  return `<span class="mq-atom mq-call" data-command="${escapeHtml(command)}" contenteditable="false"><span class="mq-operator">${escapeHtml(LATEX_FUNCTIONS[command].display)}</span><span class="mq-paren">(</span>${renderedArgs}<span class="mq-paren">)</span></span>`;
}

function createMathAtom(command, args) {
  const wrapper = document.createElement("span");
  wrapper.innerHTML = atomEditableHtml(command, args);
  return wrapper.firstElementChild;
}

function focusMathSlot(atom, index) {
  const slot = atom.querySelector(`.mq-slot[data-slot="${index}"]`) ?? atom.querySelector(".mq-slot");
  if (!slot) return;
  const range = document.createRange();
  range.selectNodeContents(slot);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function closestMathSlot(node) {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return element?.closest?.(".mq-slot") ?? null;
}

function isCaretAtEndOf(container, range) {
  const probe = range.cloneRange();
  probe.selectNodeContents(container);
  probe.setStart(range.endContainer, range.endOffset);
  return probe.toString().length === 0;
}

function isCaretAtStartOf(container, range) {
  const probe = range.cloneRange();
  probe.selectNodeContents(container);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().length === 0;
}

function placeCaretAfterNode(node) {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretBeforeNode(node) {
  const range = document.createRange();
  range.setStartBefore(node);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertTextAtSelection(text) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStart(node, node.textContent.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function handleMathBackspace(field, event) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  const slot = closestMathSlot(range.startContainer);
  if (slot && isCaretAtStartOf(slot, range)) {
    const atom = slot.closest(".mq-atom");
    if (!atom) return false;
    event.preventDefault();
    pushEditorHistory(field);
    if (slot.textContent.trim() === "") {
      if (atom.dataset.command === "frac" && slot.dataset.slot === "1") {
        replaceAtomWithText(atom, serializeMathNode(atom.querySelector('.mq-slot[data-slot="0"]') ?? atom));
      } else if (atom.querySelectorAll(".mq-slot").length === 1) {
        atom.remove();
      } else {
        placeCaretBeforeNode(atom);
      }
    } else {
      placeCaretBeforeNode(atom);
    }
    syncMathField(field);
    field.dispatchEvent(new InputEvent("input", { bubbles: true }));
    return true;
  }
  if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) return false;
  const container = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
  const previous = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.previousSibling : container.childNodes[range.startOffset - 1];
  const atom = previous?.classList?.contains("mq-atom") ? previous : null;
  if (!atom) return false;
  event.preventDefault();
  pushEditorHistory(field);
  atom.remove();
  syncMathField(field);
  field.dispatchEvent(new InputEvent("input", { bubbles: true }));
  return true;
}

function ensureEditorHistory(field) {
  const key = field.dataset.field;
  if (!editorHistory.has(key)) {
    editorHistory.set(key, { undo: [], redo: [] });
  }
  return editorHistory.get(key);
}

function pushEditorHistory(field) {
  const history = ensureEditorHistory(field);
  history.undo.push(serializeMathField(field));
  if (history.undo.length > 100) history.undo.shift();
  history.redo = [];
}

function restoreEditorHistory(field, direction) {
  const history = ensureEditorHistory(field);
  const from = direction === "undo" ? history.undo : history.redo;
  const to = direction === "undo" ? history.redo : history.undo;
  if (!from.length) return;
  to.push(serializeMathField(field));
  const source = from.pop();
  field.innerHTML = renderEditableLatex(source);
  field.dataset.source = source;
  syncMathField(field);
  updateField(field);
  placeCaretAtEnd(field);
  const diagnostics = validateScene();
  updateStatusLights(diagnostics);
  renderScene(diagnostics);
}

function replaceAtomWithText(atom, text) {
  const node = document.createTextNode(text);
  atom.replaceWith(node);
  const range = document.createRange();
  range.setStart(node, node.textContent.length);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function serializeMathField(field) {
  return Array.from(field.childNodes).map(serializeMathNode).join("").trim();
}

function serializeMathNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return sourceFromLatexText(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  if (node.classList.contains("mq-atom")) {
    const command = node.dataset.command;
    const slots = Array.from(node.querySelectorAll(":scope > .mq-slot, :scope > .mq-num > .mq-slot, :scope > .mq-den > .mq-slot, :scope > .mq-radicand > .mq-slot")).map((slot) =>
      Array.from(slot.childNodes).map(serializeMathNode).join("")
    );
    if (command === "frac") return `frac{${slots[0] ?? ""}}{${slots[1] ?? ""}}`;
    if (command === "sqrt") return `sqrt(${slots[0] ?? ""})`;
    if (command === "abs") return `abs(${slots[0] ?? ""})`;
    if (command === "floor") return `floor(${slots[0] ?? ""})`;
    if (command === "ceil") return `ceil(${slots[0] ?? ""})`;
    const internal = LATEX_FUNCTIONS[command]?.internal ?? command;
    return `${internal}(${slots.join(",")})`;
  }
  if (node.classList.contains("mq-power")) {
    const base = node.querySelector(":scope > .mq-base");
    const exponent = node.querySelector(":scope > .mq-exponent");
    const baseSource = base ? Array.from(base.childNodes).map(serializeMathNode).join("") : "";
    const exponentSource = exponent ? Array.from(exponent.childNodes).map(serializeMathNode).join("") : "";
    return `${baseSource}^${formatPowerExponentSource(exponentSource)}`;
  }
  return Array.from(node.childNodes).map(serializeMathNode).join("");
}

function formatPowerExponentSource(source) {
  const exponent = String(source ?? "").trim();
  if (!exponent) return "";
  if (/^[A-Za-z_]\w*$|^\d+(?:\.\d+)?$/.test(exponent)) return exponent;
  if ((exponent.startsWith("(") && matchingParen(exponent, 0) === exponent.length - 1) || (exponent.startsWith("{") && matchingBrace(exponent, 0) === exponent.length - 1)) {
    return exponent;
  }
  return `(${exponent})`;
}

function updateMathSourceDisplay(field, source) {
  const raw = root.querySelector(`textarea[data-source-field="${cssEscape(field.dataset.field)}"]`);
  if (raw) raw.value = latexSourceFromExpression(source);
}

function toLatexPreview(source) {
  const normalized = normalizeExpressionDisplayText(source);
  return renderLatexExpression(normalized);
}

function convertDivisionsToFrac(source) {
  const fraction = splitTopLevelFraction(source);
  if (fraction) {
    const prefix = convertDivisionsToFrac(fraction.prefix);
    const num = convertDivisionsToFrac(stripWrappingGroup(fraction.numerator));
    const den = convertDivisionsToFrac(stripWrappingGroup(fraction.denominator));
    const suffix = convertDivisionsToFrac(fraction.suffix);
    return `${prefix}frac(${num})(${den})${suffix}`;
  }

  let output = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === "(") {
      const end = matchingParen(source, i);
      if (end !== -1) {
        const inner = source.slice(i + 1, end);
        output += `(${convertDivisionsToFrac(inner)})`;
        i = end + 1;
        continue;
      }
    }
    output += char;
    i++;
  }
  return output;
}

const STANDARD_LATEX_COMMANDS = {
  sin: "\\sin",
  cos: "\\cos",
  tan: "\\tan",
  asin: "\\arcsin",
  acos: "\\arccos",
  atan: "\\arctan",
  arcsin: "\\arcsin",
  arccos: "\\arccos",
  arctan: "\\arctan",
  arcsec: "\\operatorname{arcsec}",
  arccsc: "\\operatorname{arccsc}",
  arccot: "\\operatorname{arccot}",
  sinh: "\\sinh",
  cosh: "\\cosh",
  tanh: "\\tanh",
  sech: "\\operatorname{sech}",
  csch: "\\operatorname{csch}",
  coth: "\\operatorname{coth}",
  arcsinh: "\\operatorname{arcsinh}",
  arccosh: "\\operatorname{arccosh}",
  arctanh: "\\operatorname{arctanh}",
  arcsech: "\\operatorname{arcsech}",
  arccsch: "\\operatorname{arccsch}",
  arccoth: "\\operatorname{arccoth}",
  log: "\\log",
  ln: "\\ln",
  sqrt: "\\sqrt",
  cbrt: "\\operatorname{cbrt}",
  abs: "\\operatorname{abs}",
  sign: "\\operatorname{sign}",
  floor: "\\operatorname{floor}",
  ceil: "\\operatorname{ceil}",
  round: "\\operatorname{round}",
  exp: "\\exp",
  sec: "\\sec",
  csc: "\\csc",
  cot: "\\cot",
  min: "\\min",
  max: "\\max",
  clamp: "\\operatorname{clamp}"
};

function tokenizeLatex(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === '\\') {
      i++;
      let opMatch = source.slice(i).match(/^operatorname\s*\{([A-Za-z]\w*)\}/);
      if (opMatch) {
        tokens.push({ type: "command", value: opMatch[1] });
        i += opMatch[0].length;
        continue;
      }
      let cmdMatch = source.slice(i).match(/^[A-Za-z]+/);
      if (cmdMatch) {
        const command = cmdMatch[0];
        if (command === "cdot" || command === "times") {
          tokens.push({ type: "operator", value: "*" });
        } else {
          tokens.push({ type: "command", value: "\\" + command });
        }
        i += cmdMatch[0].length;
        continue;
      }
      continue;
    }
    let numMatch = source.slice(i).match(/^\d+(?:\.\d+)?/);
    if (numMatch) {
      tokens.push({ type: "number", value: Number(numMatch[0]) });
      i += numMatch[0].length;
      continue;
    }
    let identMatch = source.slice(i).match(/^[A-Za-z]\w*/);
    if (identMatch) {
      tokens.push({ type: "identifier", value: identMatch[0] });
      i += identMatch[0].length;
      continue;
    }
    if (char === '~') {
      let refMatch = source.slice(i).match(/^~([A-Za-z]\w*)~/);
      if (refMatch) {
        tokens.push({ type: "identifier", value: refMatch[0] });
        i += refMatch[0].length;
        continue;
      }
    }
    if (/[+\-*/^(){}[\]|,]/.test(char)) {
      tokens.push({ type: "operator", value: char });
      i++;
      continue;
    }
    tokens.push({ type: "operator", value: char });
    i++;
  }
  return tokens;
}

function tokenizeLeptonText(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    let numMatch = source.slice(i).match(/^\d+(?:\.\d+)?/);
    if (numMatch) {
      tokens.push({ type: "number", value: Number(numMatch[0]) });
      i += numMatch[0].length;
      continue;
    }
    let identMatch = source.slice(i).match(/^[A-Za-z_]\w*/);
    if (identMatch) {
      tokens.push({ type: "identifier", value: identMatch[0] });
      i += identMatch[0].length;
      continue;
    }
    if (char === '~') {
      let refMatch = source.slice(i).match(/^~([A-Za-z]\w*)~/);
      if (refMatch) {
        tokens.push({ type: "identifier", value: refMatch[0] });
        i += refMatch[0].length;
        continue;
      }
    }
    if (/[+\-*/^(){}[\]|,]/.test(char)) {
      tokens.push({ type: "operator", value: char });
      i++;
      continue;
    }
    tokens.push({ type: "operator", value: char });
    i++;
  }
  return tokens;
}

function isPrefixToken(token) {
  if (!token) return false;
  if (isTerminatorToken(token)) return false;
  return token.type === "number" ||
         token.type === "identifier" ||
         token.type === "command" ||
         (token.type === "operator" && (token.value === "(" || token.value === "{" || token.value === "[" || token.value === "|"));
}

function isTerminatorToken(token) {
  if (!token) return true;
  if (token.type === "command" && token.value === "\\right") return true;
  return token.type === "operator" && [")", "}", "]", ","].includes(token.value);
}

function getOpPrecedence(op) {
  if (op === "+" || op === "-") return 10;
  if (op === "*" || op === "/") return 20;
  if (op === "^") return 30;
  return 0;
}

function createParser(tokens, isLatexMode) {
  let index = 0;
  
  function peek() {
    return tokens[index];
  }
  
  function next() {
    return tokens[index++];
  }
  
  function consume(expectedType, expectedValue) {
    const token = peek();
    if (!token) {
      throw new Error(`Expected ${expectedType} ${expectedValue ?? ""}, but reached EOF`);
    }
    if (token.type !== expectedType || (expectedValue !== undefined && token.value !== expectedValue)) {
      throw new Error(`Expected ${expectedType} ${expectedValue ?? ""}, but got ${token.type} ${token.value}`);
    }
    return next();
  }
  
  function parsePrefix() {
    const token = next();
    if (!token) throw new Error("Unexpected end of expression");
    
    if (token.type === "number") {
      return { type: "number", value: token.value };
    }
    
    if (token.type === "identifier") {
      const name = token.value;
      
      // Support Lepton frac(a)(b) or frac{a}{b} or frac(a, b)
      if (name === "frac" && !isLatexMode) {
        const nextToken = peek();
        if (nextToken && nextToken.type === "operator") {
          if (nextToken.value === "(") {
            consume("operator", "(");
            const num = parseInfixExpression(0);
            consume("operator", ")");
            if (peek() && peek().type === "operator" && peek().value === "(") {
              consume("operator", "(");
              const den = parseInfixExpression(0);
              consume("operator", ")");
              return { type: "fraction", num, den };
            }
            return { type: "call", name: "frac", args: [num] };
          } else if (nextToken.value === "{") {
            consume("operator", "{");
            const num = parseInfixExpression(0);
            consume("operator", "}");
            consume("operator", "{");
            const den = parseInfixExpression(0);
            consume("operator", "}");
            return { type: "fraction", num, den };
          }
        }
      }
      
      // Support function call
      const nextToken = peek();
      if (nextToken && nextToken.type === "operator" && nextToken.value === "(") {
        consume("operator", "(");
        const args = [];
        if (peek() && !(peek().type === "operator" && peek().value === ")")) {
          while (true) {
            args.push(parseInfixExpression(0));
            if (peek() && peek().type === "operator" && peek().value === ",") {
              next();
            } else {
              break;
            }
          }
        }
        consume("operator", ")");
        
        if (name === "frac" && args.length === 2) {
          return { type: "fraction", num: args[0], den: args[1] };
        }
        return { type: "call", name, args };
      }
      
      return { type: "identifier", name };
    }
    
    if (token.type === "operator" && (token.value === "(" || token.value === "{" || token.value === "[")) {
      const closeChar = token.value === "(" ? ")" : token.value === "{" ? "}" : "]";
      const expr = parseInfixExpression(0);
      consume("operator", closeChar);
      return expr;
    }
    
    if (token.type === "operator" && (token.value === "-" || token.value === "+")) {
      const expr = parseInfixExpression(40);
      return { type: "unary", op: token.value, value: expr };
    }
    
    if (token.type === "command") {
      const name = token.value.startsWith("\\") ? token.value.slice(1) : token.value;
      
      // LaTeX fraction command: \frac{a}{b}
      if (name === "frac") {
        consume("operator", "{");
        const num = parseInfixExpression(0);
        consume("operator", "}");
        consume("operator", "{");
        const den = parseInfixExpression(0);
        consume("operator", "}");
        return { type: "fraction", num, den };
      }
      
      // LaTeX square root: \sqrt{a} or \sqrt[n]{a}
      if (name === "sqrt") {
        let degree = null;
        if (peek() && peek().type === "operator" && peek().value === "[") {
          consume("operator", "[");
          degree = parseInfixExpression(0);
          consume("operator", "]");
        }
        consume("operator", "{");
        const value = parseInfixExpression(0);
        consume("operator", "}");
        if (degree) {
          return { type: "call", name: "root", args: [value, degree] };
        }
        return { type: "call", name: "sqrt", args: [value] };
      }
      
      // LaTeX absolute values: \left| and \right|
      if (name === "left") {
        const delim = consume("operator");
        if (delim.value !== "|") {
          const expr = parseInfixExpression(0);
          consume("command", "\\right");
          consume("operator");
          return expr;
        }
        const expr = parseInfixExpression(0);
        consume("command", "\\right");
        consume("operator", "|");
        return { type: "call", name: "abs", args: [expr] };
      }
      
      // LaTeX delimiters
      if (name === "lvert") {
        const expr = parseInfixExpression(0);
        consume("command", "\\rvert");
        return { type: "call", name: "abs", args: [expr] };
      }
      if (name === "lfloor") {
        const expr = parseInfixExpression(0);
        consume("command", "\\rfloor");
        return { type: "call", name: "floor", args: [expr] };
      }
      if (name === "lceil") {
        const expr = parseInfixExpression(0);
        consume("command", "\\rceil");
        return { type: "call", name: "ceil", args: [expr] };
      }
      
      if (["pi", "theta", "e"].includes(name)) {
        return { type: "identifier", name };
      }
      
      let args = [];
      const nextToken = peek();
      if (nextToken && nextToken.type === "operator" && (nextToken.value === "{" || nextToken.value === "(")) {
        const openChar = nextToken.value;
        const closeChar = openChar === "{" ? "}" : ")";
        next();
        args.push(parseInfixExpression(0));
        consume("operator", closeChar);
      } else {
        args.push(parseInfixExpression(50));
      }
      return { type: "call", name, args };
    }
    
    if (token.type === "operator" && token.value === "|") {
      const expr = parseInfixExpression(0);
      consume("operator", "|");
      return { type: "call", name: "abs", args: [expr] };
    }
    
    throw new Error(`Unexpected token: ${token.type} ${token.value}`);
  }
  
  function parseInfixExpression(precedence) {
    let left = parsePrefix();
    
    while (true) {
      const nextToken = peek();
      if (isTerminatorToken(nextToken)) {
        break;
      }
      
      if (isPrefixToken(nextToken)) {
        const implicitPrecedence = 20;
        if (implicitPrecedence <= precedence) {
          break;
        }
        const right = parseInfixExpression(implicitPrecedence);
        left = { type: "binary", op: "*", left, right };
        continue;
      }
      
      const nextPrecedence = nextToken?.type === "operator" ? getOpPrecedence(nextToken.value) : 0;
      if (nextPrecedence <= precedence) {
        break;
      }
      
      const opToken = next();
      const right = parseInfixExpression(opToken.value === "^" ? nextPrecedence - 1 : nextPrecedence);
      
      if (opToken.value === "/") {
        left = { type: "fraction", num: left, den: right };
      } else {
        left = { type: "binary", op: opToken.value, left, right };
      }
    }
    
    return left;
  }
  
  const ast = parseInfixExpression(0);
  if (index < tokens.length) {
    const token = tokens[index];
    throw new Error(`Unexpected trailing token: ${token.type} ${token.value}`);
  }
  return ast;
}

function parseLatex(source) {
  const tokens = tokenizeLatex(source);
  return createParser(tokens, true);
}

function parseLeptonText(source) {
  const tokens = tokenizeLeptonText(source);
  return createParser(tokens, false);
}

function astToLatex(node) {
  if (node.type === "number") {
    return String(node.value);
  }
  if (node.type === "identifier") {
    if (node.name === "pi") return "\\pi";
    if (node.name === "theta") return "\\theta";
    return node.name;
  }
  if (node.type === "fraction") {
    return `\\frac{${astToLatex(node.num)}}{${astToLatex(node.den)}}`;
  }
  if (node.type === "unary") {
    return `${node.op}${astToLatex(node.value)}`;
  }
  if (node.type === "power") {
    return `${astToLatex(node.base)}^{${astToLatex(node.exponent)}}`;
  }
  if (node.type === "binary") {
    const op = node.op;
    let left = astToLatex(node.left);
    let right = astToLatex(node.right);
    if (node.left.type === "binary" && getOpPrecedence(node.left.op) < getOpPrecedence(op)) {
      left = `\\left(${left}\\right)`;
    }
    if (node.right.type === "binary" && getOpPrecedence(node.right.op) <= getOpPrecedence(op)) {
      right = `\\left(${right}\\right)`;
    }
    return op === "*" ? `${left}\\cdot ${right}` : `${left}${op}${right}`;
  }
  if (node.type === "call") {
    const name = node.name;
    const args = node.args.map(astToLatex);
    if (name === "abs" && args.length === 1) {
      return `\\left|${args[0]}\\right|`;
    }
    if (name === "floor" && args.length === 1) {
      return `\\lfloor{${args[0]}}\\rfloor`;
    }
    if (name === "ceil" && args.length === 1) {
      return `\\lceil{${args[0]}}\\rceil`;
    }
    if (name === "sqrt" && args.length === 1) {
      return `\\sqrt{${args[0]}}`;
    }
    const cmd = STANDARD_LATEX_COMMANDS[name] || `\\operatorname{${name}}`;
    return `${cmd}\\left(${args.join(",")}\\right)`;
  }
  return "";
}

function astToLeptonText(node) {
  if (node.type === "number") {
    return String(node.value);
  }
  if (node.type === "identifier") {
    return node.name;
  }
  if (node.type === "fraction") {
    return `{${astToLeptonText(node.num)}}/{${astToLeptonText(node.den)}}`;
  }
  if (node.type === "unary") {
    return `${node.op}${astToLeptonText(node.value)}`;
  }
  if (node.type === "power") {
    const base = astToLeptonText(node.base);
    const exponent = astToLeptonText(node.exponent);
    if (node.exponent.type === "number" || node.exponent.type === "identifier") {
      return `${base}^${exponent}`;
    }
    return `${base}^(${exponent})`;
  }
  if (node.type === "binary") {
    const op = node.op;
    let left = astToLeptonText(node.left);
    let right = astToLeptonText(node.right);
    if (node.left.type === "binary" && getOpPrecedence(node.left.op) < getOpPrecedence(op)) {
      left = `(${left})`;
    }
    if (node.right.type === "binary" && getOpPrecedence(node.right.op) <= getOpPrecedence(op)) {
      right = `(${right})`;
    }
    return `${left}${op}${right}`;
  }
  if (node.type === "call") {
    const name = node.name;
    const args = node.args.map(astToLeptonText);
    return `${name}(${args.join(",")})`;
  }
  return "";
}

function astToMathString(node) {
  if (node.type === "number") {
    return String(node.value);
  }
  if (node.type === "identifier") {
    return node.name;
  }
  if (node.type === "fraction") {
    return `frac(${astToMathString(node.num)},${astToMathString(node.den)})`;
  }
  if (node.type === "unary") {
    return `${node.op}${astToMathString(node.value)}`;
  }
  if (node.type === "power") {
    return `pow(${astToMathString(node.base)},${astToMathString(node.exponent)})`;
  }
  if (node.type === "binary") {
    const op = node.op;
    let left = astToMathString(node.left);
    let right = astToMathString(node.right);
    if (node.left.type === "binary" && getOpPrecedence(node.left.op) < getOpPrecedence(op)) {
      left = `(${left})`;
    }
    if (node.right.type === "binary" && getOpPrecedence(node.right.op) <= getOpPrecedence(op)) {
      right = `(${right})`;
    }
    return `${left}${op}${right}`;
  }
  if (node.type === "call") {
    const name = node.name;
    const args = node.args.map(astToMathString);
    return `${name}(${args.join(",")})`;
  }
  return "";
}

function astToEditableHtml(node) {
  if (node.type === "number") {
    return String(node.value);
  }
  if (node.type === "identifier") {
    return node.name;
  }
  if (node.type === "fraction") {
    return atomEditableHtml("frac", [astToLeptonText(node.num), astToLeptonText(node.den)]);
  }
  if (node.type === "unary") {
    return `${node.op}${astToEditableHtml(node.value)}`;
  }
  if (node.type === "power") {
    return `<span class="mq-power" data-command="power"><span class="mq-base">${astToEditableHtml(node.base)}</span><span class="mq-exponent">${astToEditableHtml(node.exponent)}</span></span>`;
  }
  if (node.type === "binary") {
    return `${astToEditableHtml(node.left)}${node.op}${astToEditableHtml(node.right)}`;
  }
  if (node.type === "call") {
    const name = node.name;
    const args = node.args.map(astToLeptonText);
    if (name === "abs" && args.length === 1) {
      return atomEditableHtml("abs", args);
    }
    if (name === "floor" && args.length === 1) {
      return atomEditableHtml("floor", args);
    }
    if (name === "ceil" && args.length === 1) {
      return atomEditableHtml("ceil", args);
    }
    if (name === "sqrt" && args.length === 1) {
      return atomEditableHtml("sqrt", args);
    }
    return atomEditableHtml(name, args);
  }
  return "";
}

function latexToLeptonText(value) {
  if (!value) return "";
  try {
    const ast = parseLatex(value);
    return astToLeptonText(ast);
  } catch (e) {
    return String(value);
  }
}

function latexSourceFromExpression(source) {
  if (!source) return "";
  try {
    const ast = parseLeptonText(source);
    return astToLatex(ast);
  } catch (e) {
    return String(source);
  }
}

function sourceFromLatexText(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replaceAll("π", "pi")
    .replaceAll("√", "sqrt")
    .trim();
}

function editorSourceText(field) {
  if (field.dataset.rendered === "true" && field.querySelector("[data-latex]")) {
    return sourceFromRenderedNode(field) || field.dataset.source || "";
  }
  return field.textContent ?? field.dataset.source ?? "";
}

function sourceFromRenderedNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  if (node.dataset?.latex) return node.dataset.latex;
  return Array.from(node.childNodes).map(sourceFromRenderedNode).join("");
}

function replaceLatexCommand(source, command, build) {
  let output = source;
  let marker = `\\${command}`;
  let index = output.indexOf(marker);
  while (index !== -1) {
    const args = [];
    let cursor = index + marker.length;
    while (output[cursor] === "{") {
      const end = matchingBrace(output, cursor);
      if (end === -1) break;
      args.push(output.slice(cursor + 1, end));
      cursor = end + 1;
    }
    if (!args.length) {
      index = output.indexOf(marker, index + marker.length);
      continue;
    }
    output = `${output.slice(0, index)}${build(args)}${output.slice(cursor)}`;
    index = output.indexOf(marker, index + 1);
  }
  return output;
}

function matchingBrace(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return i;
  }
  return -1;
}

function renderLatexExpression(source) {
  const trimmed = normalizeBareAbsoluteBars(source).trim();
  if (!trimmed) return "";

  const additive = splitTopLevelAdditive(trimmed);
  if (additive) {
    return `${renderLatexExpression(additive.left)}${escapeHtml(additive.operator)}${renderLatexExpression(additive.right)}`;
  }

  const fraction = splitTopLevelFraction(trimmed);
  if (fraction) {
    return `${renderLatexExpression(fraction.prefix)}${fractionHtml(renderLatexExpression(fraction.numerator), renderLatexExpression(fraction.denominator), `\\frac{${fraction.numerator}}{${fraction.denominator}}`)}${renderLatexExpression(fraction.suffix)}`;
  }

  const power = splitTopLevel(trimmed, "^");
  if (power) {
    const grouped = splitPowerOperands(trimmed, power.index);
    return `${renderLatexExpression(grouped.prefix)}${powerHtml(renderLatexExpression(grouped.base), renderLatexExpression(stripWrappingGroup(grouped.exponent)), `${grouped.base}^{${grouped.exponent}}`)}${renderLatexExpression(grouped.suffix)}`;
  }

  const latexFrac = parseLatexCommand(trimmed, "frac", 2);
  if (latexFrac) {
    return renderLatexFunction("frac", latexFrac);
  }
  const bareFrac = parseBareBraceArgs(trimmed, "frac", 2);
  if (bareFrac) {
    return renderLatexFunction("frac", bareFrac);
  }

  const latexSqrt = parseLatexCommand(trimmed, "sqrt", 1);
  if (latexSqrt) {
    return renderLatexFunction("sqrt", latexSqrt);
  }
  const bareSqrt = parseBareBraceArgs(trimmed, "sqrt", 1);
  if (bareSqrt) {
    return renderLatexFunction("sqrt", bareSqrt);
  }

  const commandIndex = nextLatexCommandIndex(trimmed);
  const internalIndex = nextInternalCallIndex(trimmed);
  const parenIndex = nextParentheticalIndex(trimmed);

  if (parenIndex !== -1 && (commandIndex === -1 || parenIndex < commandIndex) && (internalIndex === -1 || parenIndex < internalIndex)) {
    const closeIndex = matchingParen(trimmed, parenIndex);
    if (closeIndex !== -1) {
      return `${renderLatexExpression(trimmed.slice(0, parenIndex))}(${renderLatexExpression(trimmed.slice(parenIndex + 1, closeIndex))})${renderLatexExpression(trimmed.slice(closeIndex + 1))}`;
    }
  }

  if (commandIndex !== -1) {
    const parsed = parseLatexCommandAt(trimmed, commandIndex);
    if (parsed) {
      return `${renderLatexExpression(trimmed.slice(0, commandIndex))}${parsed.html}${renderLatexExpression(trimmed.slice(parsed.end))}`;
    }
  }

  if (internalIndex !== -1) {
    const parsed = parseInternalCallAt(trimmed, internalIndex);
    if (parsed) {
      return `${renderLatexExpression(trimmed.slice(0, internalIndex))}${parsed.html}${renderLatexExpression(trimmed.slice(parsed.end))}`;
    }
  }

  if (parenIndex !== -1) {
    const closeIndex = matchingParen(trimmed, parenIndex);
    if (closeIndex !== -1) {
      return `${renderLatexExpression(trimmed.slice(0, parenIndex))}(${renderLatexExpression(trimmed.slice(parenIndex + 1, closeIndex))})${renderLatexExpression(trimmed.slice(closeIndex + 1))}`;
    }
  }

  const fracCall = parseFunctionCall(trimmed, "frac");
  if (fracCall && fracCall.length === 2) {
    return fractionHtml(renderLatexExpression(fracCall[0]), renderLatexExpression(fracCall[1]), `\\frac{${fracCall[0]}}{${fracCall[1]}}`);
  }

  const sqrtCall = parseFunctionCall(trimmed, "sqrt");
  if (sqrtCall && sqrtCall.length === 1) {
    return radicalHtml(renderLatexExpression(sqrtCall[0]), `\\sqrt{${sqrtCall[0]}}`);
  }

  const absCall = parseFunctionCall(trimmed, "abs");
  if (absCall && absCall.length === 1) {
    return delimiterHtml("|", absCall[0], "|", `\\left|${absCall[0]}\\right|`);
  }

  const floorCall = parseFunctionCall(trimmed, "floor");
  if (floorCall && floorCall.length === 1) {
    return delimiterHtml("⌊", floorCall[0], "⌋", `\\lfloor${floorCall[0]}\\rfloor`);
  }

  const ceilCall = parseFunctionCall(trimmed, "ceil");
  if (ceilCall && ceilCall.length === 1) {
    return delimiterHtml("⌈", ceilCall[0], "⌉", `\\lceil${ceilCall[0]}\\rceil`);
  }

  for (const [name, config] of Object.entries(LATEX_FUNCTIONS)) {
    if (["frac", "sqrt", "abs", "floor", "ceil"].includes(name)) continue;
    const call = parseFunctionCall(trimmed, config.internal);
    if (call && call.length === config.args) {
      return renderLatexFunction(name, call);
    }
  }

  let text = escapeHtml(trimmed)
    .replaceAll(/~([A-Za-z]\w*)~/g, "<span class=\"latex-ref\">$1</span>")
    .replaceAll(/\bpi\b/g, "π")
    .replaceAll(/\^2/g, "<sup>2</sup>")
    .replaceAll(/\^3/g, "<sup>3</sup>");

  return text;
}

function nextLatexCommandIndex(source) {
  const commands = [
    ...Object.keys(LATEX_FUNCTIONS).map((command) => `\\${command}`),
    "\\left|",
    "\\lvert",
    "\\lfloor",
    "\\lceil"
  ];
  const indexes = commands.map((command) => source.indexOf(command)).filter((index) => index !== -1);
  return indexes.length ? Math.min(...indexes) : -1;
}

function nextInternalCallIndex(source) {
  const indexes = Object.values(LATEX_FUNCTIONS)
    .map((config) => source.indexOf(`${config.internal}(`))
    .filter((index) => index !== -1);
  return indexes.length ? Math.min(...indexes) : -1;
}

function nextParentheticalIndex(source) {
  let index = source.indexOf("(");
  while (index !== -1) {
    const previous = source.slice(0, index).match(/[A-Za-z_]\w*$/)?.[0] ?? "";
    if (!Object.values(LATEX_FUNCTIONS).some((config) => config.internal === previous)) return index;
    index = source.indexOf("(", index + 1);
  }
  return -1;
}

function parseInternalCallAt(source, index) {
  for (const [name, config] of Object.entries(LATEX_FUNCTIONS)) {
    const marker = `${config.internal}(`;
    if (!source.startsWith(marker, index)) continue;
    const openIndex = index + config.internal.length;
    const closeIndex = matchingParen(source, openIndex);
    if (closeIndex === -1) return null;
    const args = splitFunctionArgs(source.slice(openIndex + 1, closeIndex));
    if (args.length !== config.args) return null;
    return { end: closeIndex + 1, html: renderLatexFunction(name, args) };
  }
  return null;
}

function parseLatexCommandAt(source, index) {
  for (const command of Object.keys(LATEX_FUNCTIONS)) {
    const marker = `\\${command}`;
    if (!source.startsWith(marker, index)) continue;
    const expectedArgs = LATEX_FUNCTIONS[command].args;
    const args = [];
    let cursor = index + marker.length;
    while (args.length < expectedArgs && source[cursor] === "{") {
      const end = matchingBrace(source, cursor);
      if (end === -1) {
        args.push(source.slice(cursor + 1));
        cursor = source.length;
        break;
      }
      args.push(source.slice(cursor + 1, end));
      cursor = end + 1;
    }
    while (args.length < expectedArgs) args.push("");
    const html = renderLatexFunction(command, args);
    return { end: cursor, html };
  }
  const paired = parsePairedLatexDelimiterAt(source, index);
  if (paired) return paired;
  return null;
}

function parseLatexCommand(source, command, expectedArgs) {
  const marker = `\\${command}`;
  if (!source.startsWith(marker)) return null;
  const args = [];
  let cursor = marker.length;
  while (args.length < expectedArgs && source[cursor] === "{") {
    const end = matchingBrace(source, cursor);
    if (end === -1) return null;
    args.push(source.slice(cursor + 1, end));
    cursor = end + 1;
  }
  return args.length === expectedArgs && cursor === source.length ? args : null;
}

function parseBareBraceArgs(source, command, expectedArgs) {
  if (!source.startsWith(`${command}{`)) return null;
  const args = [];
  let cursor = command.length;
  while (args.length < expectedArgs && source[cursor] === "{") {
    const end = matchingBrace(source, cursor);
    if (end === -1) return null;
    args.push(source.slice(cursor + 1, end));
    cursor = end + 1;
  }
  return args.length === expectedArgs && cursor === source.length ? args : null;
}

function parsePairedLatexDelimiterAt(source, index) {
  const pairs = [
    { open: "\\left|", close: "\\right|", fallbackClose: "\\right", render: (inner) => delimiterHtml("|", inner, "|", `\\left|${inner}\\right|`) },
    { open: "\\lvert", close: "\\rvert", render: (inner) => delimiterHtml("|", inner, "|", `\\lvert${inner}\\rvert`) },
    { open: "\\lfloor", close: "\\rfloor", render: (inner) => delimiterHtml("⌊", inner, "⌋", `\\lfloor${inner}\\rfloor`) },
    { open: "\\lceil", close: "\\rceil", render: (inner) => delimiterHtml("⌈", inner, "⌉", `\\lceil${inner}\\rceil`) }
  ];

  for (const pair of pairs) {
    if (!source.startsWith(pair.open, index)) continue;
    const start = index + pair.open.length;
    let end = source.indexOf(pair.close, start);
    let closeLength = pair.close.length;
    if (end === -1 && pair.fallbackClose) {
      end = source.indexOf(pair.fallbackClose, start);
      closeLength = pair.fallbackClose.length;
    }
    if (end === -1) return null;
    const inner = source.slice(start, end);
    return { end: end + closeLength, html: pair.render(inner) };
  }
  return null;
}

function renderLatexFunction(command, args) {
  const latex = `\\${command}${args.map((arg) => `{${arg}}`).join("")}`;
  if (command === "frac") {
    return fractionHtml(renderLatexExpression(args[0]), renderLatexExpression(args[1]), latex);
  }
  if (command === "sqrt") {
    return radicalHtml(renderLatexExpression(args[0]), latex);
  }
  if (command === "abs") {
    return delimiterHtml("|", args[0], "|", latex);
  }
  if (command === "floor") {
    return delimiterHtml("⌊", args[0], "⌋", latex);
  }
  if (command === "ceil") {
    return delimiterHtml("⌈", args[0], "⌉", latex);
  }

  const renderedArgs = args.map(renderLatexExpression).join(", ");
  return `<span class="latex-call" data-latex="${escapeHtml(latex)}"><span class="latex-operator">${escapeHtml(LATEX_FUNCTIONS[command].display)}</span><span class="latex-paren">(</span>${renderedArgs}<span class="latex-paren">)</span></span>`;
}

function powerHtml(base, exponent, latex) {
  return `<span class="latex-power" data-latex="${escapeHtml(latex)}">${base}<sup>${exponent || "&nbsp;"}</sup></span>`;
}

function fractionHtml(top, bottom, latex = null) {
  latex ??= `\\frac{${sourceFromRenderedHtml(top)}}{${sourceFromRenderedHtml(bottom)}}`;
  return `<span class="latex-frac" data-latex="${escapeHtml(latex)}"><span class="latex-num">${top || "&nbsp;"}</span><span class="latex-den">${bottom || "&nbsp;"}</span></span>`;
}

function radicalHtml(inner, latex = null) {
  return `<span class="latex-radical" data-latex="${escapeHtml(latex ?? `\\sqrt{${sourceFromRenderedHtml(inner)}}`)}"><span class="latex-radical-symbol">√</span><span class="latex-radicand">${inner || "&nbsp;"}</span></span>`;
}

function delimiterHtml(open, innerSource, close, latex) {
  return `<span class="latex-delimited" data-latex="${escapeHtml(latex)}"><span class="latex-delimiter">${escapeHtml(open)}</span><span class="latex-delimited-inner">${renderLatexExpression(innerSource)}</span><span class="latex-delimiter">${escapeHtml(close)}</span></span>`;
}

function sourceFromRenderedHtml(html) {
  return String(html)
    .replaceAll(/<span[^>]*data-latex="([^"]*)"[^>]*>.*?<\/span>/g, (_, latex) => unescapeHtml(latex))
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", "")
    .trim();
}

function splitTopLevel(source, operator) {
  let depth = 0;
  let braceDepth = 0;
  for (let i = source.length - 1; i >= 0; i -= 1) {
    const char = source[i];
    if (char === ")") depth += 1;
    if (char === "(") depth -= 1;
    if (char === "}") braceDepth += 1;
    if (char === "{") braceDepth -= 1;
    if (depth === 0 && braceDepth === 0 && char === operator) {
      return Object.assign([source.slice(0, i), source.slice(i + 1)], { index: i });
    }
  }
  return null;
}

function splitTopLevelFraction(source) {
  const division = splitTopLevel(source, "/");
  if (!division) return null;
  const left = splitPreviousOperand(source, division.index);
  const right = splitNextOperand(source, division.index + 1);
  return {
    prefix: source.slice(0, left.start),
    numerator: source.slice(left.start, division.index),
    denominator: source.slice(division.index + 1, right.end),
    suffix: source.slice(right.end)
  };
}

function splitPowerOperands(source, operatorIndex) {
  const left = splitPreviousOperand(source, operatorIndex);
  const right = splitNextOperand(source, operatorIndex + 1, { includeSignedNumber: true });
  return {
    prefix: source.slice(0, left.start),
    base: source.slice(left.start, operatorIndex),
    exponent: source.slice(operatorIndex + 1, right.end),
    suffix: source.slice(right.end)
  };
}

function splitPreviousOperand(source, operatorIndex) {
  let cursor = operatorIndex - 1;
  while (cursor >= 0 && /\s/.test(source[cursor])) cursor -= 1;
  if (cursor < 0) return { start: 0 };

  if (source[cursor] === ")" || source[cursor] === "}") {
    const close = source[cursor];
    const open = close === ")" ? "(" : "{";
    let depth = 0;
    for (let i = cursor; i >= 0; i -= 1) {
      if (source[i] === close) depth += 1;
      if (source[i] === open) depth -= 1;
      if (depth === 0) {
        const nameStart = scanIdentifierStart(source, i - 1);
        let start = nameStart ?? i;
        if (source[start - 1] === "^") {
          start = splitPreviousOperand(source, start - 1).start;
        }
        return { start };
      }
    }
    return { start: 0 };
  }

  if (isIdentifierChar(source[cursor])) {
    return { start: scanIdentifierStart(source, cursor) ?? cursor };
  }

  while (cursor >= 0 && /[\d.]/.test(source[cursor])) cursor -= 1;
  return { start: cursor + 1 };
}

function splitNextOperand(source, startIndex, options = {}) {
  let cursor = startIndex;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;

  if (options.includeSignedNumber && (source[cursor] === "+" || source[cursor] === "-")) {
    const next = source[cursor + 1];
    if (next === "(" || next === "{" || /[\d.A-Za-z_\\]/.test(next ?? "")) cursor += 1;
  }

  if (source[cursor] === "(" || source[cursor] === "{") {
    const end = source[cursor] === "(" ? matchingParen(source, cursor) : matchingBrace(source, cursor);
    return { end: end === -1 ? source.length : end + 1 };
  }

  if (source[cursor] === "\\") {
    const command = source.slice(cursor + 1).match(/^[A-Za-z]+/)?.[0] ?? "";
    let end = cursor + 1 + command.length;
    while (source[end] === "{") {
      const close = matchingBrace(source, end);
      if (close === -1) return { end: source.length };
      end = close + 1;
    }
    return { end };
  }

  if (isIdentifierStart(source[cursor])) {
    let end = cursor + 1;
    while (isIdentifierChar(source[end])) end += 1;
    if (source[end] === "(") {
      const close = matchingParen(source, end);
      return { end: close === -1 ? source.length : close + 1 };
    }
    while (source[end] === "{") {
      const close = matchingBrace(source, end);
      if (close === -1) return { end: source.length };
      end = close + 1;
    }
    return { end };
  }

  while (cursor < source.length && /[\d.]/.test(source[cursor])) cursor += 1;
  return { end: cursor };
}

function scanIdentifierStart(source, index) {
  if (!isIdentifierChar(source[index])) return null;
  let cursor = index;
  while (cursor >= 0 && isIdentifierChar(source[cursor])) cursor -= 1;
  return cursor + 1;
}

function isIdentifierStart(char) {
  return /[A-Za-z_]/.test(char ?? "");
}

function isIdentifierChar(char) {
  return /[A-Za-z0-9_]/.test(char ?? "");
}

function splitTopLevelAdditive(source) {
  let depth = 0;
  let braceDepth = 0;
  for (let i = source.length - 1; i > 0; i -= 1) {
    const char = source[i];
    if (char === ")") depth += 1;
    if (char === "(") depth -= 1;
    if (char === "}") braceDepth += 1;
    if (char === "{") braceDepth -= 1;
    if (depth === 0 && braceDepth === 0 && (char === "+" || char === "-") && !isUnaryOperator(source, i)) {
      return { left: source.slice(0, i), operator: char, right: source.slice(i + 1) };
    }
  }
  return null;
}

function isUnaryOperator(source, index) {
  const previous = source.slice(0, index).trim().at(-1);
  return !previous || "+-*/^(,".includes(previous);
}

function stripWrappingGroup(source) {
  const trimmed = String(source ?? "").trim();
  if (trimmed.startsWith("(") && matchingParen(trimmed, 0) === trimmed.length - 1) return trimmed.slice(1, -1);
  if (trimmed.startsWith("{") && matchingBrace(trimmed, 0) === trimmed.length - 1) return trimmed.slice(1, -1);
  return trimmed;
}

function parseFunctionCall(source, name) {
  if (!source.startsWith(`${name}(`) || !source.endsWith(")")) return null;
  const closeIndex = matchingParen(source, name.length);
  if (closeIndex !== source.length - 1) return null;
  const inner = source.slice(name.length + 1, -1);
  return splitFunctionArgs(inner);
}

function splitFunctionArgs(inner) {
  const args = [];
  let depth = 0;
  let braceDepth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "{") braceDepth += 1;
    if (char === "}") braceDepth -= 1;
    if (char === "," && depth === 0 && braceDepth === 0) {
      args.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  args.push(inner.slice(start));
  return args;
}

function matchingParen(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === "(") depth += 1;
    if (source[i] === ")") depth -= 1;
    if (depth === 0) return i;
  }
  return -1;
}

function formatLeptonBoolean(value) {
  return value ? "True" : "False";
}

function parseLeptonBoolean(value) {
  return /^(true|1|yes)$/i.test(String(value ?? "").trim());
}

function normalizeTimeMode(value) {
  const mode = String(value ?? "").trim().toLowerCase().replaceAll(/\s+/g, "_");
  return TIME_VARIABLE_MODES.has(mode) ? mode : "bounded";
}

function normalizeAngleMode(value) {
  const mode = String(value ?? "").trim().toLowerCase();
  if (mode.startsWith("degree")) return "degrees";
  if (mode.startsWith("radian")) return "radians";
  return "radians";
}

function setSceneSetting(target, key, value) {
  const settingMap = {
    x_min: "xMin",
    x_max: "xMax",
    y_min: "yMin",
    y_max: "yMax",
    max_recursion: "maxRecursion",
    angle_mode: "angleMode",
    background_color: "backgroundColor",
    ensure_square_grid: "ensureSquareGrid",
    aspect_ratio: "aspectRatio",
    draw_only_inside_boundary: "drawOnlyInsideBoundary",
    unbounded_decimal_places: "unboundedDecimalPlaces",
    unbounded_integer_digits: "unboundedIntegerDigits"
  };
  const mapped = settingMap[String(key ?? "").trim()];
  if (!mapped) return;
  if (mapped === "angleMode") {
    target.settings[mapped] = normalizeAngleMode(value);
  } else if (mapped === "backgroundColor") {
    target.settings[mapped] = String(value ?? "").trim() || "0";
  } else if (["ensureSquareGrid", "drawOnlyInsideBoundary"].includes(mapped)) {
    target.settings[mapped] = parseLeptonBoolean(value);
  } else if (mapped === "aspectRatio") {
    target.settings[mapped] = String(value ?? "").trim() || "1:1";
  } else if (["maxRecursion", "unboundedDecimalPlaces", "unboundedIntegerDigits"].includes(mapped)) {
    const number = Number(value);
    if (Number.isFinite(number)) target.settings[mapped] = number;
  } else {
    target.settings[mapped] = String(value ?? "").trim();
  }
}

function exportScene() {
  return [
    `set x_min = ${scene.settings.xMin}`,
    `set x_max = ${scene.settings.xMax}`,
    `set y_min = ${scene.settings.yMin}`,
    `set y_max = ${scene.settings.yMax}`,
    `set max_recursion = ${scene.settings.maxRecursion}`,
    `set angle_mode = ${normalizeAngleMode(scene.settings.angleMode)}`,
    `set background_color = ${scene.settings.backgroundColor ?? "0"}`,
    `set ensure_square_grid = ${formatLeptonBoolean(scene.settings.ensureSquareGrid !== false)}`,
    `set aspect_ratio = ${scene.settings.aspectRatio ?? "1:1"}`,
    `set draw_only_inside_boundary = ${formatLeptonBoolean(Boolean(scene.settings.drawOnlyInsideBoundary))}`,
    `set unbounded_decimal_places = ${clampInteger(scene.settings.unboundedDecimalPlaces ?? 3, 0, 12)}`,
    `set unbounded_integer_digits = ${clampInteger(scene.settings.unboundedIntegerDigits ?? 1, 1, 24)}`,
    ...scene.functions.map(exportFunctionEntry),
    ...scene.colors.map((entry) => `colour ${entry.id} = ${textModeExpression(entry.red)}~${textModeExpression(entry.green)}~${textModeExpression(entry.blue)}`),
    ...scene.restrictions.map((entry) => `boundary ${entry.id} = ${textModeExpression(entry.expression)}~${formatLeptonBoolean(entry.checkSmaller)}`),
    ...scene.draws.map((entry) => `draw(${entry.equationId},${entry.colorId},${entry.restrictionId},${formatLeptonBoolean(entry.hidden)})`)
  ].join("\n");
}

function exportFunctionEntry(rawEntry) {
  const entry = normalizeFunctionEntry(rawEntry);
  const expression = textModeExpression(entry.expression);
  if (entry.kind === "slider") {
    const range = entry.time && normalizeTimeMode(entry.timeMode) === "unbounded" ? "" : ` range ${textModeExpression(entry.sliderMin)}~${textModeExpression(entry.sliderMax)}`;
    return entry.time ? `time ${entry.timeMode} ${entry.id} = ${expression}${range}` : `slider ${entry.id} = ${expression}${range}`;
  }
  if (entry.kind === "function") {
    return `function ${entry.id}(${entry.params.join(",")}) = ${expression}`;
  }
  return `variable ${entry.id} = ${expression}`;
}

function splitSliderRange(source) {
  const match = String(source ?? "").match(/^(.*?)(?:\s+range\s+(.+?)\s*~\s*(.+))?$/i);
  return {
    expression: (match?.[1] ?? source ?? "").trim(),
    sliderMin: (match?.[2] ?? "0").trim(),
    sliderMax: (match?.[3] ?? "10").trim()
  };
}

function wrapIfNeeded(expr) {
  const trimmed = expr.trim();
  if (trimmed.startsWith("(") && matchingParen(trimmed, 0) === trimmed.length - 1) {
    return trimmed;
  }
  let depth = 0;
  let braceDepth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "{") braceDepth++;
    if (char === "}") braceDepth--;
    if (depth === 0 && braceDepth === 0) {
      if (char === "+" || char === "-" || char === "*" || char === "/") {
        return `(${trimmed})`;
      }
    }
  }
  return trimmed;
}

function convertFracToDivisions(source) {
  let output = "";
  let i = 0;
  while (i < source.length) {
    if (source.startsWith("frac{", i)) {
      const startBrace = i + 4;
      const endBrace1 = matchingBrace(source, startBrace);
      if (endBrace1 !== -1 && source[endBrace1 + 1] === "{") {
        const startBrace2 = endBrace1 + 1;
        const endBrace2 = matchingBrace(source, startBrace2);
        if (endBrace2 !== -1) {
          const num = convertFracToDivisions(source.slice(startBrace + 1, endBrace1));
          const den = convertFracToDivisions(source.slice(startBrace2 + 1, endBrace2));
          output += `{${num}}/{${den}}`;
          i = endBrace2 + 1;
          continue;
        }
      }
    } else if (source.startsWith("frac(", i)) {
      const startParen = i + 4;
      const endParen1 = matchingParen(source, startParen);
      if (endParen1 !== -1 && source[endParen1 + 1] === "(") {
        const startParen2 = endParen1 + 1;
        const endParen2 = matchingParen(source, startParen2);
        if (endParen2 !== -1) {
          const num = convertFracToDivisions(source.slice(startParen + 1, endParen1));
          const den = convertFracToDivisions(source.slice(startParen2 + 1, endParen2));
          output += `{${num}}/{${den}}`;
          i = endParen2 + 1;
          continue;
        }
      }
    }
    output += source[i];
    i++;
  }
  return output;
}

function textModeExpression(source) {
  const normalized = normalizeExpressionText(source);
  return convertFracToDivisions(normalized);
}

function importScene(raw) {
  const next = structuredClone(DEFAULT_SCENE);
  next.functions = [];
  next.colors = [];
  next.restrictions = [];
  next.draws = [];

  for (const line of raw.replace(/\r\n/g, "\n").trim().split("\n")) {
    if (!line || line === "~~~~~") continue;
    if (line.startsWith("F:")) {
      const [id, expression] = splitFirst(line.slice(2), "~");
      next.functions.push({ id, kind: "variable", expression: convertDivisionsToFrac(expression) });
    } else if (line.startsWith("C:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [red = "0", green = "0", blue = "0"] = rest.split("~");
      next.colors.push({ id, red, green, blue });
    } else if (line.startsWith("R:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [expression = "1", flag = "0"] = rest.split("~");
      next.restrictions.push({ id, expression: convertDivisionsToFrac(expression), checkSmaller: parseLeptonBoolean(flag) });
    } else if (line.startsWith("D~")) {
      const [, equationId, colorId, restrictionId, hidden = "0"] = line.split("~");
      next.draws.push({ equationId, colorId, restrictionId, hidden: parseLeptonBoolean(hidden) });
    } else if (line.startsWith("S:")) {
      const [key, value] = splitFirst(line.slice(2), "~");
      setSceneSetting(next, key, value);
    } else if (/^set\s+/i.test(line)) {
      const assignment = line.match(/^set\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) setSceneSetting(next, assignment[1], assignment[2]);
    } else if (/^variable\s+/i.test(line)) {
      const assignment = line.match(/^variable\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) next.functions.push({ id: assignment[1], kind: "variable", expression: convertDivisionsToFrac(assignment[2].trim()) });
    } else if (/^(slider|time)\s+/i.test(line)) {
      const assignment = line.match(/^(slider|time)(?:\s+(bounded_looped|bounded looped|bounded|unbounded))?\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) {
        const time = assignment[1].toLowerCase() === "time";
        const timeMode = normalizeTimeMode(assignment[2]);
        const range = splitSliderRange(assignment[4]);
        next.functions.push({
          id: assignment[3],
          kind: "slider",
          expression: convertDivisionsToFrac(range.expression),
          sliderMin: convertDivisionsToFrac(range.sliderMin),
          sliderMax: convertDivisionsToFrac(range.sliderMax),
          time,
          timeMode
        });
      }
    } else if (/^function\s+/i.test(line)) {
      const callAssignment = line.match(/^function\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*=\s*(.+)$/i);
      if (callAssignment) {
        next.functions.push({
          id: callAssignment[1],
          kind: "function",
          params: parseFunctionParams(callAssignment[2]),
          expression: convertDivisionsToFrac(callAssignment[3].trim())
        });
      } else {
        const assignment = line.match(/^function\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
        if (assignment) next.functions.push({ id: assignment[1], kind: "variable", expression: convertDivisionsToFrac(assignment[2].trim()) });
      }
    } else if (/^(colour|color)\s+/i.test(line)) {
      const assignment = line.match(/^(?:colour|color)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) {
        const [red = "0", green = "0", blue = "0"] = assignment[2].split("~").map((part) => part.trim());
        next.colors.push({ id: assignment[1], red, green, blue });
      }
    } else if (/^(boundary|restriction)\s+/i.test(line)) {
      const assignment = line.match(/^(?:boundary|restriction)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) {
        const [expression = "1", flag = "False"] = assignment[2].split("~").map((part) => part.trim());
        next.restrictions.push({ id: assignment[1], expression: convertDivisionsToFrac(expression), checkSmaller: parseLeptonBoolean(flag) });
      }
    } else if (/^draw\s*\(/i.test(line)) {
      const call = line.match(/^draw\s*\((.*)\)\s*$/i);
      if (call) {
        const [equationId = "", colorId = "", restrictionId = "", hidden = "False"] = splitFunctionArgs(call[1]).map((part) => part.trim());
        next.draws.push({ equationId, colorId, restrictionId, hidden: parseLeptonBoolean(hidden) });
      }
    }
  }

  return normalizeSceneReferences(next);
}

function normalizeSceneReferences(next) {
  const hasFunction = (id) => next.functions.some((entry) => entry.id === id);
  const ensureFunction = (preferredId, expression) => {
    const trimmed = String(expression ?? "").trim();
    if (hasFunction(trimmed)) return trimmed;
    let id = preferredId;
    let suffix = 2;
    while (hasFunction(id)) {
      id = `${preferredId}${suffix}`;
      suffix += 1;
    }
    next.functions.push({ id, kind: "variable", expression: trimmed || "0" });
    return id;
  };

  next.colors.forEach((color) => {
    color.red = ensureFunction(`${color.id}_r`, color.red);
    color.green = ensureFunction(`${color.id}_g`, color.green);
    color.blue = ensureFunction(`${color.id}_b`, color.blue);
  });
  next.restrictions.forEach((restriction) => {
    restriction.expression = ensureFunction(`${restriction.id}_fn`, restriction.expression);
  });
  if (next.settings.backgroundColor !== "0" && !next.colors.some((color) => color.id === next.settings.backgroundColor)) {
    next.settings.backgroundColor = "0";
  }
  return next;
}

function stripChannelPrefix(value) {
  return value.replace(/^[rgb]\s*=\s*/, "").trim();
}

function normalizeExpressionText(value) {
  const display = normalizeExpressionDisplayText(value);
  return latexToExpression(display);
}

function normalizeExpressionDisplayText(value) {
  const stripped = stripChannelPrefix(stripLatexStretchParens(value));
  const assignment = parseAssignment(stripped);
  return assignment ? assignment.expression : stripped;
}

function stripLatexStretchParens(value) {
  return String(value ?? "")
    .replaceAll(/\\left\s*\(/g, "(")
    .replaceAll(/\\right\s*\)/g, ")")
    .replaceAll(/\\left\s*\[/g, "[")
    .replaceAll(/\\right\s*\]/g, "]");
}

function normalizeBareAbsoluteBars(value) {
  const parsed = parseBareAbsoluteSegment(String(value ?? ""), 0, false);
  return parsed.text;
}

function parseBareAbsoluteSegment(source, start, insideAbsolute) {
  let output = "";
  let index = start;

  while (index < source.length) {
    if (source[index] !== "|") {
      output += source[index];
      index += 1;
      continue;
    }

    if (isLatexCommandPipe(source, index)) {
      output += source[index];
      index += 1;
      continue;
    }

    if (insideAbsolute && shouldCloseBareAbsolute(output)) {
      return { text: output, index, closed: true };
    }

    const nested = parseBareAbsoluteSegment(source, index + 1, true);
    if (!nested.closed) {
      output += `|${nested.text}`;
      index = nested.index;
      continue;
    }
    output += `abs(${nested.text.trim()})`;
    index = nested.index + 1;
  }

  return { text: output, index, closed: false };
}

function shouldCloseBareAbsolute(segment) {
  const previous = String(segment ?? "").trim().at(-1);
  return Boolean(previous && !/[+\-*/^(,]/.test(previous));
}

function isLatexCommandPipe(source, index) {
  const prefix = source.slice(0, index);
  return prefix.endsWith("\\left") || prefix.endsWith("\\right");
}

function latexToExpression(value) {
  if (!value) return "";
  const trimmed = normalizeBareAbsoluteBars(String(value).trim());
  try {
    const ast = trimmed.includes("\\")
      ? parseLatex(trimmed)
      : parseLeptonText(trimmed);
    return astToMathString(ast);
  } catch (e) {
    return trimmed;
  }
}

function replaceBareBraceCommand(source, command, expectedArgs, build) {
  let output = source;
  let index = output.indexOf(`${command}{`);
  while (index !== -1) {
    const before = output[index - 1] ?? "";
    if (/[A-Za-z_\\]/.test(before)) {
      index = output.indexOf(`${command}{`, index + command.length);
      continue;
    }
    const args = [];
    let cursor = index + command.length;
    while (args.length < expectedArgs && output[cursor] === "{") {
      const end = matchingBrace(output, cursor);
      if (end === -1) break;
      args.push(output.slice(cursor + 1, end));
      cursor = end + 1;
    }
    if (args.length !== expectedArgs) {
      index = output.indexOf(`${command}{`, index + command.length);
      continue;
    }
    output = `${output.slice(0, index)}${build(args)}${output.slice(cursor)}`;
    index = output.indexOf(`${command}{`, index + 1);
  }
  return output;
}

function replaceLatexDelimited(source, open, close, build) {
  let output = source;
  let start = output.indexOf(open);
  while (start !== -1) {
    const innerStart = start + open.length;
    const end = output.indexOf(close, innerStart);
    if (end === -1) break;
    const inner = output.slice(innerStart, end);
    output = `${output.slice(0, start)}${build(inner)}${output.slice(end + close.length)}`;
    start = output.indexOf(open, start + 1);
  }
  return output;
}

function parseAssignment(value) {
  const assignment = value.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.+)$/);
  return assignment ? { id: assignment[1], expression: assignment[2].trim() } : null;
}

function attachRuntimeGuard(env) {
  Object.defineProperty(env, "__runtime", {
    value: { depth: 0, maxDepth: recursionLimit() },
    enumerable: false,
    configurable: true
  });
  return env;
}

function sceneViewport() {
  const rawViewport = {
    xMin: evaluateScalarSetting(scene.settings.xMin),
    xMax: evaluateScalarSetting(scene.settings.xMax),
    yMin: evaluateScalarSetting(scene.settings.yMin),
    yMax: evaluateScalarSetting(scene.settings.yMax)
  };
  return scene.settings.ensureSquareGrid === false ? rawViewport : applyAspectRatioToViewport(rawViewport);
}

function evaluateScalarSetting(source) {
  const text = String(source ?? "").trim();
  if (!text) return NaN;
  const direct = Number(text);
  if (Number.isFinite(direct)) return direct;
  try {
    const env = buildRuntimeEnv(sceneFunctionEnv(true));
    const value = compileExpression(text)(0, 0, env);
    return Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}

function aspectRatioValue() {
  const ratio = parseAspectRatioSetting();
  return ratio.valid ? ratio.value : 1;
}

function parseAspectRatioSetting() {
  const raw = String(scene.settings.aspectRatio ?? "1:1").trim();
  const parts = raw.split(":");
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
    return { valid: false, value: 1, message: "Invalid aspect ratio: use two positive values separated by a colon" };
  }
  const width = evaluateScalarSetting(parts[0]);
  const height = evaluateScalarSetting(parts[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { valid: false, value: 1, message: "Invalid aspect ratio: both sides must evaluate to positive numbers" };
  }
  return { valid: true, value: width / height, message: "Aspect ratio is valid" };
}

function applyAspectRatioToViewport(candidate) {
  if (!isValidViewport(candidate)) return candidate;
  const ratio = aspectRatioValue();
  const xRange = candidate.xMax - candidate.xMin;
  const yRange = candidate.yMax - candidate.yMin;
  const currentRatio = xRange / Math.max(Number.EPSILON, yRange);
  const centerX = (candidate.xMin + candidate.xMax) / 2;
  const centerY = (candidate.yMin + candidate.yMax) / 2;

  if (currentRatio < ratio) {
    const adjustedX = yRange * ratio;
    return {
      xMin: centerX - adjustedX / 2,
      xMax: centerX + adjustedX / 2,
      yMin: candidate.yMin,
      yMax: candidate.yMax
    };
  }

  const adjustedY = xRange / ratio;
  return {
    xMin: candidate.xMin,
    xMax: candidate.xMax,
    yMin: centerY - adjustedY / 2,
    yMax: centerY + adjustedY / 2
  };
}

function loadViewport(reset = false) {
  if (reset) {
    localStorage.removeItem("lepton-viewport");
    return sceneViewport();
  }
  try {
    const stored = JSON.parse(localStorage.getItem("lepton-viewport") ?? "null");
    if (stored && ["xMin", "xMax", "yMin", "yMax"].every((key) => Number.isFinite(stored[key]))) {
      return stored;
    }
  } catch {
    localStorage.removeItem("lepton-viewport");
  }
  return sceneViewport();
}

function saveViewport() {
  localStorage.setItem("lepton-viewport", JSON.stringify(viewport));
}

function recursionLimit() {
  const raw = Number(scene.settings.maxRecursion);
  return Math.max(1, Math.min(1000, Number.isFinite(raw) ? Math.trunc(raw) : 100));
}

function getCaretOffset(element) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return element.textContent?.length ?? 0;
  const range = selection.getRangeAt(0);
  const clone = range.cloneRange();
  clone.selectNodeContents(element);
  clone.setEnd(range.endContainer, range.endOffset);
  return clone.toString().length;
}

function setCaretOffset(element, offset) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let remaining = offset;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (remaining <= node.textContent.length) {
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= node.textContent.length;
    node = walker.nextNode();
  }
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtEnd(element) {
  setCaretOffset(element, element.textContent?.length ?? 0);
}

function cssEscape(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function splitFirst(text, delimiter) {
  const index = text.indexOf(delimiter);
  return index === -1 ? [text, ""] : [text.slice(0, index), text.slice(index + delimiter.length)];
}

function channel(value) {
  return Math.max(0, Math.min(255, Math.trunc(Number.isFinite(value) ? value : 0)));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function highlightLeptonText(source) {
  const text = String(source ?? "");
  const context = {
    declaredIds: collectTextDeclaredIdentifiers(text)
  };
  return text.split("\n").map((line) => highlightLeptonLine(line, context)).join("\n");
}

function collectTextDeclaredIdentifiers(source) {
  const ids = new Set();
  String(source ?? "").split("\n").forEach((line) => {
    const code = line.split("#")[0] ?? "";
    const declaration = code.match(/^\s*(?:variable|slider|function|colour|color|boundary|restriction)\s+([A-Za-z_]\w*)/i);
    if (declaration) ids.add(declaration[1]);
    const time = code.match(/^\s*time\s+(?:bounded|unbounded|bounded_looped)\s+([A-Za-z_]\w*)/i);
    if (time) ids.add(time[1]);
  });
  return ids;
}

function highlightLeptonLine(line, context = { declaredIds: new Set() }) {
  const commentIndex = line.indexOf("#");
  const code = commentIndex === -1 ? line : line.slice(0, commentIndex);
  const comment = commentIndex === -1 ? "" : line.slice(commentIndex);
  return highlightLeptonCode(code, context) + (comment ? `<span class="syntax-comment">${escapeHtml(comment)}</span>` : "");
}

function highlightLeptonCode(line, context = { declaredIds: new Set() }) {
  const declaration = line.match(/^(\s*)(set|variable|slider|time|function|colour|color|boundary|restriction)(\b)/i);
  if (declaration) {
    const prefix = escapeHtml(declaration[1]);
    const keyword = declaration[2].toLowerCase();
    const rest = line.slice(declaration[1].length + keyword.length);
    return `${prefix}<span class="syntax-keyword">${declaration[2]}</span>${highlightLeptonTokens(rest, {
      ...context,
      markFirstNameAsSetting: keyword === "set"
    })}`;
  }
  const draw = line.match(/^(\s*)(draw)(\s*\()(.*)$/i);
  if (draw) {
    return `${escapeHtml(draw[1])}<span class="syntax-keyword">${draw[2]}</span><span class="syntax-operator">${escapeHtml(draw[3])}</span>${highlightLeptonTokens(draw[4], context)}`;
  }
  return highlightLeptonTokens(line, context);
}

function highlightLeptonTokens(source, context = { declaredIds: new Set() }) {
  let output = "";
  let index = 0;
  let firstName = true;
  while (index < source.length) {
    const rest = source.slice(index);
    const number = rest.match(/^\d+(?:\.\d+)?/);
    if (number) {
      output += `<span class="syntax-number">${escapeHtml(number[0])}</span>`;
      index += number[0].length;
      continue;
    }
    const name = rest.match(/^[A-Za-z_]\w*/);
    if (name) {
      const token = name[0];
      let cls = "syntax-name";
      if (context.markFirstNameAsSetting && firstName) {
        cls = "syntax-setting";
      } else if (/^(True|False|true|false|bounded|unbounded|bounded_looped|radians|degrees|default)$/.test(token)) {
        cls = "syntax-boolean";
      } else if (FUNCTION_TEXT_NAMES.has(token)) {
        cls = "syntax-function";
      } else if (!context.declaredIds?.has(token) && (token === "pi" || token === "e")) {
        cls = "syntax-number";
      }
      output += `<span class="${cls}">${escapeHtml(token)}</span>`;
      firstName = false;
      index += token.length;
      continue;
    }
    const char = source[index];
    if ("=~,+-*/^():".includes(char)) {
      output += `<span class="syntax-operator">${escapeHtml(char)}</span>`;
    } else {
      output += escapeHtml(char);
    }
    index += 1;
  }
  return output;
}

function unescapeHtml(value) {
  return String(value)
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function loadSavedGraphs() {
  try {
    const raw = localStorage.getItem(SAVED_GRAPHS_KEY);
    const parsed = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeSavedGraph)
      .filter(Boolean)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  } catch {
    return [];
  }
}

function normalizeSavedGraph(graph) {
  if (!graph || typeof graph !== "object") return null;
  const id = String(graph.id ?? "");
  const name = String(graph.name ?? "").trim();
  const savedScene = String(graph.scene ?? "").trim();
  if (!id || !name || !savedScene) return null;
  return {
    id,
    name,
    scene: savedScene,
    thumbnail: String(graph.thumbnail ?? "") || fallbackSavedGraphThumbnail(),
    createdAt: String(graph.createdAt ?? new Date().toISOString())
  };
}

function writeSavedGraphs(graphs) {
  localStorage.setItem(SAVED_GRAPHS_KEY, JSON.stringify(graphs.slice(0, 60)));
}

function saveCurrentGraph(name) {
  const graph = {
    id: createSavedGraphId(),
    name,
    scene: exportScene(),
    thumbnail: captureGraphThumbnail(),
    createdAt: new Date().toISOString()
  };
  writeSavedGraphs([graph, ...loadSavedGraphs()]);
  markSaved();
  return graph;
}

function deleteSavedGraph(id) {
  writeSavedGraphs(loadSavedGraphs().filter((graph) => graph.id !== id));
}

function defaultSavedGraphName() {
  return `Graph ${loadSavedGraphs().length + 1}`;
}

function createSavedGraphId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `graph-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function captureGraphThumbnail() {
  try {
    const canvas = root.querySelector(".grid-canvas");
    if (!canvas || !canvas.width || !canvas.height) return fallbackSavedGraphThumbnail();
    return canvas.toDataURL("image/png");
  } catch {
    return fallbackSavedGraphThumbnail();
  }
}

function fallbackSavedGraphThumbnail() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#111827"/><path d="M0 70 C30 20 52 88 78 45 S125 62 160 24" fill="none" stroke="#8ec5ff" stroke-width="5"/><path d="M0 86 C36 42 58 98 94 58 S128 76 160 48" fill="none" stroke="#f6b35e" stroke-width="3"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

window.__leptonDebug = {
  latexToExpression,
  renderEditableLatex,
  serializeMathField,
  scene: () => structuredClone(scene)
};

window.addEventListener("resize", () => {
  reflowMathLayout(root);
  requestAnimationFrame(() => reflowMathLayout(root));
  renderScene();
});
document.addEventListener("keydown", handleGlobalHistoryKeydown);
document.addEventListener("selectionchange", () => requestAnimationFrame(handleDocumentSelectionScroll));
document.addEventListener("pointermove", handleDocumentPointerScroll);
document.addEventListener("pointerup", stopSelectionPointerScroll);
document.addEventListener("pointercancel", stopSelectionPointerScroll);
document.addEventListener("mousemove", handleDocumentPointerScroll);
document.addEventListener("mouseup", stopSelectionPointerScroll);
ensureLeptonFavicon();

if (typeof URLSearchParams !== "undefined" && window.location && new URLSearchParams(window.location.search).get("capture") === "1") {
  document.body.classList.add("capture-mode");
}

loadSceneFromUrl();
sceneHistory.last = sceneSnapshot();
renderApp();

function loadSceneFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const encodedScene = params.get("scene");
    if (!encodedScene) return;
    scene = importScene(encodedScene);
    viewport = sceneViewport();
    saveViewport();
    sceneHistory.undo = [];
    sceneHistory.redo = [];
    sceneHistory.last = sceneSnapshot();
  } catch (error) {
    window.__leptonRuntimeError = `Scene preload failed: ${error.message}`;
  }
}
