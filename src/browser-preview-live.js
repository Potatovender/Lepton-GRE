import { convertPowers, getOpPrecedence, normalizeMathSyntax, UNARY_OPERAND_PRECEDENCE } from "./math/expression-syntax.js";

const DEFAULT_SCENE = {
  functions: [],
  colors: [],
  restrictions: [],
  transparencies: [],
  draws: [],
  folders: [],
  points: [],
  dataOrder: [],
  settingsComments: [],
  settingLineComments: {},
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
    showCoordinateGrid: true,
    showGrid: true,
    showXAxis: true,
    showYAxis: true,
    showXNumbers: true,
    showYNumbers: true,
    randomSeed: 1
  }
};

const SAVED_GRAPHS_KEY = "lepton-saved-graphs-v1";
const SAVED_GRAPHS_LIMIT = 60;
const SAVED_GRAPH_THUMBNAIL_WIDTH = 160;
const SAVED_GRAPH_THUMBNAIL_HEIGHT = 100;
const SAVED_GRAPH_THUMBNAIL_QUALITY = 0.72;
const SAVED_GRAPH_THUMBNAIL_MAX_CHARACTERS = 24_000;
const SAVED_GRAPH_LEGACY_THUMBNAIL_MAX_CHARACTERS = 4_000_000;
const APP_VERSION = "20260722-saved-preview-recovery";
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

const DATA_ENTRY_KINDS = ["functions", "colors", "restrictions", "transparencies", "draws", "points", "folders"];
let dropdownDismissBound = false;
let selectedDependencyEntry = null;

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
  "union",
  "intersect",
  "subtract",
  "random",
  "sec",
  "csc",
  "cot",
  "pow",
  "Math",
  "PI",
  "ref",
  "NaN"
]);
const GENERATED_GLSL_NAMES = new Set([
  "clamp3",
  "leptonRandom",
  "leptonUnion",
  "leptonIntersect",
  "leptonSubtract",
  "round1",
  "sinh1",
  "cosh1",
  "tanh1",
  "vec2"
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
  union: { internal: "union", args: 2, display: "union" },
  intersect: { internal: "intersect", args: 2, display: "intersect" },
  subtract: { internal: "subtract", args: 2, display: "subtract" },
  random: { internal: "random", args: 0, display: "random" },
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
  "show_coordinate_grid",
  "show_grid",
  "show_x_axis",
  "show_y_axis",
  "show_x_numbers",
  "show_y_numbers",
  "unbounded_decimal_places",
  "random_seed"
]);
const COMMON_ASPECT_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:2", label: "3:2" },
  { value: "16:9", label: "16:9" },
  { value: "2:1", label: "2:1" }
];
const NODE_BLUE_FLAG_THRESHOLD = 2 ** 12;
const NODE_COUNT_DISPLAY_CAP = 2 ** 16;
const DEFAULT_DRAW_FUNCTION = { id: "f1", kind: "variable", expression: "x" };
const DEFAULT_DRAW_COLOR = { id: "default", label: "default", red: "x", green: "x", blue: "x" };
const DEFAULT_DRAW_BOUNDARY = { id: "default", label: "default", expression: "1", checkSmaller: false };
const DEFAULT_DRAW_TRANSPARENCY = { id: "default", label: "default", expression: "0" };
const LEGACY_DEFAULT_COLOR_IDS = new Set(["c1"]);
const LEGACY_DEFAULT_BOUNDARY_IDS = new Set(["rest"]);
const FUNCTION_ENTRY_KINDS = new Set(["variable", "slider", "function"]);
const TIME_VARIABLE_MODES = new Set(["bounded", "unbounded", "bounded_looped"]);
const DATA_TYPE_LABELS = {
  functions: "value",
  colors: "colour",
  restrictions: "boundary",
  transparencies: "transparency",
  draws: "draw layer"
};
const HELP_TEXT = {
  standard: "Standard mode is the visual editor. Its unified Data workspace holds every graph entry, while the gear opens settings.",
  text: "Text mode shows the whole Lepton scene as plain text. It is useful for copying, pasting, sharing, and bulk edits.",
  functions: "The Data workspace holds values, colours, boundaries, transparencies, draw layers, points, folders, and comments in one reorderable list.",
  colors: "Colours evaluate red, green, and blue expressions at every coordinate. For example, colour rgb = 255~80+20sin(x)~40 uses one expression per channel.",
  restrictions: "Boundaries draw only where their referenced value is greater than or equal to zero, or less than or equal to zero when you flip the checkbox.",
  draws: "Draw layers always choose a value to render. Add colour, boundary, or transparency components only when needed; their displayed order is preserved.",
  settings: "Settings control the viewport, recursion depth, angle mode, and optional solid background color.",
  textLanguage: "Lepton text is the same graph in one copyable script. Colours separate three channel expressions with ~. Draw fields after the value are optional and named, such as colour=sky or transparency=glass.",
  applyText: "Apply reads the script in Text mode, rebuilds the graph from it, and redraws the result.",
  refreshText: "Refresh text rewrites this script from the current Standard editor state. It asks first because unsaved text edits are replaced.",
  backgroundColor: "Default uses the grid background. Custom uses a colour ID from the Data workspace as a solid canvas background.",
  settingXMin: "The left edge of the coordinate window. You can enter numbers or expressions such as -pi.",
  settingXMax: "The right edge of the coordinate window. It must be greater than x minimum when square grid is off.",
  settingYMin: "The bottom edge of the coordinate window. You can use the same math syntax as value fields.",
  settingYMax: "The top edge of the coordinate window. It must be greater than y minimum when square grid is off.",
  settingEnsureSquareGrid: "Keeps graph units visually square. If the requested bounds do not match the aspect ratio, Lepton expands the window to fit.",
  settingAspectRatio: "Controls the shape Lepton fits the square grid into. Use a preset or Custom for your own width:height ratio.",
  settingCustomAspectRatio: "Custom ratios use two math fields: the left number is width and the right number is height.",
  settingDrawOnlyInsideBoundary: "When enabled, pixels outside the active draw boundary are not drawn at all instead of showing the background.",
  settingMaxRecursion: "The maximum depth used when a variable refers back to itself or through a loop of other variables.",
  settingUnboundedDecimals: "How many digits to keep after the decimal point for unbounded time variables while they animate.",
  settingAngleMode: "Chooses whether trig functions read angles as radians or degrees.",
  settingBackgroundColorId: "Choose the color ID used as the solid background when Background color is set to Custom.",
  boundaryDirection: "Unchecked draws when the function value is greater than or equal to zero. Checked draws when the function value is less than or equal to zero.",
  variableType: "Expression entries are named formulas over x and y. Use them for equations, constants, color channels, and helper math that other entries can reference.",
  sliderType: "Slider entries are adjustable numeric values. They can become time variables for animation, with optional bounds depending on the time mode.",
  functionType: "Function entries accept named inputs such as wave(x,y). Inside the function body, input names take priority over outer values with the same name.",
  tutorial: "Open a guided overview of Lepton GRE concepts and workflows."
};

let scene = structuredClone(DEFAULT_SCENE);
let displayMode = "standard";
let activeTab = "functions";
let settingsPanelOpen = false;
const SIDEBAR_MIN_WIDTH = 380;
let sidebarWidth = Math.max(SIDEBAR_MIN_WIDTH, Number(localStorage.getItem("lepton-sidebar-width") ?? "380"));
let sidebarCollapsed = localStorage.getItem("lepton-sidebar-collapsed") === "true";
let viewport = loadViewport();
let panRenderFrame = 0;
let mathFieldReflowFrame = 0;
let tutorialStep = null;
const TUTORIAL_STEPS = [
  {
    mode: "standard",
    tab: "functions",
    title: "Step 1: Create data",
    body: "The Data workspace holds everything except settings. Use New line to create a value, colour, boundary, transparency, draw layer, folder, or comment. Values can be expressions, sliders, or functions, and folders can organize any related entries without changing compilation."
  },
  {
    mode: "standard",
    tab: "functions",
    title: "Step 2: Use expressions, sliders, and functions",
    body: "Expressions reference x, y, and other IDs. Sliders expose an adjustable value. Functions accept inputs like wave(a,b). Time sliders can be played locally or together from the top bar, where the FPS readout shows the graph's live rendering rate. random() uses the scene seed; use the shuffle button below Settings to generate a new pattern."
  },
  {
    mode: "standard",
    tab: "colors",
    title: "Step 3: Make a colour",
    body: "Type a formula directly into each colour channel. Each formula can use x, y, values, sliders, or functions; the three channels are separated by ~ in Text mode."
  },
  {
    mode: "standard",
    tab: "restrictions",
    title: "Step 4: Add a boundary",
    body: "Boundaries decide where a layer draws. Unchecked draws when the boundary value is >= 0. Checked draws when it is <= 0. Use the default boundary for no restriction."
  },
  {
    mode: "standard",
    tab: "draws",
    title: "Step 5: Connect a draw layer",
    body: "Draw always chooses the value to render. Use + to optionally add colour, boundary, and transparency in any order. Transparency is evaluated like a colour channel: x is the draw value and y is the current vertical coordinate. With none added, Lepton uses its default colour, no boundary restriction, and full opacity."
  },
  {
    mode: "text",
    tab: "draws",
    title: "Step 6: Share or bulk edit",
    body: "Text mode is the same graph as script. Draw components are named, for example draw(eq,colour=sky,transparency=glass). Time sliders can add speed 2 to move two units per second. Apply reads text back into the visual editor."
  }
];
const listControls = {
  data: { query: "", sort: "custom", type: "all" },
  functions: { query: "", sort: "custom" },
  colors: { query: "", sort: "custom" },
  restrictions: { query: "", sort: "custom" }
};
const editorHistory = new Map();
const sceneHistory = { undo: [], redo: [], last: "" };
const textEditHistory = { undo: [], redo: [], last: "", restoring: false };
const playingTimeIds = new Set();
const timeVariableDirections = new Map();
const entryScrollTops = new Map();
let pendingScrollTarget = null;
let entryDragState = null;
let entryDragScrollTop = null;
let entryDragImage = null;
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
let animationFpsWindowStart = 0;
let animationFpsFrameCount = 0;
let animationFps = 0;
let latestDiagnostics = null;
const TIME_VARIABLE_RATE = 1;
const webGlRenderCache = new WeakMap();
let saveDialogOpen = false;
let libraryDialogOpen = false;
let saveNameDraft = "";
let saveErrorMessage = "";
let activeSavedGraphId = null;
const recoveringSavedGraphThumbnails = new Set();
let hasUnsavedChanges = false;
let graphActionFeedback = "";

const root = document.querySelector("#app");
window.__leptonForceGradient = false;

function renderApp() {
  ensureSceneCollections(scene);
  rememberEntryScroll();
  hideHelpTooltip();
  prunePlayingTimeIds();
  const diagnostics = validateScene();
  const scrollKey = panelScrollKey();
  root.innerHTML = `
    <main class="app-shell ${sidebarCollapsed ? "app-shell-sidebar-collapsed" : ""}" style="--sidebar-width: ${sidebarWidth}px; --sidebar-min-width: ${SIDEBAR_MIN_WIDTH}px">
      <section class="expression-panel ${displayMode === "text" ? "expression-panel-text" : ""}" aria-label="Expression editor">
        <header class="panel-header">
          <div class="brand-row">
            <a class="brand-link" href="./index.html" aria-label="Go to Lepton landing page">
              <img src="./src/assets/lepton-logo-transparent.png" alt="" />
              <strong>Lepton GRE</strong>
            </a>
            <button class="tutorial-button" data-action="tutorial" type="button" aria-pressed="${tutorialStep !== null}">${tutorialStep === null ? "What do I do?" : "Hide tutorial"}</button>
            ${renderGraphActionsMenu()}
          </div>
          <div class="display-row" aria-label="Display mode">
            <button class="display-button" data-display-mode="standard" aria-selected="${displayMode === "standard"}">${helpDash("Standard", "standard")}</button>
            <button class="display-button" data-display-mode="text" aria-selected="${displayMode === "text"}">${helpDash("Text", "text")}</button>
          </div>
        </header>
        <div class="entry-list ${displayMode === "text" ? "entry-list-text" : ""}">${renderPanel()}</div>
        <button class="keyboard-toggle" data-action="toggle-keyboard" type="button" aria-pressed="${keyboardOpen}" aria-label="${keyboardOpen ? "Hide keyboard" : "Show keyboard"}">⌨</button>
      </section>
      <div class="sidebar-resizer" role="separator" aria-label="Resize expression panel" tabindex="0"></div>
      <section class="renderer-pane" aria-label="Grid renderer">
        <button class="sidebar-toggle" data-action="toggle-sidebar" aria-label="${sidebarCollapsed ? "Show expression panel" : "Hide expression panel"}" aria-pressed="${sidebarCollapsed}">
          <span aria-hidden="true"></span>
        </button>
        ${displayMode === "standard" ? `<button class="graph-settings-toggle ${settingsPanelOpen ? "active" : ""}" data-action="toggle-settings-panel" aria-label="${settingsPanelOpen ? "Hide settings" : "Show settings"}" aria-pressed="${settingsPanelOpen}" type="button">${gearIcon()}</button>
        <button class="graph-randomize-toggle" data-action="randomize-seed" aria-label="Change random seed" title="Change random seed" type="button">${shuffleIcon()}</button>` : ""}
        ${keyboardOpen ? renderKeyboardPanel() : ""}
        <canvas class="grid-canvas"></canvas>
        <canvas class="graph-overlay-canvas" aria-hidden="true"></canvas>
        <div class="grid-boundary-overlay" aria-hidden="true"></div>
        ${diagnostics.hasErrors ? `<div class="render-overlay render-overlay-error">${diagnostics.summary}</div>` : ""}
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
  requestAnimationFrame(() => forceMathFieldsReflow());
}

function ensureSceneCollections(target) {
  for (const kind of DATA_ENTRY_KINDS) if (!Array.isArray(target[kind])) target[kind] = [];
  for (const draw of dataEntries(target.draws)) draw.components = normalizeDrawEntry(draw).components;
  for (const entry of dataEntries(target.functions)) if (entry.kind === "slider" && entry.timeRate == null) entry.timeRate = "1";
  if (!Number.isFinite(Number(target.settings.randomSeed))) target.settings.randomSeed = 1;
  return target;
}

function renderGraphActionsMenu() {
  return `
    <div class="graph-actions-menu">
      <button class="toolbar-button graph-actions-trigger ${hasUnsavedChanges ? "primary" : ""}" type="button" aria-haspopup="true">
        Graph
      </button>
      <div class="graph-actions-popover" role="menu" aria-label="Graph actions">
        <button class="toolbar-button" data-action="new-graph" type="button" role="menuitem">New</button>
        <button class="toolbar-button ${hasUnsavedChanges ? "primary" : ""}" data-action="open-save-dialog" type="button" role="menuitem">Save</button>
        <button class="toolbar-button" data-action="open-library" type="button" role="menuitem">Load</button>
        <button class="toolbar-button" data-action="export-graph" type="button" role="menuitem">${graphActionFeedback === "export-graph" ? "Exporting..." : "Export"}</button>
      </div>
    </div>
  `;
}

function gearIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"/><path d="M19 12a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8l-.3 3.1a8 8 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5A7.4 7.4 0 0 0 5 12c0 .3 0 .7.1 1l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.8 1l.3 3.1h4.8l.3-3.1a8 8 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z"/></svg>`;
}

function shuffleIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.5c4.5 0 4.5 10 9 10H20"/><path d="m17 14 3 3-3 3"/><path d="M4 17h3.5c1.7 0 2.8-1.4 3.8-3.1M13.2 9.8C14.2 8.3 15.2 7 16.5 7H20"/><path d="m17 4 3 3-3 3"/></svg>`;
}

function commentIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h14v8.5H9l-4 3V6.5z"/><path d="M8 10h8M8 13h5"/></svg>`;
}

function panelScrollKey() {
  if (displayMode === "text") return "text";
  return settingsPanelOpen ? "settings" : "data";
}

function sortLabel(sort) {
  if (sort === "dependencies") return "Dependencies";
  if (sort === "az") return "ID A-Z";
  if (sort === "za") return "ID Z-A";
  if (sort === "group") return "In group";
  return "In order";
}

function createEntryUid(kind = "entry") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${kind}-${crypto.randomUUID()}`;
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ensureEntryUid(entry, kind = "entry") {
  if (!entry || typeof entry !== "object") return "";
  if (!entry._uid) entry._uid = createEntryUid(kind);
  return entry._uid;
}

function entryOrderKey(kind, uid) {
  return `${kind}:${uid}`;
}

function ensureSceneDataOrder(target = scene) {
  if (!target || typeof target !== "object") return [];
  if (!Array.isArray(target.dataOrder)) target.dataOrder = [];
  const valid = new Set();
  for (const kind of DATA_ENTRY_KINDS) {
    for (const entry of target[kind] ?? []) {
      valid.add(entryOrderKey(kind, ensureEntryUid(entry, kind)));
    }
  }
  const seen = new Set();
  target.dataOrder = target.dataOrder.filter((ref) => {
    const key = entryOrderKey(ref?.kind, ref?.uid);
    if (!valid.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  for (const kind of DATA_ENTRY_KINDS) {
    for (const entry of target[kind] ?? []) {
      const uid = ensureEntryUid(entry, kind);
      const key = entryOrderKey(kind, uid);
      if (seen.has(key)) continue;
      target.dataOrder.push({ kind, uid });
      seen.add(key);
    }
  }
  return target.dataOrder;
}

function orderedDataEntries(target = scene) {
  ensureSceneDataOrder(target);
  const entries = [];
  for (const ref of target.dataOrder ?? []) {
    const list = target[ref.kind];
    if (!Array.isArray(list)) continue;
    const index = list.findIndex((entry) => ensureEntryUid(entry, ref.kind) === ref.uid);
    if (index === -1) continue;
    entries.push({ kind: ref.kind, index, entry: list[index], parentUid: ref.parentUid ?? "" });
  }
  return entries;
}

function dataSubtype(entry, kind) {
  if (isCommentEntry(entry)) return "comment";
  if (kind === "functions") return normalizeFunctionEntry(entry).kind;
  if (kind === "folders") return "folder";
  if (kind === "points") return "point";
  return kind;
}

function matchesDataTypeFilter(kind, entry, type) {
  if (type === "all") return true;
  if (type === "values") return kind === "functions" && !isCommentEntry(entry);
  return dataSubtype(entry, kind) === type;
}

function dataTypeLabel(kind, entry) {
  if (isCommentEntry(entry)) return "comment";
  if (kind === "functions") {
    const subtype = normalizeFunctionEntry(entry).kind;
    if (subtype === "slider") return "value · slider";
    if (subtype === "function") return "value · function";
    return "value · expression";
  }
  if (kind === "folders") return "folder";
  if (kind === "points") return "point";
  return DATA_TYPE_LABELS[kind] ?? kind;
}

function exportOrderedDataEntry(kind, entry) {
  if (kind === "functions") return exportFunctionEntry(entry, kind);
  if (kind === "colors") return exportColorEntry(entry);
  if (kind === "restrictions") return exportRestrictionEntry(entry);
  if (kind === "transparencies") return exportTransparencyEntry(entry);
  if (kind === "draws") return exportDrawEntry(entry);
  if (kind === "points") return exportPointEntry(entry);
  return "";
}

function pushDataEntry(target, kind, entry) {
  ensureEntryUid(entry, kind);
  target[kind].push(entry);
  if (!Array.isArray(target.dataOrder)) target.dataOrder = [];
  target.dataOrder.push({ kind, uid: entry._uid, parentUid: target._importParentUid ?? "" });
  return entry;
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
    timeMode: TIME_VARIABLE_MODES.has(entry?.timeMode) ? entry.timeMode : "bounded",
    timeRate: String(entry?.timeRate ?? "1"),
    comment: String(entry?.comment ?? "")
  };
}

function isCommentEntry(entry) {
  return entry?.type === "comment";
}

function createCommentEntry(text = "") {
  return { type: "comment", text: String(text ?? "") };
}

function commentText(entry) {
  return String(entry?.text ?? "");
}

function dataEntries(entries) {
  return Array.isArray(entries) ? entries.filter((entry) => !isCommentEntry(entry)) : [];
}

function firstDataId(entries) {
  return dataEntries(entries)[0]?.id ?? "";
}

function nextEntryId(entries, prefix) {
  const data = dataEntries(entries);
  const used = new Set(data.map((entry) => String(entry.id ?? "")));
  let index = data.length + 1;
  let id = `${prefix}${index}`;
  while (used.has(id)) {
    index += 1;
    id = `${prefix}${index}`;
  }
  return id;
}

function settingsCommentEntries() {
  if (!Array.isArray(scene.settingsComments)) scene.settingsComments = [];
  return scene.settingsComments;
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
  const sign = value < 0 ? "-" : "";
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  return decimals > 0 ? `${sign}${integer}.${fraction}` : `${sign}${integer}`;
}

function clampInteger(value, min, max) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function functionEntryExpression(entry) {
  return String(normalizeFunctionEntry(entry).expression ?? "");
}

function envEntry(env, name) {
  const value = env?.[name];
  if (!value) return null;
  return typeof value === "string" ? normalizeFunctionEntry({ id: name, kind: "variable", expression: value }) : normalizeFunctionEntry(value);
}

function envFunctionDefinitions(env) {
  return Object.fromEntries(
    Object.entries(env ?? {})
      .map(([id, entry]) => [id, envEntry(env, id)])
      .filter(([, entry]) => entry && entry.kind === "function")
  );
}

function nextSort(sort) {
  if (sort === "custom") return "dependencies";
  if (sort === "dependencies") return "az";
  if (sort === "az") return "za";
  if (sort === "za") return "group";
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
  const variables = dataEntries(scene.functions).map((entry) => entry.id).filter(Boolean);
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
    const { kind, index, bottom } = pendingScrollTarget;
    pendingScrollTarget = null;
    if (bottom) {
      list.scrollTop = list.scrollHeight;
      return;
    }
    const row = root.querySelector(`[data-entry-kind="${cssEscape(kind)}"][data-entry-index="${index}"]`);
    if (row) {
      row.scrollIntoView({ block: "nearest" });
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

function setGraphActionFeedback(action) {
  graphActionFeedback = action;
  window.clearTimeout(setGraphActionFeedback.timer);
  setGraphActionFeedback.timer = window.setTimeout(() => {
    graphActionFeedback = "";
    root?.querySelectorAll?.(".graph-actions-popover .toolbar-button.is-action-feedback").forEach((button) => {
      button.classList.remove("is-action-feedback");
    });
  }, 900);
  root?.querySelectorAll?.(".graph-actions-popover .toolbar-button").forEach((button) => {
    const active = button.dataset.action === action;
    button.classList.toggle("is-action-feedback", active);
    if (button.dataset.action === "export-graph") {
      button.textContent = active ? "Exporting..." : "Export";
    }
  });
}

function updateSaveButtonState() {
  root?.querySelectorAll?.('[data-action="open-save-dialog"], .graph-actions-trigger').forEach((button) => {
    button.classList.toggle("primary", hasUnsavedChanges);
  });
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
  if (!field.matches(":focus-within") && !field.classList.contains("mq-focused")) return;
  const cursor = field.querySelector(".mq-cursor");
  const selection = field.querySelector(".mq-selection");
  if (selection) return;
  const target = cursor;
  if (!target) return;
  const fieldRect = field.getBoundingClientRect();
  const cursorRect = target.getBoundingClientRect();
  const inset = 2;
  if (cursorRect.right > fieldRect.right - inset) {
    field.scrollLeft += cursorRect.right - fieldRect.right + inset;
  } else if (cursorRect.left < fieldRect.left + inset) {
    field.scrollLeft -= fieldRect.left + inset - cursorRect.left;
  }
  field.scrollLeft = clampNumber(field.scrollLeft, 0, Math.max(0, field.scrollWidth - field.clientWidth));
}

function scheduleMountedMathFieldReflow() {
  if (mathFieldReflowFrame) return;
  mathFieldReflowFrame = requestAnimationFrame(() => {
    mathFieldReflowFrame = 0;
    root.querySelectorAll(".mathquill-field[data-field]").forEach((field) => {
      const mathField = field.mathquillInstance ?? field.__mathField;
      mathField?.reflow?.();
      field.scrollLeft = clampNumber(field.scrollLeft, 0, Math.max(0, field.scrollWidth - field.clientWidth));
      if (field.matches(":focus-within") || field.classList.contains("mq-focused")) {
        keepHorizontalCaretVisible(field);
      }
    });
    reflowMathLayout(root);
  });
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
  if (field.matches?.("[data-scene-text]")) return;
  if (field.selectionStart == null || field.selectionEnd == null) return;
  if (field.selectionStart !== field.selectionEnd) return;
  const caretIndex = textInputVisibleCaretIndex(field, event);
  const caretLeft = textWidthForInput(field, field.value.slice(0, caretIndex));
  const inset = 2;
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

function addDataLineFromEnter(event, field) {
  if (event.key !== "Enter" || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
  if (displayMode !== "standard" || settingsPanelOpen || field.closest?.(".reference-picker, .new-entry-menu, .entry-type-menu")) return false;
  if (field.tagName === "TEXTAREA" || isCommentEntry(scene[field.dataset.field?.split(".")[0]]?.[Number(field.dataset.field?.split(".")[1])])) return false;
  const collection = field.dataset.field?.split(".")[0];
  if (!DATA_ENTRY_KINDS.includes(collection) || collection === "draws") return false;
  event.preventDefault();
  syncFields();
  const before = sceneSnapshot();
  listControls.data.query = "";
  listControls.data.sort = "custom";
  listControls.data.type = "all";
  const target = addEntry("functions");
  recordSceneHistory(before);
  pendingScrollTarget = target ? { ...target, bottom: true } : null;
  renderApp();
  return true;
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
    } else if (value === "random") {
      mathField.typedText("random");
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
  if (value === "random") return "random";
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
        <div class="text-mode-time-controls">
          ${timePlaybackControls()}
        </div>
      </div>
    `;
  }

  if (settingsPanelOpen) return renderSettingsPanel(diagnostics);
  return renderDataPanel(diagnostics);
}

function renderDataPanel(diagnostics) {
  const visible = visibleDataEntries();
  const reorderable = canReorderDataEntries();
  const rows = visible.flatMap(({ kind, index, entry, depth = 0 }) => {
    const selectedClass = isSelectedDependencyEntry(kind, entry) ? "expression-row-dependency-selected " : "";
    let row;
    if (kind === "folders") row = folderRow(entry, index, depth, diagnostics.folders?.[index], selectedClass);
    else if (isCommentEntry(entry)) row = commentRow(kind, index, entry, dataTypeLabel(kind, entry), selectedClass);
    else row = expressionRow(
      diagnostics[kind]?.[index]?.status ?? "invalid",
      diagnostics[kind]?.[index]?.message ?? "",
      dataRowContent(kind, entry, index, diagnostics[kind]?.[index]),
      kind,
      index,
      { rowClass: `${selectedClass}${kind === "draws" && entry.hidden ? "expression-row-hidden " : ""}${depth > 0 ? "expression-row-nested" : ""}`, typeLabel: dataTypeLabel(kind, entry), attrs: `style="padding-left:${8 + Math.min(depth, 5) * 14}px"` }
    );
    return [reorderable ? entryDropSlot(kind, index, depth) : "", row];
  });
  return [
    tutorialCoachmark(),
    timePlaybackControls(),
    listControlBar("data", "data"),
    ...rows,
    reorderable && visible.length ? `<div class="entry-drop-slot entry-drop-slot-end" data-entry-drop-end="true" aria-label="Move to end of list"></div>` : "",
    addDataRow()
  ].join("");
}

function folderRow(entry, index, depth = 0, diagnostic = { status: "valid", message: "Folder is valid" }, extraClass = "") {
  const uid = ensureEntryUid(entry, "folders");
  const childCount = (scene.dataOrder ?? []).filter((ref) => ref.parentUid === uid).length;
  return expressionRow(diagnostic.status, diagnostic.message, "", "folders", index, {
    rowClass: `${extraClass}expression-row-folder ${depth > 0 ? "expression-row-nested" : ""}`,
    noInlineComment: false,
    staticTypeHtml: folderIcon(),
    headingActionHtml: `<button class="folder-toggle" data-toggle-folder="${index}" type="button" aria-expanded="${!entry.collapsed}" aria-label="${entry.collapsed ? "Open" : "Close"} folder">${entry.collapsed ? "›" : "⌄"}</button>`,
    headingSuffixHtml: `<span class="folder-count">${childCount} item${childCount === 1 ? "" : "s"}</span>`,
    attrs: `data-folder-uid="${escapeHtml(uid)}" style="padding-left:${8 + Math.min(depth, 5) * 14}px"`
  });
}

function entryDropSlot(kind, index, depth = 0) {
  return `<div class="entry-drop-slot" data-entry-drop-before="${kind}.${index}" style="--drop-depth:${Math.min(depth, 5)}" aria-label="Move before this line"></div>`;
}

function folderIcon() {
  return `<svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v9.5h-17z"/></svg>`;
}

function dataRowContent(kind, entry, index, diagnostic = null) {
  if (kind === "functions") return functionRowContent(entry, index);
  if (kind === "colors") {
    return `
      ${colorChannelRow(index, "red", "red channel", entry.red, diagnostic?.channels?.red)}
      ${colorChannelRow(index, "green", "green channel", entry.green, diagnostic?.channels?.green)}
      ${colorChannelRow(index, "blue", "blue channel", entry.blue, diagnostic?.channels?.blue)}
    `;
  }
  if (kind === "restrictions") {
    return `
      <label class="settings-row"><span>Function reference</span>${searchableReference(`restrictions.${index}.expression`, dataEntries(scene.functions), entry.expression, "Boundary function")}</label>
      <label class="inline-check"><input type="checkbox" data-field="restrictions.${index}.checkSmaller" ${entry.checkSmaller ? "checked" : ""} /> draw when less than or equal to 0 ${helpMark("boundaryDirection")}</label>
    `;
  }
  if (kind === "transparencies") {
    return `<label class="settings-row"><span>function</span>${mathEditor(`transparencies.${index}.expression`, entry.expression, "Transparency function", true, "0 to 1; x is the draw value")}</label>`;
  }
  if (kind === "draws") {
    const draw = normalizeDrawEntry(entry);
    entry.components = draw.components;
    const components = draw.components.map((component, componentIndex) => drawComponentControl(index, component, componentIndex)).join("");
    const missing = ["color", "boundary", "transparency"].filter((type) => !draw.components.some((component) => component.type === type));
    return `
      <div class="draw-layer-toolbar">
        <button class="draw-visibility" data-toggle-draw="${index}" aria-pressed="${entry.hidden ? "true" : "false"}">${entry.hidden ? "Show" : "Hide"}</button>
      </div>
      <label class="draw-reference-row"><span>value</span>${searchableReference(`draws.${index}.equationId`, drawFunctionEntries(), entry.equationId, "Draw function")}</label>
      <div class="draw-components">${components}</div>
      ${missing.length ? `<div class="draw-component-adder">
        <button class="draw-component-add" data-add-draw-component="${index}" type="button" aria-label="Add draw component">+</button>
        <select class="compact-field" data-draw-component-choice="${index}" aria-label="Choose draw component">
          ${missing.map((type) => `<option value="${type}">${type === "color" ? "colour" : type}</option>`).join("")}
        </select>
      </div>` : ""}
    `;
  }
  if (kind === "points") {
    return `<div class="point-fields">
      <label><span>x</span>${mathEditor(`points.${index}.x`, entry.x, "Point x", true, "x")}</label>
      <label><span>y</span>${mathEditor(`points.${index}.y`, entry.y, "Point y", true, "y")}</label>
      <label><span>colour</span>${searchableReference(`points.${index}.colorId`, drawColorEntries(), entry.colorId ?? "default", "Point color")}</label>
      <label class="inline-check"><input type="checkbox" data-field="points.${index}.draggable" ${entry.draggable ? "checked" : ""}/> draggable</label>
    </div>`;
  }
  return "";
}

function colorChannelRow(index, property, label, value, diagnostic = { status: "valid", message: `${label} is valid` }) {
  const statusLabel = diagnostic.status === "valid" ? `status: valid` : diagnostic.message;
  return `<label class="channel-row" data-color-channel="${index}.${property}">
    <span class="channel-label">${label}</span>
    ${mathEditor(`colors.${index}.${property}`, value, label, true, `${property} expression`)}
    <span class="channel-status entry-status ${diagnostic.status}" title="${escapeHtml(statusLabel)}" aria-label="${escapeHtml(statusLabel)}"></span>
  </label>`;
}

function drawComponentControl(drawIndex, component, componentIndex) {
  const field = `draws.${drawIndex}.components.${componentIndex}.id`;
  const config = component.type === "color"
    ? { label: "colour", entries: drawColorEntries(), picker: "Draw color" }
    : component.type === "boundary"
      ? { label: "boundary", entries: drawBoundaryEntries(), picker: "Draw boundary" }
      : { label: "transparency", entries: drawTransparencyEntries(), picker: "Draw transparency" };
  return `<div class="draw-component-row" data-draw-component="${drawIndex}.${componentIndex}">
    <span>${config.label}</span>
    ${searchableReference(field, config.entries, component.id, config.picker)}
    <button class="icon-button draw-component-remove" data-remove-draw-component="${drawIndex}.${componentIndex}" type="button" aria-label="Remove ${config.label}">×</button>
  </div>`;
}

function renderSettingsPanel(diagnostics) {
  const gridStatus = diagnostics.settings[0] ?? { status: "valid", message: "Grid rendering settings are valid" };
  return `
    ${tutorialCoachmark()}
    <div class="settings-panel-heading">
      <h2>Settings</h2>
      <button class="toolbar-button" data-action="toggle-settings-panel" type="button">Back to data</button>
    </div>
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
        <h3>Coordinate grid</h3>
        <button class="toolbar-button" data-action="toggle-coordinate-grid" type="button" aria-pressed="${scene.settings.showCoordinateGrid === false}">${scene.settings.showCoordinateGrid === false ? "Show grid" : "Hide grid"}</button>
        <label class="inline-check"><input type="checkbox" data-field="settings.showGrid" ${scene.settings.showGrid !== false ? "checked" : ""}/> grid lines</label>
        <label class="inline-check"><input type="checkbox" data-field="settings.showXAxis" ${scene.settings.showXAxis !== false ? "checked" : ""}/> x axis</label>
        <label class="inline-check"><input type="checkbox" data-field="settings.showYAxis" ${scene.settings.showYAxis !== false ? "checked" : ""}/> y axis</label>
        <label class="inline-check"><input type="checkbox" data-field="settings.showXNumbers" ${scene.settings.showXNumbers !== false ? "checked" : ""} ${scene.settings.showXAxis === false ? "disabled" : ""}/> x-axis numbers</label>
        <label class="inline-check"><input type="checkbox" data-field="settings.showYNumbers" ${scene.settings.showYNumbers !== false ? "checked" : ""} ${scene.settings.showYAxis === false ? "disabled" : ""}/> y-axis numbers</label>
      </section>
      <section class="settings-section">
        <h3>Calculation</h3>
        ${settingsField("maxRecursion", "max recursion depth", "number", "settingMaxRecursion")}
      </section>
      <section class="settings-section">
        <h3>Numerical settings</h3>
        ${settingsField("unboundedDecimalPlaces", "unbounded time decimal places", "number", "settingUnboundedDecimals")}
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
          ${searchableReference("settings.backgroundColor", dataEntries(scene.colors), scene.settings.backgroundColor, "Background color")}
        </label>
      ` : ""}
      <section class="settings-section">
        <h3>Comments</h3>
        ${settingsCommentEntries().map((entry, index) => commentRow("settingsComments", index, entry)).join("")}
        <button class="comment-add-button" data-add="settingsComments" type="button" title="Add comment" aria-label="Add comment">${commentIcon()}</button>
      </section>
    </div>
  `;
}

function timePlaybackControls() {
  const timeVariables = dataEntries(scene.functions).map(normalizeFunctionEntry).filter((entry) => entry.kind === "slider" && entry.time && entry.id);
  const hasTimeVariables = timeVariables.length > 0;
  const anyPlaying = timeVariables.some((entry) => playingTimeIds.has(entry.id));
  return `
    <div class="draw-playbar">
      <div class="time-playback-primary">
        <button class="toolbar-button" data-action="toggle-global-time" type="button" ${hasTimeVariables ? "" : "disabled"}>
          ${anyPlaying ? "Stop time" : "Play time"}
        </button>
        <output class="time-fps" data-fps-counter aria-live="off">${anyPlaying ? `${animationFps} FPS` : "-- FPS"}</output>
      </div>
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
      <section class="modal-card save-graph-card" role="dialog" aria-modal="true" aria-label="Save new graph">
        <header class="modal-header">
          <h2>Save new graph</h2>
          <button class="modal-close" data-action="close-save-dialog" type="button" aria-label="Close save dialog">×</button>
        </header>
        <label class="save-name-row">
          <span>Name</span>
          <input class="compact-field" data-save-name value="${escapeHtml(saveNameDraft)}" placeholder="Graph name" />
        </label>
        ${saveErrorMessage ? `<p class="save-graph-error" role="alert">${escapeHtml(saveErrorMessage)}</p>` : ""}
        <div class="modal-actions">
          <button class="toolbar-button" data-action="close-save-dialog" type="button">Cancel</button>
          <button class="toolbar-button primary" data-action="confirm-save-graph" type="button">Save new graph</button>
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
      <img class="saved-graph-thumb" src="${escapeHtml(graph.thumbnail)}" data-saved-thumbnail-id="${escapeHtml(graph.id)}" alt="Preview of ${escapeHtml(graph.name)}" />
      <div class="saved-graph-meta">
        <strong>${escapeHtml(graph.name)}</strong>
        <span>${escapeHtml(formatSavedGraphDate(graph.updatedAt))}</span>
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
  if (kind === "data") {
    return `
      <div class="list-controls data-list-controls" data-list-controls="data">
        <select class="list-type-filter compact-field" data-entry-type-filter="data" aria-label="Filter data type">
          ${[
            ["all", "All data"],
            ["values", "Values"],
            ["variable", "Expressions"],
            ["slider", "Sliders"],
            ["function", "Functions"],
            ["colors", "Colours"],
            ["restrictions", "Boundaries"],
            ["transparencies", "Transparencies"],
            ["draws", "Draw layers"],
            ["point", "Points"],
            ["folder", "Folders"],
            ["comment", "Comments"]
          ].map(([value, optionLabel]) => `<option value="${value}" ${state.type === value ? "selected" : ""}>${optionLabel}</option>`).join("")}
        </select>
        <input class="list-search compact-field" data-entry-search="data" value="${escapeHtml(state.query)}" placeholder="search by ID" aria-label="search by ID" />
        <button class="list-sort compact-field" data-entry-sort="data" type="button" aria-label="Sort data by ID: ${sortLabel(state.sort)}">${sortLabel(state.sort)}</button>
      </div>
    `;
  }
  return `
    <div class="list-controls" data-list-controls="${kind}">
      <input class="list-search compact-field" data-entry-search="${kind}" value="${escapeHtml(state.query)}" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(placeholder)}" />
      <button class="list-sort compact-field" data-entry-sort="${kind}" type="button" aria-label="Sort ${escapeHtml(kind)} by ID: ${sortLabel(state.sort)}">${sortLabel(state.sort)}</button>
    </div>
  `;
}

function visibleDataEntries() {
  const state = listControls.data ?? { query: "", sort: "custom", type: "all" };
  const query = state.query.trim().toLowerCase();
  const type = state.type ?? "all";
  let indexed = orderedDataEntries(scene);
  if (type !== "all") {
    indexed = indexed.filter(({ kind, entry }) => matchesDataTypeFilter(kind, entry, type));
  }
  if (query) {
    indexed = indexed.filter(({ entry }) => {
      if (isCommentEntry(entry)) return commentText(entry).toLowerCase().includes(query);
      return String(entry.id ?? "").toLowerCase().includes(query);
    });
  }
  if (state.sort === "dependencies" && selectedDependencyEntry) {
    const included = dependencyEntryKeys(selectedDependencyEntry);
    if (included.size) indexed = indexed.filter((item) => included.has(dataItemKey(item)));
    else selectedDependencyEntry = null;
  } else if (state.sort === "group") {
    const groups = { variable: 0, slider: 1, function: 2, colors: 3, restrictions: 4, transparencies: 5, draws: 6, folder: 7, comment: 8 };
    indexed.sort((left, right) => (groups[dataSubtype(left.entry, left.kind)] ?? 9) - (groups[dataSubtype(right.entry, right.kind)] ?? 9));
  } else if (state.sort !== "custom") {
    indexed.sort((left, right) => {
      if (isCommentEntry(left.entry) && isCommentEntry(right.entry)) return 0;
      if (isCommentEntry(left.entry)) return 1;
      if (isCommentEntry(right.entry)) return -1;
      const order = String(left.entry.id ?? "").localeCompare(String(right.entry.id ?? ""), undefined, { numeric: true, sensitivity: "base" });
      return state.sort === "az" ? order : -order;
    });
  }
  if ((state.sort === "custom" || state.sort === "dependencies") && !query && type === "all") indexed = nestOrderedEntries(indexed);
  return indexed;
}

function canReorderDataEntries() {
  const state = listControls.data ?? { query: "", sort: "custom", type: "all" };
  return state.sort === "custom" && !state.query.trim() && (state.type ?? "all") === "all";
}

function dataItemKey(item) {
  return entryOrderKey(item.kind, ensureEntryUid(item.entry, item.kind));
}

function selectedDependencyKey() {
  if (!selectedDependencyEntry) return "";
  return entryOrderKey(selectedDependencyEntry.kind, selectedDependencyEntry.uid);
}

function isSelectedDependencyEntry(kind, entry) {
  return selectedDependencyKey() === entryOrderKey(kind, ensureEntryUid(entry, kind));
}

function dependencyEntryKeys(rootSelection, target = scene) {
  const ordered = orderedDataEntries(target);
  const byKey = new Map(ordered.map((item) => [dataItemKey(item), item]));
  const byId = new Map();
  for (const item of ordered) {
    if (isCommentEntry(item.entry) || !item.entry?.id) continue;
    const entries = byId.get(String(item.entry.id)) ?? [];
    entries.push(dataItemKey(item));
    byId.set(String(item.entry.id), entries);
  }
  const rootKey = entryOrderKey(rootSelection.kind, rootSelection.uid);
  if (!byKey.has(rootKey)) return new Set();
  const included = new Set();
  const visit = (key) => {
    if (!key || included.has(key)) return;
    const item = byKey.get(key);
    if (!item) return;
    included.add(key);
    for (const dependency of directDependencyKeys(item, ordered, byId)) visit(dependency);
  };
  visit(rootKey);

  for (const key of [...included]) {
    let parentUid = byKey.get(key)?.parentUid ?? "";
    const seen = new Set();
    while (parentUid && !seen.has(parentUid)) {
      seen.add(parentUid);
      const parentKey = entryOrderKey("folders", parentUid);
      if (!byKey.has(parentKey)) break;
      included.add(parentKey);
      parentUid = byKey.get(parentKey)?.parentUid ?? "";
    }
  }
  return included;
}

function directDependencyKeys(item, ordered, byId) {
  const ids = new Set();
  const addExpression = (source, localNames = new Set()) => {
    for (const match of String(source ?? "").matchAll(/\b[A-Za-z_]\w*\b/g)) {
      if (!localNames.has(match[0]) && byId.has(match[0])) ids.add(match[0]);
    }
  };
  const { kind, entry } = item;
  if (kind === "functions") {
    const normalized = normalizeFunctionEntry(entry);
    addExpression(normalized.expression, normalized.kind === "function" ? new Set(normalized.params) : new Set());
  }
  else if (kind === "colors") [entry.red, entry.green, entry.blue].forEach((source) => addExpression(source));
  else if (kind === "restrictions" || kind === "transparencies") addExpression(entry.expression);
  else if (kind === "points") {
    addExpression(entry.x);
    addExpression(entry.y);
    if (entry.colorId && entry.colorId !== "default") ids.add(entry.colorId);
  } else if (kind === "draws") {
    const draw = normalizeDrawEntry(entry);
    if (draw.equationId) ids.add(draw.equationId);
    draw.components.forEach((component) => {
      if (component.id && component.id !== "default") ids.add(component.id);
    });
  } else if (kind === "folders") {
    const uid = ensureEntryUid(entry, "folders");
    return ordered.filter((candidate) => candidate.parentUid === uid).map(dataItemKey);
  }
  return [...ids].flatMap((id) => byId.get(id) ?? []);
}

function nestOrderedEntries(entries) {
  const byParent = new Map();
  for (const item of entries) {
    const key = item.parentUid || "";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(item);
  }
  const output = [];
  const visit = (parentUid, depth, ancestry = new Set()) => {
    for (const item of byParent.get(parentUid) ?? []) {
      output.push({ ...item, depth });
      if (item.kind !== "folders") continue;
      if (item.entry.collapsed) continue;
      const uid = ensureEntryUid(item.entry, "folders");
      if (ancestry.has(uid)) continue;
      visit(uid, depth + 1, new Set([...ancestry, uid]));
    }
  };
  visit("", 0);
  return output;
}

function commentRow(kind, index, entry, typeLabel = "comment", extraClass = "") {
  return expressionRow("valid", "Comment", `
    <textarea class="entry-comment-body" data-field="${kind}.${index}.text" placeholder="write a comment" aria-label="Comment">${escapeHtml(commentText(entry))}</textarea>
  `, kind, index, { rowClass: `${extraClass}expression-row-comment`, noInlineComment: true, typeLabel });
}

function functionRowContent(entry, index) {
  const normalized = normalizeFunctionEntry(entry);
  return `
    <div class="function-row-head">
      ${functionKindSelector(normalized.kind, index)}
    </div>
    ${normalized.kind === "slider" ? sliderRowContent(normalized, index) : ""}
    ${normalized.kind === "function" ? functionSignatureContent(normalized, index) : ""}
    ${normalized.kind !== "slider" ? mathEditor(`functions.${index}.expression`, normalized.expression, "Function expression", false, "enter function here") : ""}
  `;
}

function functionKindSelector(kind, index) {
  const helpKeys = {
    variable: "variableType",
    slider: "sliderType",
    function: "functionType"
  };
  const labels = {
    variable: "expression",
    slider: "slider",
    function: "function"
  };
  return `
    <div class="function-kind-selector" data-help="${escapeHtml(HELP_TEXT[helpKeys[kind] ?? "variableType"])}" title="${escapeHtml(HELP_TEXT[helpKeys[kind] ?? "variableType"])}">
      <select class="function-kind-select" data-function-kind-select="${index}" aria-label="Value entry type">
        ${["variable", "slider", "function"].map((entryKind) => `
          <option value="${entryKind}" ${kind === entryKind ? "selected" : ""}>${labels[entryKind]}</option>
        `).join("")}
      </select>
    </div>
  `;
}

function functionEntryForScene(entry) {
  const normalized = normalizeFunctionEntry(entry);
  const next = {
    id: normalized.id,
    kind: normalized.kind,
    expression: normalized.expression,
    params: normalized.params,
    sliderMin: normalized.sliderMin,
    sliderMax: normalized.sliderMax,
    time: normalized.time,
    timeMode: normalized.timeMode,
    timeRate: normalized.timeRate
  };
  if (entry?._uid) next._uid = entry._uid;
  if (Object.prototype.hasOwnProperty.call(entry ?? {}, "comment")) {
    next.comment = normalized.comment;
  }
  return next;
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
          <label class="time-rate-field"><span>units / second</span>${mathEditor(`functions.${index}.timeRate`, entry.timeRate, "Time units per second", true, "1")}</label>
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
  const hasInlineComment = kind && index != null && Object.prototype.hasOwnProperty.call(scene[kind]?.[index] ?? {}, "comment");
  const inlineComment = kind && !options.noInlineComment && hasInlineComment
    ? `<input class="entry-comment-inline" data-field="${kind}.${index}.comment" value="${escapeHtml(scene[kind]?.[index]?.comment ?? "")}" placeholder="line comment" aria-label="Line comment" />`
    : "";
  const typeLabel = options.staticTypeHtml
    ? `<span class="entry-type-label entry-type-static ${status}" title="${escapeHtml(statusLabel)}">${options.staticTypeHtml}</span>`
    : options.typeLabel && kind && index != null ? entryTypeMenu(kind, index, options.typeLabel) : "";
  const headingId = entryHeadingId(kind, index);
  return `
    <div class="expression-row ${options.rowClass ?? ""}" title="${escapeHtml(message)}" ${entryAttrs} ${options.attrs ?? ""}>
      ${kind ? `
        <div class="entry-row-grip" draggable="true" data-entry-drag-handle="${kind}.${index}" title="Drag to reorder" aria-label="Drag to reorder">
          <span class="entry-grip-dot"></span>
          <span class="entry-status ${status}" title="${escapeHtml(statusLabel)}" aria-label="${escapeHtml(statusLabel)}"></span>
          <span class="entry-grip-dot"></span>
        </div>
      ` : `<span class="entry-status ${status}" title="${escapeHtml(statusLabel)}" aria-label="${escapeHtml(statusLabel)}"></span>`}
      <div class="entry-content">
        ${typeLabel || headingId ? `<div class="entry-heading">${options.headingActionHtml ?? ""}${typeLabel}${headingId}${options.headingSuffixHtml ?? ""}</div>` : ""}
        ${content}${inlineComment}
      </div>
      ${kind ? `
        <div class="row-actions">
          ${options.noInlineComment || hasInlineComment ? "" : `<button class="row-action row-action-comment" data-add-inline-comment="${kind}.${index}" title="Add comment" aria-label="Add comment">${commentIcon()}</button>`}
          <button class="row-action" data-delete="${kind}" data-index="${index}" title="Delete entry" aria-label="Delete entry">×</button>
        </div>
      ` : `<button class="row-action" title="More options" aria-label="More options">⋯</button>`}
    </div>
  `;
}

function entryHeadingId(kind, index) {
  if (kind === "functions") return `<input class="entry-id" data-field="functions.${index}.id" value="${escapeHtml(scene.functions[index]?.id ?? "")}" placeholder="ID" aria-label="Function id" />`;
  if (kind === "colors") return `<input class="entry-id" data-field="colors.${index}.id" value="${escapeHtml(scene.colors[index]?.id ?? "")}" placeholder="ID" aria-label="Colour id" />`;
  if (kind === "restrictions") return `<input class="entry-id" data-field="restrictions.${index}.id" value="${escapeHtml(scene.restrictions[index]?.id ?? "")}" placeholder="ID" aria-label="Boundary id" />`;
  if (kind === "transparencies") return `<input class="entry-id" data-field="transparencies.${index}.id" value="${escapeHtml(scene.transparencies[index]?.id ?? "")}" placeholder="ID" aria-label="Transparency id" />`;
  if (kind === "folders") return `<input class="entry-id folder-id" data-field="folders.${index}.id" value="${escapeHtml(scene.folders[index]?.id ?? "")}" placeholder="Folder name" aria-label="Folder name" />`;
  if (kind === "points") return `<input class="entry-id" data-field="points.${index}.id" value="${escapeHtml(scene.points[index]?.id ?? "")}" placeholder="ID" aria-label="Point id" />`;
  return "";
}

function entryTypeMenu(kind, index, label) {
  const base = `${kind}.${index}`;
  return `
    <details class="entry-type-menu" data-type-menu="${base}">
      <summary class="entry-type-label" aria-label="Change data type">${escapeHtml(label)}</summary>
      <div class="entry-type-popover">
        <div class="new-entry-group">
          <span class="new-entry-heading">Value</span>
          <button data-change-entry-kind="${base}.variable" type="button">Expression</button>
          <button data-change-entry-kind="${base}.slider" type="button">Slider</button>
          <button data-change-entry-kind="${base}.function" type="button">Function</button>
        </div>
        <div class="new-entry-divider" role="separator"></div>
        <button data-change-entry-kind="${base}.colors" type="button">Colour</button>
        <button data-change-entry-kind="${base}.restrictions" type="button">Boundary</button>
        <button data-change-entry-kind="${base}.transparencies" type="button">Transparency</button>
        <button data-change-entry-kind="${base}.points" type="button">Point</button>
        <div class="new-entry-divider" role="separator"></div>
        <button data-change-entry-kind="${base}.draws" type="button">Draw layer</button>
      </div>
    </details>
  `;
}

function addDataRow() {
  return `
    <div class="add-row-wrap add-data-row-wrap">
      <button class="add-row add-row-default" data-add="functions" data-add-default="functions" data-entry-kind-choice="variable" type="button">
        <span class="entry-status"></span>
        <span>New line</span>
      </button>
      <details class="new-entry-menu" data-new-entry-menu>
        <summary class="new-entry-ellipsis" aria-label="Choose line type">...</summary>
        <div class="new-entry-popover">
          <button data-add="folders" type="button">${folderIcon()} Folder</button>
          <button data-add-comment="functions" data-comment-target="data" type="button">${commentIcon()} Comment</button>
          <div class="new-entry-divider" role="separator"></div>
          <div class="new-entry-group">
            <span class="new-entry-heading">Value</span>
            <button data-add="functions" data-entry-kind-choice="variable" type="button">Expression</button>
            <button data-add="functions" data-entry-kind-choice="slider" type="button">Slider</button>
            <button data-add="functions" data-entry-kind-choice="function" type="button">Function</button>
          </div>
          <div class="new-entry-divider" role="separator"></div>
          <button data-add="colors" type="button">Colour</button>
          <button data-add="restrictions" type="button">Boundary</button>
          <button data-add="transparencies" type="button">Transparency</button>
          <div class="new-entry-divider" role="separator"></div>
          <button data-add="draws" type="button">Draw layer</button>
          <button data-add="points" type="button">Point</button>
        </div>
      </details>
    </div>
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
  const selectedEntry = entries.find((entry) => entry.id === selected);
  const selectedLabel = selectedEntry?.label ?? (selected || "default");
  return `
    <details class="reference-picker" data-reference-picker="${escapeHtml(field)}">
      <summary class="reference-summary" aria-label="${escapeHtml(label)}">
        <span>${escapeHtml(selectedLabel)}</span>
      </summary>
      <div class="reference-menu">
        <input class="compact-field reference-filter" data-reference-filter="${escapeHtml(field)}" value="" placeholder="Search ${escapeHtml(label.toLowerCase())}" aria-label="Search ${escapeHtml(label)}" />
        <div class="reference-options" role="listbox">
          <button class="reference-option reference-new" type="button" data-new-reference-function="${escapeHtml(field)}">+ New function</button>
          ${referenceMenuOptions(entries, selected, field)}
        </div>
      </div>
    </details>
  `;
}

function referenceMenuOptions(entries, selected, field) {
  const hasSelected = entries.some((entry) => entry.id === selected);
  const missing = hasSelected || !selected ? [] : [{ id: selected, label: `${selected} (missing)` }];
  return [...missing, ...entries].map((entry) => `
    <button
      class="reference-option"
      type="button"
      data-reference-option="${escapeHtml(field)}"
      data-value="${escapeHtml(entry.id)}"
      aria-selected="${entry.id === selected}"
    >${escapeHtml(entry.label ?? entry.id)}</button>
  `).join("");
}

function bindEvents() {
  bindSidebarResize();
  bindHelpTooltips();
  root.onfocusin = (event) => activateKeyboardTarget(event.target);
  root.onclick = (event) => {
    if (event.target?.closest?.("[data-field]")) activateKeyboardTarget(event.target);
  };
  bindSavedGraphThumbnailRecovery();

  root.querySelector('[data-action="open-save-dialog"]')?.addEventListener("click", () => {
    setGraphActionFeedback("open-save-dialog");
    syncFields();
    const existing = savedGraphForId(activeSavedGraphId);
    if (existing) {
      try {
        saveCurrentGraph(existing.name);
        saveErrorMessage = "";
      } catch (error) {
        saveNameDraft = existing.name;
        saveErrorMessage = isStorageQuotaError(error)
          ? "Browser storage is full. Delete an older saved graph, then try again."
          : "This graph could not be saved in this browser.";
        saveDialogOpen = true;
        libraryDialogOpen = false;
      }
    } else {
      saveNameDraft = defaultSavedGraphName();
      saveErrorMessage = "";
      saveDialogOpen = true;
      libraryDialogOpen = false;
    }
    renderApp();
  });
  root.querySelector('[data-action="new-graph"]')?.addEventListener("click", () => {
    setGraphActionFeedback("new-graph");
    syncFields();
    const before = sceneSnapshot();
    scene = structuredClone(DEFAULT_SCENE);
    activeSavedGraphId = null;
    viewport = sceneViewport();
    if (isValidViewport(viewport)) saveViewport();
    recordSceneHistory(before);
    markUnsavedChange();
    activeTab = "functions";
    displayMode = "standard";
    renderApp();
  });
  root.querySelector('[data-action="open-library"]')?.addEventListener("click", () => {
    setGraphActionFeedback("open-library");
    syncFields();
    libraryDialogOpen = true;
    saveDialogOpen = false;
    renderApp();
  });
  root.querySelector('[data-action="export-graph"]')?.addEventListener("click", () => {
    setGraphActionFeedback("export-graph");
    exportCurrentGraphImage();
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
    saveNameDraft = name;
    try {
      saveCurrentGraph(name, { forceNew: true });
      saveErrorMessage = "";
      saveDialogOpen = false;
      libraryDialogOpen = true;
    } catch (error) {
      saveErrorMessage = isStorageQuotaError(error)
        ? "Browser storage is full. Delete an older saved graph, then try again."
        : "This graph could not be saved in this browser.";
      saveDialogOpen = true;
      libraryDialogOpen = false;
    }
    renderApp();
  });
  root.querySelectorAll("[data-load-saved-graph]").forEach((button) => {
    button.addEventListener("click", () => {
      const saved = loadSavedGraphs().find((graph) => graph.id === button.dataset.loadSavedGraph);
      if (!saved) return;
      const before = sceneSnapshot();
      scene = importScene(saved.scene);
      activeSavedGraphId = saved.id;
      viewport = sceneViewport();
      if (isValidViewport(viewport)) saveViewport();
      sceneHistory.undo = [];
      sceneHistory.redo = [];
      sceneHistory.last = sceneSnapshot();
      if (before !== sceneSnapshot()) sceneHistory.undo.push(before);
      markSaved();
      displayMode = "standard";
      activeTab = "functions";
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
      if (displayMode === "standard") settingsPanelOpen = false;
      if (displayMode === "text") settingsPanelOpen = false;
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="toggle-settings-panel"]').forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      settingsPanelOpen = !settingsPanelOpen;
      renderApp();
    });
  });
  root.querySelector('[data-action="randomize-seed"]')?.addEventListener("click", () => {
    const before = sceneSnapshot();
    const previous = Number(scene.settings.randomSeed) || 0;
    let next = Math.floor(Math.random() * 2147483646) + 1;
    if (next === previous) next = next % 2147483647 + 1;
    scene.settings.randomSeed = next;
    recordSceneHistory(before);
    renderApp();
  });
  root.querySelector('[data-action="toggle-coordinate-grid"]')?.addEventListener("click", () => {
    const before = sceneSnapshot();
    scene.settings.showCoordinateGrid = scene.settings.showCoordinateGrid === false;
    recordSceneHistory(before);
    renderApp();
  });

  root.querySelector('[data-action="tutorial"]')?.addEventListener("click", () => {
    syncFields();
    if (tutorialStep !== null) {
      tutorialStep = null;
    } else {
      tutorialStep = 0;
      displayMode = TUTORIAL_STEPS[0].mode;
      activeTab = TUTORIAL_STEPS[0].tab;
    }
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

  root.querySelectorAll("[data-entry-kind][data-entry-index]").forEach((row) => {
    row.addEventListener("pointerdown", (event) => {
      if (event.target.closest?.(".entry-row-grip")) return;
      const kind = row.dataset.entryKind;
      const entry = scene[kind]?.[Number(row.dataset.entryIndex)];
      if (!entry) return;
      const next = { kind, uid: ensureEntryUid(entry, kind) };
      const changed = selectedDependencyKey() !== entryOrderKey(next.kind, next.uid);
      selectedDependencyEntry = next;
      if (changed && listControls.data.sort === "dependencies") renderApp();
    });
  });

  root.querySelectorAll("[data-entry-type-filter]").forEach((field) => {
    field.addEventListener("change", () => {
      const kind = field.dataset.entryTypeFilter;
      if (!listControls[kind]) return;
      listControls[kind].type = field.value;
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
  root.querySelectorAll("[data-function-kind-select]").forEach((field) => {
    field.addEventListener("change", () => {
      syncFields();
      const index = Number(field.dataset.functionKindSelect);
      const kind = field.value;
      if (!FUNCTION_ENTRY_KINDS.has(kind) || !scene.functions[index]) return;
      const before = sceneSnapshot();
      const entry = functionEntryForScene(scene.functions[index]);
      entry.kind = kind;
      scene.functions[index] = entry;
      recordSceneHistory(before);
      renderApp();
    });
  });
  root.querySelectorAll("[data-change-entry-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      const [fromKind, rawIndex, target] = button.dataset.changeEntryKind.split(".");
      const before = sceneSnapshot();
      const changed = changeDataEntryKind(fromKind, Number(rawIndex), target);
      if (!changed) return;
      recordSceneHistory(before);
      pendingScrollTarget = changed;
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
  root.querySelectorAll("[data-reference-picker]").forEach((picker) => {
    picker.addEventListener("toggle", () => {
      picker.closest(".expression-row")?.classList.toggle("expression-row-picker-open", picker.open);
      if (picker.open) requestAnimationFrame(() => picker.querySelector("[data-reference-filter]")?.focus());
    });
  });
  root.querySelectorAll("[data-reference-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const before = sceneSnapshot();
      updateReferenceField(button.dataset.referenceOption, button.dataset.value);
      recordSceneHistory(before);
      renderApp();
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
    resetTextEditHistory(field?.value ?? "");
    updateTextHighlight();
    triggerBoundaryOverlay();
  });
  const sceneTextField = root.querySelector("[data-scene-text]");
  if (sceneTextField) {
    resetTextEditHistory(sceneTextField.value, false);
    sceneTextField.addEventListener("beforeinput", () => {
      rememberTextEditState(sceneTextField.value);
    });
    sceneTextField.addEventListener("keydown", (event) => {
      if (handleTextEditHistoryKeydown(sceneTextField, event)) event.preventDefault();
    });
    sceneTextField.addEventListener("input", () => {
      handleTextEditInput(sceneTextField);
      markUnsavedChange();
      updateTextHighlight();
    });
    sceneTextField.addEventListener("scroll", () => syncTextHighlightScroll());
  }
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
    scene.settings.backgroundColor = event.target.value === "custom" ? firstDataId(scene.colors) || "0" : "0";
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
      activeSavedGraphId = null;
      displayMode = "standard";
      activeTab = "functions";
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
      autoOperatorNames: "sin cos tan ln log exp min max clamp round floor ceil abs sign sinh cosh tanh arcsin arccos arctan sec csc cot arccot arcsec arccsc sech csch coth arcsinh arccosh arctanh arcsech arccsch arccoth cbrt asin acos atan random",
      handlers: {
        edit: () => {
          if (el.dataset.initializing === "true" || !el.contains(document.activeElement)) return;
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
              const entry = functionEntryForScene(scene.functions[index]);
              const oldId = entry.id;
              entry.id = assignment.id;
              entry.expression = assignment.expression;
              scene.functions[index] = entry;
              renameSceneReferences("functions", oldId, assignment.id);
              const idInput = root.querySelector(`[data-field="functions.${index}.id"]`);
              if (idInput) idInput.value = assignment.id;
            } else {
              const entry = functionEntryForScene(scene.functions[index]);
              entry.expression = cleanExpr;
              scene.functions[index] = entry;
            }
          } else if (collection === "functions") {
            const entry = functionEntryForScene(scene.functions[index]);
            entry[property] = cleanExpr;
            scene.functions[index] = entry;
            if (["expression", "sliderMin", "sliderMax"].includes(property)) {
              syncSliderRangeControl(index, entry);
            }
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
    mathField.reflow?.();
    requestAnimationFrame(() => {
      el.dataset.initializing = "true";
      mathField.latex(initialValue);
      mathField.reflow?.();
      keepHorizontalCaretVisible(el);
      delete el.dataset.initializing;
    });
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
      if (addDataLineFromEnter(event, field)) return;
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
    const isSceneText = field.matches?.("[data-scene-text]");
    field.addEventListener("focusin", () => activateKeyboardTarget(field));
    field.addEventListener("pointerdown", () => {
      activateKeyboardTarget(field);
      if (!isSceneText) beginSelectionPointerScroll(field);
    });
    field.addEventListener("mousedown", () => {
      activateKeyboardTarget(field);
      if (!isSceneText) beginSelectionPointerScroll(field);
    });
    field.addEventListener("input", () => {
      if (!isSceneText) keepTextInputCaretVisible(field);
    });
    field.addEventListener("keydown", (event) => {
      if (!isSceneText) addDataLineFromEnter(event, field);
    });
    field.addEventListener("keyup", () => {
      if (!isSceneText) keepTextInputCaretVisible(field);
    });
    field.addEventListener("mouseup", () => {
      if (!isSceneText) keepTextInputCaretVisible(field);
    });
    field.addEventListener("pointermove", (event) => {
      if (isSceneText) return;
      if (event.buttons) {
        scrollFieldNearPointer(field, event);
        keepTextInputCaretVisible(field, event);
      }
    });
    field.addEventListener("mousemove", (event) => {
      if (isSceneText) return;
      if (event.buttons) {
        scrollFieldNearPointer(field, event);
        keepTextInputCaretVisible(field, event);
      }
    });
    field.addEventListener(
      "wheel",
      (event) => {
        if (!isSceneText && scrollFieldHorizontally(field, event)) event.preventDefault();
      },
      { passive: false }
    );
  });

  root.querySelectorAll("input.entry-id[data-field]").forEach((field) => {
    field.addEventListener("focusin", () => {
      const [collection, rawIndex] = field.dataset.field.split(".");
      const currentId = scene[collection]?.[Number(rawIndex)]?.id ?? field.value;
      field.dataset.renameFrom = currentId;
      field.dataset.lastValidId = /^[A-Za-z_]\w*$/.test(currentId) ? currentId : "";
    });
    field.addEventListener("input", () => {
      const before = sceneSnapshot();
      const previousValidId = field.dataset.lastValidId ?? "";
      updateField(field);
      const [collection, rawIndex] = field.dataset.field.split(".");
      const newId = scene[collection]?.[Number(rawIndex)]?.id ?? field.value;
      if (/^[A-Za-z_]\w*$/.test(newId)) {
        if (previousValidId && previousValidId !== newId) renameSceneReferences(collection, previousValidId, newId);
        field.dataset.lastValidId = newId;
      }
      recordSceneHistory(before);
      const diagnostics = validateScene();
      updateStatusLights(diagnostics);
      renderScene(diagnostics);
    });
    field.addEventListener("change", () => {
      field.dataset.renameFrom = field.dataset.lastValidId ?? field.value;
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
      listControls.data.query = "";
      listControls.data.sort = "custom";
      listControls.data.type = "all";
      const target = addEntry(kind, kind === "settingsComments" ? "comment" : "data");
      if (target && kind === "functions" && button.dataset.entryKindChoice) {
        scene.functions[target.index].kind = button.dataset.entryKindChoice;
      }
      recordSceneHistory(before);
      pendingScrollTarget = target ? { ...target, bottom: true } : null;
      renderApp();
    });
  });

  root.querySelectorAll("[data-add-comment]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      const before = sceneSnapshot();
      const kind = button.dataset.addComment;
      listControls.data.query = "";
      listControls.data.sort = "custom";
      listControls.data.type = "all";
      const target = addEntry(kind, "comment");
      recordSceneHistory(before);
      pendingScrollTarget = target ? { ...target, bottom: true } : null;
      renderApp();
    });
  });

  root.querySelectorAll("[data-add-inline-comment]").forEach((button) => {
    button.addEventListener("click", () => {
      const before = sceneSnapshot();
      const [kind, rawIndex] = button.dataset.addInlineComment.split(".");
      const entry = scene[kind]?.[Number(rawIndex)];
      if (entry && !isCommentEntry(entry)) entry.comment = "";
      recordSceneHistory(before);
      renderApp();
    });
  });
  root.querySelectorAll("[data-new-reference-function]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields(); const before=sceneSnapshot();
      const field = button.dataset.newReferenceFunction;
      const created = createReferenceEntry(field);
      if (!created) return;
      updateReferenceField(field, created.id);
      recordSceneHistory(before);
      pendingScrollTarget={kind:created.kind,index:created.index,bottom:true};
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
  root.querySelectorAll("[data-add-draw-component]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      const before = sceneSnapshot();
      const drawIndex = Number(button.dataset.addDrawComponent);
      const draw = scene.draws[drawIndex];
      const select = root.querySelector(`[data-draw-component-choice="${drawIndex}"]`);
      const type = select?.value;
      if (!draw || !["color", "boundary", "transparency"].includes(type)) return;
      draw.components = normalizeDrawEntry(draw).components;
      if (!draw.components.some((component) => component.type === type)) {
        const id = type === "color" ? drawColorEntries()[0]?.id : type === "boundary" ? drawBoundaryEntries()[0]?.id : drawTransparencyEntries()[0]?.id;
        draw.components.push({ type, id: id ?? "default" });
      }
      recordSceneHistory(before);
      renderApp();
    });
  });
  root.querySelectorAll("[data-remove-draw-component]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      const before = sceneSnapshot();
      const [rawDrawIndex, rawComponentIndex] = button.dataset.removeDrawComponent.split(".");
      const draw = scene.draws[Number(rawDrawIndex)];
      if (!draw) return;
      draw.components = normalizeDrawEntry(draw).components;
      draw.components.splice(Number(rawComponentIndex), 1);
      recordSceneHistory(before);
      renderApp();
    });
  });

  root.querySelectorAll("[data-toggle-folder]").forEach((button) => {
    button.addEventListener("click", () => {
      const before = sceneSnapshot();
      const folder = scene.folders?.[Number(button.dataset.toggleFolder)];
      if (!folder) return;
      folder.collapsed = !folder.collapsed;
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

  root.querySelectorAll("[data-entry-drag-handle]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => startEntryPointerDrag(handle, event));
    handle.addEventListener("dragstart", (event) => {
      if (!canReorderDataEntries()) {
        event.preventDefault();
        return;
      }
      const [kind, rawIndex] = handle.dataset.entryDragHandle.split(".");
      entryDragState = { kind, index: Number(rawIndex) };
      entryDragScrollTop = root.querySelector(".entry-list")?.scrollTop ?? null;
      event.dataTransfer?.setData("text/plain", handle.dataset.entryDragHandle);
      entryDragImage = createEntryDragImage(handle);
      if (entryDragImage) {
        event.dataTransfer?.setDragImage(entryDragImage, Math.min(32, entryDragImage.offsetWidth / 2), Math.min(32, entryDragImage.offsetHeight / 2));
      }
    });
    handle.addEventListener("dragend", () => {
      entryDragState = null;
      entryDragScrollTop = null;
      entryDragImage?.remove();
      entryDragImage = null;
      root.querySelectorAll(".expression-row-drop-target").forEach((row) => row.classList.remove("expression-row-drop-target"));
      root.querySelectorAll(".expression-row-drop-after").forEach((row) => row.classList.remove("expression-row-drop-after"));
      root.querySelectorAll(".folder-drop-target").forEach((row) => row.classList.remove("folder-drop-target"));
      root.querySelectorAll(".entry-drop-slot-active").forEach((slot) => slot.classList.remove("entry-drop-slot-active"));
    });
  });

  root.querySelectorAll("[data-entry-drop-before], [data-entry-drop-end]").forEach((slot) => {
    slot.addEventListener("dragover", (event) => {
      if (!entryDragState || !canReorderDataEntries()) return;
      event.preventDefault();
      slot.classList.add("entry-drop-slot-active");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("entry-drop-slot-active"));
    slot.addEventListener("drop", (event) => {
      if (!entryDragState) return;
      event.preventDefault();
      slot.classList.remove("entry-drop-slot-active");
      syncFields();
      const before = sceneSnapshot();
      const moved = moveEntryToDropSlot(entryDragState.kind, entryDragState.index, slot);
      if (moved) recordSceneHistory(before);
      if (entryDragScrollTop != null) entryScrollTops.set("data", entryDragScrollTop);
      entryDragState = null;
      if (moved) renderApp();
    });
  });

  root.querySelectorAll("[data-entry-kind][data-entry-index]").forEach((row) => {
    row.addEventListener("dragover", (event) => {
      const state = entryDragState;
      if (!state) return;
      event.preventDefault();
      applyRowDropIndicator(row, event.clientY);
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("expression-row-drop-target");
      row.classList.remove("expression-row-drop-after");
      row.classList.remove("folder-drop-target");
    });
    row.addEventListener("drop", (event) => {
      const state = entryDragState;
      if (!state) return;
      event.preventDefault();
      row.classList.remove("expression-row-drop-target");
      const dropPosition = dropPositionForRow(row, event.clientY);
      row.classList.remove("expression-row-drop-after");
      row.classList.remove("folder-drop-target");
      syncFields();
      const before = sceneSnapshot();
      const to = Number(row.dataset.entryIndex);
      if (row.dataset.entryKind === "folders" && dropPosition === "inside") moveEntryIntoFolder(state.kind, state.index, to);
      else moveMixedDataEntry(state.kind, state.index, row.dataset.entryKind, to, dropPosition);
      recordSceneHistory(before);
      if (entryDragScrollTop != null) entryScrollTops.set("data", entryDragScrollTop);
      entryDragState = null;
      renderApp();
    });
  });

  const rootDropTarget = root.querySelector("[data-add-default]");
  rootDropTarget?.addEventListener("dragover", (event) => {
    if (!entryDragState) return;
    event.preventDefault();
    rootDropTarget.classList.add("root-drop-target");
  });
  rootDropTarget?.addEventListener("dragleave", () => rootDropTarget.classList.remove("root-drop-target"));
  rootDropTarget?.addEventListener("drop", (event) => {
    if (!entryDragState) return;
    event.preventDefault();
    const before = sceneSnapshot();
    const moved = moveEntryToRootEnd(entryDragState.kind, entryDragState.index);
    if (moved) recordSceneHistory(before);
    if (entryDragScrollTop != null) entryScrollTops.set("data", entryDragScrollTop);
    entryDragState = null;
    if (moved) renderApp();
  });

  if (!dropdownDismissBound) {
    document.addEventListener("click", closeUnrelatedDropdowns);
    dropdownDismissBound = true;
  }
}

function closeUnrelatedDropdowns(event) {
  root.querySelectorAll("details[open]").forEach((details) => {
    if (!details.contains(event.target)) details.open = false;
  });
}

function createEntryDragImage(handle) {
  const row = handle.closest(".expression-row");
  if (!row) return null;
  const clone = row.cloneNode(true);
  const rect = row.getBoundingClientRect();
  clone.classList.add("expression-row-drag-image");
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  document.body.append(clone);
  return clone;
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

function resetTextEditHistory(value = "", force = true) {
  if (!force && textEditHistory.last === value) return;
  textEditHistory.undo = [];
  textEditHistory.redo = [];
  textEditHistory.last = value;
  textEditHistory.restoring = false;
}

function rememberTextEditState(value) {
  const lastUndo = textEditHistory.undo[textEditHistory.undo.length - 1];
  if (lastUndo === value) return;
  textEditHistory.undo.push(value);
  if (textEditHistory.undo.length > 100) textEditHistory.undo.shift();
  textEditHistory.redo = [];
  textEditHistory.last = value;
}

function handleTextEditInput(field) {
  if (textEditHistory.restoring) {
    textEditHistory.restoring = false;
    return;
  }
  if (textEditHistory.last !== field.value) {
    rememberTextEditState(textEditHistory.last);
    textEditHistory.last = field.value;
  }
}

function handleTextEditHistoryKeydown(field, event) {
  const key = event.key.toLowerCase();
  if (!(event.metaKey || event.ctrlKey) || (key !== "z" && key !== "y")) return false;
  const undo = key === "z" && !event.shiftKey;
  const from = undo ? textEditHistory.undo : textEditHistory.redo;
  const to = undo ? textEditHistory.redo : textEditHistory.undo;
  if (!from.length) return false;
  to.push(field.value);
  field.value = from.pop();
  textEditHistory.last = field.value;
  textEditHistory.restoring = true;
  field.selectionStart = field.selectionEnd = field.value.length;
  markUnsavedChange();
  updateTextHighlight();
  return true;
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
  helpTooltipTimer = setTimeout(() => showHelpTooltip(target), 140);
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
  const query = field.value.trim().toLowerCase();
  picker?.querySelectorAll("[data-reference-option]").forEach((option) => {
    const haystack = `${option.dataset.value ?? ""} ${option.textContent ?? ""}`.toLowerCase();
    option.hidden = Boolean(query && !haystack.includes(query));
  });
}

function updateReferenceField(field, value) {
  const [collection, rawIndex, ...path] = String(field ?? "").split(".");
  if (!collection || rawIndex == null || !path.length) return;
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || !scene[collection]?.[index]) return;
  let target = scene[collection][index];
  for (let offset = 0; offset < path.length - 1; offset += 1) {
    const key = /^\d+$/.test(path[offset]) ? Number(path[offset]) : path[offset];
    if (target?.[key] == null) return;
    target = target[key];
  }
  target[path.at(-1)] = String(value ?? "");
}

function forceMathFieldsReflow() {
  root.querySelectorAll(".mathquill-field[data-field]").forEach((field) => {
    const mathField = field.mathquillInstance;
    if (!mathField) return;
    const latex = field.dataset.value ?? mathField.latex();
    field.dataset.initializing = "true";
    mathField.latex(latex);
    mathField.reflow?.();
    delete field.dataset.initializing;
    keepHorizontalCaretVisible(field);
  });
  queueMathLayoutReflow();
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

function startEntryPointerDrag(handle, event) {
  const [kind, rawIndex] = String(handle.dataset.entryDragHandle ?? "").split(".");
  const index = Number(rawIndex);
  if (!DATA_ENTRY_KINDS.includes(kind) || !Number.isInteger(index) || !canReorderDataEntries()) return;
  event.preventDefault();
  const originalScrollTop = root.querySelector(".entry-list")?.scrollTop ?? 0;
  const dragImage = createEntryDragImage(handle);
  let targetRow = null;
  let targetSlot = null;
  let rootTarget = null;
  let targetPosition = "before";

  const clearTarget = () => {
    targetRow?.classList.remove("expression-row-drop-target", "expression-row-drop-after", "folder-drop-target");
    targetSlot?.classList.remove("entry-drop-slot-active");
    rootTarget?.classList.remove("root-drop-target");
    targetRow = null;
    targetSlot = null;
    rootTarget = null;
  };

  const positionImage = (pointerEvent) => {
    if (!dragImage) return;
    dragImage.style.left = `${pointerEvent.clientX + 12}px`;
    dragImage.style.top = `${pointerEvent.clientY + 12}px`;
  };

  const onMove = (moveEvent) => {
    positionImage(moveEvent);
    const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
    const slot = element?.closest?.("[data-entry-drop-before], [data-entry-drop-end]");
    const row = element?.closest?.("[data-entry-kind][data-entry-index]");
    const addTarget = element?.closest?.("[data-add-default]");
    if (slot === targetSlot && row === targetRow && addTarget === rootTarget) {
      if (row) {
        const nextPosition = dropPositionForRow(row, moveEvent.clientY);
        if (nextPosition !== targetPosition) {
          targetPosition = nextPosition;
          applyRowDropIndicator(row, moveEvent.clientY);
        }
      }
      return;
    }
    clearTarget();
    if (slot) {
      targetSlot = slot;
      targetSlot.classList.add("entry-drop-slot-active");
    } else if (row) {
      targetRow = row;
      targetPosition = dropPositionForRow(row, moveEvent.clientY);
      applyRowDropIndicator(row, moveEvent.clientY);
    } else if (addTarget) {
      rootTarget = addTarget;
      rootTarget.classList.add("root-drop-target");
    }
  };

  const onUp = (upEvent) => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    const element = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
    const slot = element?.closest?.("[data-entry-drop-before], [data-entry-drop-end]") ?? targetSlot;
    const row = element?.closest?.("[data-entry-kind][data-entry-index]") ?? targetRow;
    const dropAtRoot = Boolean(element?.closest?.("[data-add-default]") ?? rootTarget);
    clearTarget();
    dragImage?.remove();
    syncFields();
    const before = sceneSnapshot();
    let moved = false;
    if (slot) {
      moved = moveEntryToDropSlot(kind, index, slot);
    } else if (row?.dataset.entryKind === "folders" && targetPosition === "inside") {
      moved = moveEntryIntoFolder(kind, index, Number(row.dataset.entryIndex));
    } else if (row) {
      const position = row === targetRow ? targetPosition : dropPositionForRow(row, upEvent.clientY);
      moved = moveMixedDataEntry(kind, index, row.dataset.entryKind, Number(row.dataset.entryIndex), position);
    } else if (dropAtRoot) {
      moved = moveEntryToRootEnd(kind, index);
    }
    if (!moved) return;
    recordSceneHistory(before);
    entryScrollTops.set("data", originalScrollTop);
    renderApp();
  };

  positionImage(event);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

function dropPositionForRow(row, clientY) {
  if (!row) return "before";
  const rect = row.getBoundingClientRect();
  if (row.dataset.entryKind === "folders") {
    const ratio = (clientY - rect.top) / Math.max(1, rect.height);
    if (ratio < 0.28) return "before";
    if (ratio > 0.72) return "after";
    return "inside";
  }
  return clientY >= rect.top + rect.height / 2 ? "after" : "before";
}

function applyRowDropIndicator(row, clientY) {
  row.classList.remove("expression-row-drop-target", "expression-row-drop-after", "folder-drop-target");
  const position = dropPositionForRow(row, clientY);
  if (position === "inside") row.classList.add("folder-drop-target");
  else row.classList.add(position === "after" ? "expression-row-drop-after" : "expression-row-drop-target");
}

function bindSidebarResize() {
  const resizer = root.querySelector(".sidebar-resizer");
  if (!resizer) return;

  const onMove = (event) => {
    sidebarWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(Math.max(SIDEBAR_MIN_WIDTH, window.innerWidth - 260), event.clientX));
    localStorage.setItem("lepton-sidebar-width", String(sidebarWidth));
    root.querySelector(".app-shell")?.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
    scheduleMountedMathFieldReflow();
    renderScene(validateScene());
  };

  const onUp = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    scheduleMountedMathFieldReflow();
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
    const pointIndex = hitDraggablePoint(event, canvas);
    if (pointIndex >= 0) { startPointDrag(pointIndex, canvas); return; }
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

function hitDraggablePoint(event, canvas){const r=canvas.getBoundingClientRect(),vp=displayViewportForSize(viewport,r.width,r.height),env=buildRuntimeEnv(sceneFunctionEnv(true));for(let i=scene.points.length-1;i>=0;i--){const p=scene.points[i];if(!p.draggable)continue;const x=compileExpression(p.x)(0,0,env),y=compileExpression(p.y)(0,0,env),px=(x-vp.xMin)/(vp.xMax-vp.xMin)*r.width,py=r.height-(y-vp.yMin)/(vp.yMax-vp.yMin)*r.height;if(Math.hypot(event.clientX-r.left-px,event.clientY-r.top-py)<=10)return i;}return -1;}
function startPointDrag(index,canvas){
  const rect=canvas.getBoundingClientRect();
  const vp=displayViewportForSize(viewport,rect.width,rect.height);
  const before=sceneSnapshot();
  const move=(event)=>{
    if(!rect.width||!rect.height)return;
    event.preventDefault();
    const px=Math.max(0,Math.min(rect.width,event.clientX-rect.left));
    const py=Math.max(0,Math.min(rect.height,event.clientY-rect.top));
    scene.points[index].x=String(Number((vp.xMin+px/rect.width*(vp.xMax-vp.xMin)).toPrecision(8)));
    scene.points[index].y=String(Number((vp.yMax-py/rect.height*(vp.yMax-vp.yMin)).toPrecision(8)));
    updatePointDragFields(index);
    renderScene(validateScene());
  };
  const up=()=>{document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);recordSceneHistory(before);renderApp();};
  document.addEventListener("pointermove",move,{passive:false}); document.addEventListener("pointerup",up,{once:true});
}

function updatePointDragFields(index) {
  const point = scene.points[index];
  if (!point) return;
  for (const coordinate of ["x", "y"]) {
    const fieldName = `points.${index}.${coordinate}`;
    const field = root.querySelector(`.mathquill-field[data-field="${fieldName}"]`);
    if (!field) continue;
    const source = point[coordinate];
    const latex = latexSourceFromExpression(source);
    field.dataset.value = latex;
    const mathField = field.mathquillInstance ?? field.__mathField;
    if (!mathField) continue;
    field.dataset.initializing = "true";
    mathField.latex(latex);
    mathField.reflow?.();
    delete field.dataset.initializing;
  }
}

function schedulePanRender() {
  if (panRenderFrame) return;
  panRenderFrame = requestAnimationFrame(() => {
    panRenderFrame = 0;
    renderScene(validateScene());
  });
}

function updateSettingValue(key, value) {
  if (["ensureSquareGrid", "drawOnlyInsideBoundary", "showCoordinateGrid", "showGrid", "showXAxis", "showYAxis", "showXNumbers", "showYNumbers"].includes(key)) {
    scene.settings[key] = Boolean(value);
    if (key === "showXAxis" && !value) scene.settings.showXNumbers = false;
    if (key === "showYAxis" && !value) scene.settings.showYNumbers = false;
    if (key === "showXNumbers" && scene.settings.showXAxis === false) scene.settings.showXNumbers = false;
    if (key === "showYNumbers" && scene.settings.showYAxis === false) scene.settings.showYNumbers = false;
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
  if (["maxRecursion", "unboundedDecimalPlaces"].includes(key)) {
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

  const targetEntry = scene[collection]?.[Number(rawIndex)];
  if (isCommentEntry(targetEntry)) {
    targetEntry.text = String(value ?? "");
    return;
  }

  if (collection === "functions" && property === "expression") {
    const assignment = parseAssignment(value);
    if (assignment) {
      const entry = functionEntryForScene(scene.functions[Number(rawIndex)]);
      const oldId = entry.id;
      entry.id = assignment.id;
      entry.expression = assignment.expression;
      scene.functions[Number(rawIndex)] = entry;
      renameSceneReferences("functions", oldId, assignment.id);
      return;
    }
  }

  if (collection === "functions") {
    const entry = functionEntryForScene(scene.functions[Number(rawIndex)]);
    entry[property] = property === "params" ? parseFunctionParams(value) : value;
    scene.functions[Number(rawIndex)] = entry;
    if (["expression", "sliderMin", "sliderMax"].includes(property)) {
      syncSliderRangeControl(Number(rawIndex), entry);
    }
  } else {
    scene[collection][Number(rawIndex)][property] = value;
  }
  if (field.classList?.contains("mathquill-field")) {
    field.dataset.value = latexSourceFromExpression(value);
  }
}

function renameSceneReferences(collection, oldId, newId) {
  const oldName = String(oldId ?? "").trim();
  const newName = String(newId ?? "").trim();
  if (!oldName || !newName || oldName === newName || !/^[A-Za-z_]\w*$/.test(newName)) return false;
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const replace = (source) => String(source ?? "").replaceAll(new RegExp(`\\b${escaped}\\b`, "g"), newName);

  if (["functions", "restrictions", "points"].includes(collection)) {
    scene.functions = scene.functions.map((rawEntry) => {
      if (isCommentEntry(rawEntry)) return rawEntry;
      const entry = functionEntryForScene(rawEntry);
      if (entry.kind === "function" && entry.params.includes(oldName)) return entry;
      entry.expression = replace(entry.expression);
      if (entry.kind === "slider") {
        entry.sliderMin = replace(entry.sliderMin);
        entry.sliderMax = replace(entry.sliderMax);
        entry.timeRate = replace(entry.timeRate);
      }
      return entry;
    });
  }
  if (collection === "functions") {
    scene.colors.forEach((entry) => {
      if (isCommentEntry(entry)) return;
      entry.red = replace(entry.red); entry.green = replace(entry.green); entry.blue = replace(entry.blue);
    });
    scene.restrictions.forEach((entry) => { if (!isCommentEntry(entry)) entry.expression = replace(entry.expression); });
    scene.transparencies.forEach((entry) => { if (!isCommentEntry(entry)) entry.expression = replace(entry.expression); });
    scene.draws.forEach((entry) => { if (!isCommentEntry(entry) && entry.equationId === oldName) entry.equationId = newName; });
    scene.points.forEach((entry) => { if (!isCommentEntry(entry)) { entry.x = replace(entry.x); entry.y = replace(entry.y); } });
  } else if (collection === "colors") {
    scene.draws.forEach((entry) => { if (!isCommentEntry(entry)) { entry.components = normalizeDrawEntry(entry).components; entry.components.filter((component) => component.type === "color" && component.id === oldName).forEach((component) => { component.id = newName; }); } });
    scene.points.forEach((entry) => { if (!isCommentEntry(entry) && entry.colorId === oldName) entry.colorId = newName; });
    if (scene.settings.backgroundColor === oldName) scene.settings.backgroundColor = newName;
  } else if (collection === "restrictions") {
    scene.draws.forEach((entry) => { if (!isCommentEntry(entry)) { entry.components = normalizeDrawEntry(entry).components; entry.components.filter((component) => component.type === "boundary" && component.id === oldName).forEach((component) => { component.id = newName; }); } });
  } else if (collection === "transparencies") {
    scene.draws.forEach((entry) => { if (!isCommentEntry(entry)) { entry.components = normalizeDrawEntry(entry).components; entry.components.filter((component) => component.type === "transparency" && component.id === oldName).forEach((component) => { component.id = newName; }); } });
  }
  refreshMountedFieldsAfterRename();
  return true;
}

function refreshMountedFieldsAfterRename() {
  root.querySelectorAll?.(".mathquill-field[data-field]").forEach((field) => {
    const [collection, rawIndex, property] = field.dataset.field.split(".");
    if (collection === "settings") return;
    const entry = scene[collection]?.[Number(rawIndex)];
    if (!entry || isCommentEntry(entry) || !(property in entry)) return;
    const value = Array.isArray(entry[property]) ? entry[property].join(",") : entry[property];
    const latex = latexSourceFromExpression(String(value ?? ""));
    field.dataset.value = latex;
    const mathField = field.mathquillInstance ?? field.__mathField;
    if (!mathField) return;
    field.dataset.initializing = "true";
    mathField.latex(latex);
    mathField.reflow?.();
    delete field.dataset.initializing;
  });
  root.querySelectorAll?.("[data-reference-picker]").forEach((picker) => {
    const value = sceneFieldValue(picker.dataset.referencePicker);
    const label = picker.querySelector(".reference-summary span");
    if (label && value != null) label.textContent = String(value || "default");
  });
}

function sceneFieldValue(path) {
  const parts = String(path ?? "").split(".");
  if (parts[0] === "settings") return parts.slice(1).reduce((value, key) => value?.[key], scene.settings);
  return parts.reduce((value, key, index) => {
    if (index === 0) return scene[key];
    return value?.[/^\d+$/.test(key) ? Number(key) : key];
  }, scene);
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
  const entry = functionEntryForScene(scene.functions[index]);
  entry.expression = formatSliderValue(value, entry);
  scene.functions[index] = entry;
  markUnsavedChange();
  syncSliderRangeControl(index, entry);
  if (!syncField) return;
  const valueField = root.querySelector(`[data-field="functions.${index}.expression"]`);
  if (valueField) {
    valueField.dataset.value = latexSourceFromExpression(entry.expression);
    const mathField = valueField.mathquillInstance;
    if (mathField) mathField.latex(valueField.dataset.value);
  }
  syncSliderRangeControl(index, entry);
}

function syncSliderRangeControl(index, rawEntry = scene.functions[index]) {
  const rangeField = root.querySelector(`[data-slider-value="${index}"]`);
  if (!rangeField) return;
  const entry = normalizeFunctionEntry(rawEntry);
  const min = evaluateScalarSetting(entry.sliderMin);
  const max = evaluateScalarSetting(entry.sliderMax);
  const value = evaluateScalarSetting(entry.expression);
  const rangeUsable = Number.isFinite(min) && Number.isFinite(max) && max > min;
  rangeField.disabled = !rangeUsable;
  rangeField.min = String(rangeUsable ? min : 0);
  rangeField.max = String(rangeUsable ? max : 1);
  rangeField.value = String(rangeUsable && Number.isFinite(value) ? clampNumber(value, min, max) : 0);
}

function refreshAfterSliderChange() {
  const diagnostics = latestDiagnostics ?? validateScene();
  updateStatusLights(diagnostics);
  renderScene(diagnostics);
}

function timeVariableEntries() {
  return scene.functions
    .map((entry, index) => ({ raw: entry, index }))
    .filter(({ raw }) => !isCommentEntry(raw))
    .map(({ raw, index }) => ({ entry: normalizeFunctionEntry(raw), index }))
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
  animationFpsWindowStart = 0;
  animationFpsFrameCount = 0;
  animationFps = 0;
  updateFpsCounter();
  animationFrameId = requestAnimationFrame(stepTimeAnimation);
}

function stopAnimationLoop() {
  if (!animationFrameId) return;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
  animationLastTimestamp = 0;
  animationFpsWindowStart = 0;
  animationFpsFrameCount = 0;
  animationFps = 0;
  updateFpsCounter();
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
    recordAnimationFrame(timestamp);
  }
  animationFrameId = requestAnimationFrame(stepTimeAnimation);
}

function recordAnimationFrame(timestamp) {
  if (!animationFpsWindowStart) animationFpsWindowStart = timestamp;
  animationFpsFrameCount += 1;
  const elapsed = timestamp - animationFpsWindowStart;
  if (elapsed < 500) return;
  animationFps = Math.max(0, Math.round((animationFpsFrameCount * 1000) / elapsed));
  animationFpsWindowStart = timestamp;
  animationFpsFrameCount = 0;
  updateFpsCounter();
}

function updateFpsCounter() {
  const counter = root?.querySelector?.("[data-fps-counter]");
  if (counter) counter.textContent = playingTimeIds.size ? `${animationFps} FPS` : "-- FPS";
}

function advanceTimeVariables(deltaSeconds) {
  const entries = timeVariableEntries();
  for (const { entry, index } of entries) {
    if (!playingTimeIds.has(entry.id)) continue;
    const current = evaluateScalarSetting(entry.expression);
    const min = evaluateScalarSetting(entry.sliderMin);
    const max = evaluateScalarSetting(entry.sliderMax);
    const mode = normalizeTimeMode(entry.timeMode);
    const configuredRate = evaluateScalarSetting(entry.timeRate);
    const rate = Number.isFinite(configuredRate) ? configuredRate : 0;
    const base = Number.isFinite(current) ? current : Number.isFinite(min) ? min : 0;
    let next = base + deltaSeconds * TIME_VARIABLE_RATE * rate;
    if (mode !== "unbounded" && Number.isFinite(min) && Number.isFinite(max) && max > min) {
      if (mode === "bounded_looped") {
        const span = max - min;
        next = min + positiveModulo(next - min, span);
      } else {
        const direction = timeVariableDirections.get(entry.id) ?? 1;
        const boundedBase = clampNumber(base, min, max);
        const reflected = reflectBoundedTimeValue(boundedBase + direction * deltaSeconds * TIME_VARIABLE_RATE * rate, min, max, direction);
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
  const entry = dataEntries(scene.functions).find((item) => item.id === id);
  return entry ? normalizeFunctionEntry(entry) : (id === DEFAULT_DRAW_FUNCTION.id ? DEFAULT_DRAW_FUNCTION : null);
}

function resolveColorEntry(id) {
  return dataEntries(scene.colors).find((entry) => entry.id === id) ??
    (id === DEFAULT_DRAW_COLOR.id || LEGACY_DEFAULT_COLOR_IDS.has(id) ? DEFAULT_DRAW_COLOR : null);
}

function resolveBoundaryEntry(id) {
  return dataEntries(scene.restrictions).find((entry) => entry.id === id) ??
    (id === DEFAULT_DRAW_BOUNDARY.id || LEGACY_DEFAULT_BOUNDARY_IDS.has(id) ? DEFAULT_DRAW_BOUNDARY : null);
}

function resolveTransparencyEntry(id) {
  return dataEntries(scene.transparencies).find((entry) => entry.id === id) ??
    (id === DEFAULT_DRAW_TRANSPARENCY.id ? DEFAULT_DRAW_TRANSPARENCY : null);
}

function normalizeDrawEntry(entry) {
  const components = Array.isArray(entry?.components)
    ? entry.components.filter((component) => ["color", "boundary", "transparency"].includes(component?.type)).map((component) => ({ type: component.type, id: String(component.id ?? "default") }))
    : [
        entry?.colorId ? { type: "color", id: String(entry.colorId) } : null,
        entry?.restrictionId ? { type: "boundary", id: String(entry.restrictionId) } : null,
        entry?.transparencyId ? { type: "transparency", id: String(entry.transparencyId) } : null
      ].filter(Boolean);
  return { ...entry, equationId: String(entry?.equationId ?? ""), components, hidden: Boolean(entry?.hidden) };
}

function drawComponent(draw, type) {
  return normalizeDrawEntry(draw).components.find((component) => component.type === type) ?? null;
}

function drawFunctionEntries() {
  const functions = dataEntries(scene.functions).map(normalizeFunctionEntry);
  return functions.length ? functions : [DEFAULT_DRAW_FUNCTION];
}

function drawColorEntries() {
  const colors = dataEntries(scene.colors);
  return colors.some((entry) => entry.id === DEFAULT_DRAW_COLOR.id)
    ? colors
    : [DEFAULT_DRAW_COLOR, ...colors];
}

function drawBoundaryEntries() {
  const restrictions = dataEntries(scene.restrictions);
  return restrictions.some((entry) => entry.id === DEFAULT_DRAW_BOUNDARY.id)
    ? restrictions
    : [DEFAULT_DRAW_BOUNDARY, ...restrictions];
}

function drawTransparencyEntries() {
  const entries = dataEntries(scene.transparencies);
  return entries.some((entry) => entry.id === DEFAULT_DRAW_TRANSPARENCY.id)
    ? entries
    : [DEFAULT_DRAW_TRANSPARENCY, ...entries];
}

function sceneFunctionEnv(includeDefault = false) {
  const functions = dataEntries(scene.functions);
  const entries = functions.map((entry) => {
    const normalized = normalizeFunctionEntry(entry);
    return [normalized.id, normalized];
  });
  if (includeDefault && !functions.some((entry) => entry.id === DEFAULT_DRAW_FUNCTION.id)) {
    entries.push([DEFAULT_DRAW_FUNCTION.id, DEFAULT_DRAW_FUNCTION]);
  }
  return Object.fromEntries(entries);
}

function defaultEntryForKind(kind) {
  if (kind === "functions") {
    return { id: nextEntryId(scene.functions, "f"), kind: "variable", expression: "" };
  }
  if (kind === "colors") {
    return { id: nextEntryId(scene.colors, "c"), red: "0", green: "0", blue: "0" };
  }
  if (kind === "restrictions") {
    return { id: nextEntryId(scene.restrictions, "r"), expression: firstDataId(scene.functions), checkSmaller: false };
  }
  if (kind === "transparencies") return { id: nextEntryId(scene.transparencies, "a"), expression: "0" };
  if (kind === "draws") {
    return {
      equationId: drawFunctionEntries()[0]?.id ?? "",
      components: [],
      hidden: false
    };
  }
  if (kind === "folders") return { id: nextEntryId(scene.folders, "folder"), collapsed: false };
  if (kind === "points") return { id: nextEntryId(scene.points, "p"), x: "0", y: "0", colorId: "default", draggable: true };
  return null;
}

function convertedEntryForKind(targetKind, sourceEntry, targetSubtype = "variable") {
  const sourceId = String(sourceEntry?.id ?? "").trim();
  const expression = String(sourceEntry?.expression ?? sourceEntry?.equationId ?? firstDataId(scene.functions) ?? "");
  const comment = Object.prototype.hasOwnProperty.call(sourceEntry ?? {}, "comment") ? { comment: sourceEntry.comment ?? "" } : {};
  if (targetKind === "functions") {
    const next = functionEntryForScene({ id: sourceId || nextEntryId(scene.functions, "f"), kind: targetSubtype, expression });
    next.kind = FUNCTION_ENTRY_KINDS.has(targetSubtype) ? targetSubtype : "variable";
    return { ...next, ...comment };
  }
  if (targetKind === "colors") {
    return { id: sourceId || nextEntryId(scene.colors, "c"), red: expression || "0", green: expression || "0", blue: expression || "0", ...comment };
  }
  if (targetKind === "restrictions") {
    return { id: sourceId || nextEntryId(scene.restrictions, "r"), expression: expression || firstDataId(scene.functions), checkSmaller: false, ...comment };
  }
  if (targetKind === "transparencies") return { id: sourceId || nextEntryId(scene.transparencies, "a"), expression: expression || "0", ...comment };
  if (targetKind === "draws") {
    return {
      equationId: sourceId || drawFunctionEntries()[0]?.id || "",
      components: [],
      hidden: false,
      ...comment
    };
  }
  if (targetKind === "points") {
    return { id: sourceId || nextEntryId(scene.points, "p"), x: "0", y: "0", colorId: "default", draggable: true, ...comment };
  }
  return null;
}

function changeDataEntryKind(fromKind, fromIndex, target) {
  if (!DATA_ENTRY_KINDS.includes(fromKind) || !scene[fromKind]?.[fromIndex]) return null;
  const targetKind = DATA_ENTRY_KINDS.includes(target) ? target : "functions";
  const targetSubtype = DATA_ENTRY_KINDS.includes(target) ? "variable" : target;
  if (fromKind === "functions" && targetKind === "functions") {
    if (!FUNCTION_ENTRY_KINDS.has(targetSubtype)) return null;
    const entry = functionEntryForScene(scene.functions[fromIndex]);
    entry.kind = targetSubtype;
    scene.functions[fromIndex] = entry;
    return { kind: "functions", index: fromIndex };
  }
  const sourceEntry = scene[fromKind][fromIndex];
  const uid = ensureEntryUid(sourceEntry, fromKind);
  const converted = convertedEntryForKind(targetKind, sourceEntry, targetSubtype);
  if (!converted) return null;
  converted._uid = uid;
  const ref = scene.dataOrder?.find((item) => item.kind === fromKind && item.uid === uid);
  scene[fromKind].splice(fromIndex, 1);
  if (!Array.isArray(scene[targetKind])) scene[targetKind] = [];
  scene[targetKind].push(converted);
  if (ref) ref.kind = targetKind;
  if (selectedDependencyEntry?.uid === uid) selectedDependencyEntry.kind = targetKind;
  ensureSceneDataOrder(scene);
  return { kind: targetKind, index: scene[targetKind].length - 1 };
}

function addEntry(kind, type = "data") {
  if (!Array.isArray(scene[kind])) return null;
  const entry = type === "comment" || kind === "settingsComments" ? createCommentEntry("") : defaultEntryForKind(kind);
  if (!entry) return null;
  scene[kind].push(entry);
  if (DATA_ENTRY_KINDS.includes(kind)) {
    ensureEntryUid(entry, kind);
    if (!Array.isArray(scene.dataOrder)) scene.dataOrder = [];
    scene.dataOrder.push({ kind, uid: entry._uid });
  }
  return { kind, index: scene[kind].length - 1 };
}

function createReferenceEntry(field) {
  const componentMatch = String(field ?? "").match(/^draws\.(\d+)\.components\.(\d+)\.id$/);
  const componentType = componentMatch
    ? scene.draws[Number(componentMatch[1])]?.components?.[Number(componentMatch[2])]?.type
    : "";
  let kind = "functions";
  if (/^(draws|points)\.\d+\.colorId$/.test(field) || componentType === "color" || field === "settings.backgroundColor") kind = "colors";
  else if (/^draws\.\d+\.restrictionId$/.test(field) || componentType === "boundary") kind = "restrictions";
  else if (componentType === "transparency") kind = "transparencies";
  const target = addEntry(kind);
  if (!target) return null;
  const entry = scene[kind][target.index];
  if (kind === "functions") entry.kind = "variable";
  return { ...target, id: entry.id };
}

function moveEntry(kind, index, direction) {
  if (!Array.isArray(scene[kind]) || !Number.isInteger(index) || !Number.isInteger(direction)) return false;
  const target = index + direction;
  if (index < 0 || target < 0 || index >= scene[kind].length || target >= scene[kind].length || index === target) return false;
  const [entry] = scene[kind].splice(index, 1);
  scene[kind].splice(target, 0, entry);
  return true;
}

function moveMixedDataEntry(fromKind, fromIndex, toKind, toIndex, position = "before") {
  if (!DATA_ENTRY_KINDS.includes(fromKind) || !DATA_ENTRY_KINDS.includes(toKind)) return false;
  const fromEntry = scene[fromKind]?.[fromIndex];
  const toEntry = scene[toKind]?.[toIndex];
  if (!fromEntry || !toEntry) return false;
  ensureSceneDataOrder(scene);
  const fromUid = ensureEntryUid(fromEntry, fromKind);
  const toUid = ensureEntryUid(toEntry, toKind);
  const fromOrderIndex = scene.dataOrder.findIndex((ref) => ref.kind === fromKind && ref.uid === fromUid);
  const toOrderIndex = scene.dataOrder.findIndex((ref) => ref.kind === toKind && ref.uid === toUid);
  if (fromOrderIndex < 0 || toOrderIndex < 0 || fromOrderIndex === toOrderIndex) return false;
  const targetParentUid = scene.dataOrder[toOrderIndex]?.parentUid ?? "";
  const [ref] = scene.dataOrder.splice(fromOrderIndex, 1);
  const targetAfterRemoval = scene.dataOrder.findIndex((item) => item.kind === toKind && item.uid === toUid);
  const adjustedTo = targetAfterRemoval + (position === "after" ? 1 : 0);
  ref.parentUid = targetParentUid;
  scene.dataOrder.splice(adjustedTo, 0, ref);
  return true;
}

function moveEntryIntoFolder(fromKind, fromIndex, folderIndex) {
  if (!DATA_ENTRY_KINDS.includes(fromKind) || !scene[fromKind]?.[fromIndex] || !scene.folders?.[folderIndex]) return false;
  const entry = scene[fromKind][fromIndex];
  const folder = scene.folders[folderIndex];
  const entryUid = ensureEntryUid(entry, fromKind);
  const folderUid = ensureEntryUid(folder, "folders");
  if (entryUid === folderUid || folderHasAncestor(folderUid, entryUid)) return false;
  const ref = scene.dataOrder.find((item) => item.kind === fromKind && item.uid === entryUid);
  if (!ref) return false;
  const refIndex = scene.dataOrder.indexOf(ref);
  scene.dataOrder.splice(refIndex, 1);
  ref.parentUid = folderUid;
  let insertionIndex = scene.dataOrder.findIndex((item) => item.kind === "folders" && item.uid === folderUid) + 1;
  for (let index = 0; index < scene.dataOrder.length; index += 1) {
    if (scene.dataOrder[index].parentUid === folderUid) insertionIndex = index + 1;
  }
  scene.dataOrder.splice(Math.max(0, insertionIndex), 0, ref);
  return true;
}

function moveEntryToRoot(kind, index) {
  const entry = scene[kind]?.[index];
  if (!entry) return false;
  const uid = ensureEntryUid(entry, kind);
  const ref = scene.dataOrder.find((item) => item.kind === kind && item.uid === uid);
  if (!ref) return false;
  ref.parentUid = "";
  return true;
}

function moveEntryToRootEnd(kind, index) {
  const entry = scene[kind]?.[index];
  if (!entry) return false;
  ensureSceneDataOrder(scene);
  const uid = ensureEntryUid(entry, kind);
  const refIndex = scene.dataOrder.findIndex((item) => item.kind === kind && item.uid === uid);
  if (refIndex < 0) return false;
  const [ref] = scene.dataOrder.splice(refIndex, 1);
  ref.parentUid = "";
  scene.dataOrder.push(ref);
  return true;
}

function moveEntryToDropSlot(kind, index, slot) {
  if (!slot) return false;
  if (slot.dataset?.entryDropEnd != null) return moveEntryToRootEnd(kind, index);
  const [toKind, rawToIndex] = String(slot.dataset?.entryDropBefore ?? "").split(".");
  const toIndex = Number(rawToIndex);
  if (!DATA_ENTRY_KINDS.includes(toKind) || !Number.isInteger(toIndex)) return false;
  return moveMixedDataEntry(kind, index, toKind, toIndex, "before");
}

function folderHasAncestor(folderUid, possibleAncestorUid) {
  let cursor = folderUid;
  const seen = new Set();
  while (cursor && !seen.has(cursor)) {
    if (cursor === possibleAncestorUid) return true;
    seen.add(cursor);
    cursor = scene.dataOrder.find((ref) => ref.kind === "folders" && ref.uid === cursor)?.parentUid ?? "";
  }
  return false;
}

function toggleDrawHidden(index) {
  if (!scene.draws[index] || isCommentEntry(scene.draws[index])) return;
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
  const removedUid = removed?._uid;
  if (removedUid && selectedDependencyEntry?.kind === kind && selectedDependencyEntry.uid === removedUid) selectedDependencyEntry = null;
  const removedRef = scene.dataOrder?.find((ref) => ref.kind === kind && ref.uid === removedUid);
  if (kind === "folders" && removedUid) {
    for (const ref of scene.dataOrder ?? []) {
      if (ref.parentUid === removedUid) ref.parentUid = removedRef?.parentUid ?? "";
    }
  }
  scene[kind].splice(index, 1);
  if (DATA_ENTRY_KINDS.includes(kind) && removedUid) {
    scene.dataOrder = (scene.dataOrder ?? []).filter((ref) => !(ref.kind === kind && ref.uid === removedUid));
  }
  if (isCommentEntry(removed)) return;
  if (kind === "functions") {
    const replacement = firstDataId(scene.functions);
    scene.draws.forEach((draw) => {
      if (isCommentEntry(draw)) return;
      if (draw.equationId === removed.id) draw.equationId = replacement;
    });
    scene.colors.forEach((color) => {
      if (isCommentEntry(color)) return;
      if (color.red === removed.id) color.red = replacement;
      if (color.green === removed.id) color.green = replacement;
      if (color.blue === removed.id) color.blue = replacement;
    });
    scene.restrictions.forEach((restriction) => {
      if (isCommentEntry(restriction)) return;
      if (restriction.expression === removed.id) restriction.expression = replacement;
    });
  }
  if (kind === "colors") {
    const replacement = firstDataId(scene.colors);
    scene.draws.forEach((draw) => { if (!isCommentEntry(draw)) { draw.components = normalizeDrawEntry(draw).components; draw.components.filter((component) => component.type === "color" && component.id === removed.id).forEach((component) => { component.id = replacement || "default"; }); } });
    if (scene.settings.backgroundColor === removed.id) {
      scene.settings.backgroundColor = replacement || "0";
    }
  }
  if (kind === "restrictions") {
    const replacement = firstDataId(scene.restrictions);
    scene.draws.forEach((draw) => { if (!isCommentEntry(draw)) { draw.components = normalizeDrawEntry(draw).components; draw.components.filter((component) => component.type === "boundary" && component.id === removed.id).forEach((component) => { component.id = replacement || "default"; }); } });
  }
  if (kind === "transparencies") {
    const replacement = firstDataId(scene.transparencies);
    scene.draws.forEach((draw) => { if (!isCommentEntry(draw)) { draw.components = normalizeDrawEntry(draw).components; draw.components.filter((component) => component.type === "transparency" && component.id === removed.id).forEach((component) => { component.id = replacement || "default"; }); } });
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
      drawGraphOverlay();
      return;
    }

    renderSceneCpu(canvas);
    drawGraphOverlay();
  } catch (error) {
    window.__leptonRuntimeError = error.message;
    const overlay = root.querySelector(".render-overlay");
    if (overlay) {
      overlay.textContent = `Render error: ${error.message}`;
    }
  }
}

function drawGraphOverlay() {
  const canvas = root.querySelector(".graph-overlay-canvas");
  const base = root.querySelector(".grid-canvas");
  if (!canvas || !base) return;
  const rect = base.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,rect.width,rect.height);
  const vp = displayViewportForSize(viewport, rect.width, rect.height);
  const sx = (x) => (x-vp.xMin)/(vp.xMax-vp.xMin)*rect.width;
  const sy = (y) => rect.height-(y-vp.yMin)/(vp.yMax-vp.yMin)*rect.height;
  const rawStep = (vp.xMax-vp.xMin)/10; const pow = 10 ** Math.floor(Math.log10(rawStep)); const step = [1,2,5,10].find(n=>n*pow>=rawStep) * pow;
  ctx.font="11px system-ui"; ctx.lineWidth=1;
  if (scene.settings.showCoordinateGrid !== false) {
    if (scene.settings.showGrid !== false) {
      ctx.strokeStyle="rgba(75,90,115,.18)";
      for(let x=Math.ceil(vp.xMin/step)*step;x<=vp.xMax;x+=step){ctx.beginPath();ctx.moveTo(sx(x),0);ctx.lineTo(sx(x),rect.height);ctx.stroke();}
      for(let y=Math.ceil(vp.yMin/step)*step;y<=vp.yMax;y+=step){ctx.beginPath();ctx.moveTo(0,sy(y));ctx.lineTo(rect.width,sy(y));ctx.stroke();}
    }
    const axisX=Math.max(12,Math.min(rect.width-12,sx(0))), axisY=Math.max(12,Math.min(rect.height-12,sy(0)));
    ctx.strokeStyle="rgba(45,55,72,.48)";
    if(scene.settings.showYAxis!==false){ctx.beginPath();ctx.moveTo(axisX,0);ctx.lineTo(axisX,rect.height);ctx.stroke();}
    if(scene.settings.showXAxis!==false){ctx.beginPath();ctx.moveTo(0,axisY);ctx.lineTo(rect.width,axisY);ctx.stroke();}
    ctx.fillStyle="rgba(45,55,72,.72)";
    if(scene.settings.showXAxis!==false&&scene.settings.showXNumbers!==false) for(let x=Math.ceil(vp.xMin/step)*step;x<=vp.xMax;x+=step) ctx.fillText(Number(x.toPrecision(6)),sx(x)+3,axisY-4);
    if(scene.settings.showYAxis!==false&&scene.settings.showYNumbers!==false) for(let y=Math.ceil(vp.yMin/step)*step;y<=vp.yMax;y+=step) ctx.fillText(Number(y.toPrecision(6)),axisX+4,sy(y)-3);
  }
  const env=buildRuntimeEnv(sceneFunctionEnv(true));
  for(const point of dataEntries(scene.points)){
    const x=compileExpression(point.x)(0,0,env),y=compileExpression(point.y)(0,0,env);if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    const color=resolveColorEntry(point.colorId??"default"); let rgb=[37,99,235];
    if(color){try{rgb=[compileExpression(color.red)(x,y,env),compileExpression(color.green)(x,y,env),compileExpression(color.blue)(x,y,env)].map(channel);}catch{} }
    ctx.beginPath();ctx.arc(sx(x),sy(y),6,0,Math.PI*2);ctx.fillStyle=`rgb(${rgb.join(",")})`;ctx.fill();ctx.strokeStyle="#fff";ctx.stroke();
  }
}

function drawErrorState(canvas, message) {
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true }) ?? canvas.getContext("webgl", { preserveDrawingBuffer: true });
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
  renderSceneCpuInto(canvas);
}

function renderSceneCpuInto(canvas, options = {}) {
  const rect = canvas.getBoundingClientRect?.() ?? { width: canvas.width || 1, height: canvas.height || 1 };
  const cssWidth = Math.max(1, options.cssWidth ?? rect.width);
  const cssHeight = Math.max(1, options.cssHeight ?? rect.height);
  const dpr = options.dpr ?? window.devicePixelRatio ?? 1;
  canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
  canvas.height = Math.max(1, Math.floor(cssHeight * dpr));

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const backgroundColor = resolveBackgroundColor();
  drawGrid(ctx, cssWidth, cssHeight, backgroundColor.custom ? backgroundColor.rgb : null);

  const env = buildRuntimeEnv(sceneFunctionEnv(true));
  const visibleViewport = options.visibleViewport ?? displayViewportForSize(viewport, cssWidth, cssHeight);
  if (options.updateOverlay !== false) updateBoundaryOverlay(canvas, visibleViewport);
  const clipViewport = scene.settings.drawOnlyInsideBoundary ? sceneViewport() : null;
  const shouldClip = clipViewport && isValidViewport(clipViewport);
  const xPoints = axis(visibleViewport.xMin, visibleViewport.xMax, scene.settings.xPoints);
  const yPoints = axis(visibleViewport.yMin, visibleViewport.yMax, scene.settings.yPoints);
  const pixelWidth = cssWidth / Math.max(1, xPoints.length - 1);
  const pixelHeight = cssHeight / Math.max(1, yPoints.length - 1);

  for (const draw of dataEntries(scene.draws)) {
    if (draw.hidden) continue;
    const fn = resolveFunctionEntry(draw.equationId);
    const color = resolveColorEntry(drawComponent(draw, "color")?.id ?? "default");
    const restriction = resolveBoundaryEntry(drawComponent(draw, "boundary")?.id ?? "default");
    const transparency = resolveTransparencyEntry(drawComponent(draw, "transparency")?.id ?? "default");
    if (!fn || !color || !restriction || !transparency) continue;

    let evaluate;
    let red;
    let green;
    let blue;
    let boundary;
    let transparencyValue;
    try {
      evaluate = compileExpression(fn.expression, fn.kind === "function" ? new Set(fn.params) : new Set());
      red = compileExpression(color.red);
      green = compileExpression(color.green);
      blue = compileExpression(color.blue);
      boundary = compileExpression(restriction.expression);
      transparencyValue = compileExpression(transparency.expression);
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

        const opacity = 1 - clampNumber(transparencyValue(z, y, env), 0, 1);
        if (!Number.isFinite(opacity) || opacity <= 0) continue;
        ctx.globalAlpha = opacity;
        ctx.fillStyle = `rgb(${channel(red(z, y, env))}, ${channel(green(z, y, env))}, ${channel(blue(z, y, env))})`;
        ctx.fillRect(xi * pixelWidth, cssHeight - (yi + 1) * pixelHeight, Math.ceil(pixelWidth), Math.ceil(pixelHeight));
      }
    }
  }
  ctx.globalAlpha = 1;
}

function renderSceneWebGl(canvas) {
  return renderSceneWebGlInto(canvas);
}

function renderSceneWebGlInto(canvas, options = {}) {
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true }) ?? canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) return false;

  const rect = canvas.getBoundingClientRect?.() ?? { width: canvas.width || 1, height: canvas.height || 1 };
  const cssWidth = Math.max(1, options.cssWidth ?? rect.width);
  const cssHeight = Math.max(1, options.cssHeight ?? rect.height);
  const dpr = options.dpr ?? window.devicePixelRatio ?? 1;
  const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
  const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const visibleViewport = options.visibleViewport ?? displayViewportForSize(viewport, cssWidth, cssHeight);
  if (options.updateOverlay !== false) updateBoundaryOverlay(canvas, visibleViewport);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const shaderKey = webGlShaderCacheKey();
  let cached = webGlRenderCache.get(canvas);
  if (!cached || cached.gl !== gl || cached.shaderKey !== shaderKey) {
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
      showShaderError(window.__leptonShaderLog || "The generated shader could not be compiled.", fragmentSource.length);
      return options.fallbackOnFailure === true ? false : true;
    }
    if (cached?.program) gl.deleteProgram(cached.program);
    if (cached?.buffer) gl.deleteBuffer(cached.buffer);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    cached = {
      gl,
      shaderKey,
      program,
      buffer,
      position: gl.getAttribLocation(program, "a_position"),
      uniforms: {
        resolution: gl.getUniformLocation(program, "u_resolution"),
        bounds: gl.getUniformLocation(program, "u_bounds"),
        clipBounds: gl.getUniformLocation(program, "u_clip_bounds"),
        clipEnabled: gl.getUniformLocation(program, "u_clip_enabled"),
        randomSeed: gl.getUniformLocation(program, "u_random_seed"),
        background: gl.getUniformLocation(program, "u_background"),
        time: timeUniformBindings().map((binding) => ({ ...binding, location: gl.getUniformLocation(program, binding.uniform) }))
      }
    };
    webGlRenderCache.set(canvas, cached);
    window.__leptonShaderBuildCount = (window.__leptonShaderBuildCount ?? 0) + 1;
  }
  if (!cached?.program) {
    window.__leptonGlError = gl.getError();
    gl.clearColor(0.98, 0.94, 0.94, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    showShaderError(window.__leptonShaderLog || "The generated shader could not be compiled.", 0);
    return options.fallbackOnFailure === true ? false : true;
  }
  clearShaderError();

  gl.bindBuffer(gl.ARRAY_BUFFER, cached.buffer);
  gl.useProgram(cached.program);
  gl.enableVertexAttribArray(cached.position);
  gl.vertexAttribPointer(cached.position, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(cached.uniforms.resolution, canvas.width, canvas.height);
  gl.uniform1f(cached.uniforms.randomSeed, Number(scene.settings.randomSeed) || 1);
  gl.uniform4f(
    cached.uniforms.bounds,
    visibleViewport.xMin,
    visibleViewport.xMax,
    visibleViewport.yMin,
    visibleViewport.yMax
  );
  const clipViewport = sceneViewport();
  const clipEnabled = scene.settings.drawOnlyInsideBoundary && isValidViewport(clipViewport);
  const safeClipViewport = clipEnabled ? clipViewport : visibleViewport;
  gl.uniform1i(cached.uniforms.clipEnabled, clipEnabled ? 1 : 0);
  gl.uniform4f(
    cached.uniforms.clipBounds,
    safeClipViewport.xMin,
    safeClipViewport.xMax,
    safeClipViewport.yMin,
    safeClipViewport.yMax
  );
  const backgroundColor = resolveBackgroundColor();
  gl.uniform3f(cached.uniforms.background, backgroundColor.rgb[0] / 255, backgroundColor.rgb[1] / 255, backgroundColor.rgb[2] / 255);
  for (const binding of cached.uniforms.time) {
    const entry = timeVariableEntries().find(({ entry: candidate }) => candidate.id === binding.id)?.entry;
    const value = evaluateScalarSetting(entry?.expression);
    gl.uniform1f(binding.location, Number.isFinite(value) ? value : 0);
  }
  gl.clearColor(backgroundColor.rgb[0] / 255, backgroundColor.rgb[1] / 255, backgroundColor.rgb[2] / 255, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  if (options.synchronous === true) gl.finish();
  return true;
}

function timeUniformBindings() {
  return timeVariableEntries().map(({ entry }, index) => ({ id: entry.id, uniform: `u_time_${index}` }));
}

function timeUniformGlslMap() {
  return Object.fromEntries(timeUniformBindings().map(({ id, uniform }) => [id, uniform]));
}

function webGlShaderCacheKey() {
  const functions = dataEntries(scene.functions).map(normalizeFunctionEntry).map((entry) =>
    entry.kind === "slider" && entry.time ? { ...entry, expression: "__time_uniform__" } : entry
  );
  return JSON.stringify({
    forceGradient: Boolean(window.__leptonForceGradient),
    functions,
    colors: dataEntries(scene.colors),
    restrictions: dataEntries(scene.restrictions),
    transparencies: dataEntries(scene.transparencies),
    draws: dataEntries(scene.draws),
    angleMode: scene.settings.angleMode
  });
}

function showShaderError(log, sourceLength) {
  let overlay = root.querySelector(".render-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "render-overlay render-overlay-error";
    root.querySelector(".renderer-pane")?.append(overlay);
  }
  const summary = String(log ?? "").replace(/\s+/g, " ").trim();
  overlay.textContent = `Shader error (${sourceLength.toLocaleString()} characters): ${summary || "compilation failed"}`;
}

function clearShaderError() {
  const overlay = root.querySelector(".render-overlay");
  if (overlay?.classList.contains("render-overlay-error")) overlay.remove();
}

function resolveBackgroundColor() {
  const fallback = { custom: false, rgb: [247, 250, 252] };
  const id = scene.settings.backgroundColor ?? "0";
  if (id === "0") return fallback;
  const color = dataEntries(scene.colors).find((entry) => entry.id === id);
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
  const dynamicMap = timeUniformGlslMap();
  const layers = dataEntries(scene.draws)
    .map((draw) => {
      if (draw?.hidden) return null;
      const fn = resolveFunctionEntry(draw?.equationId);
      const color = resolveColorEntry(drawComponent(draw, "color")?.id ?? "default");
      const restriction = resolveBoundaryEntry(drawComponent(draw, "boundary")?.id ?? "default");
      const transparency = resolveTransparencyEntry(drawComponent(draw, "transparency")?.id ?? "default");
      if (!fn || !color || !restriction || !transparency) return null;
      if (
        validateExpression(fn.expression, env, [fn.id], fn.kind === "function" ? new Set(fn.params) : new Set()).status === "invalid" ||
        validateExpression(color.red, env).status === "invalid" ||
        validateExpression(color.green, env).status === "invalid" ||
        validateExpression(color.blue, env).status === "invalid" ||
        validateExpression(restriction.expression, env).status === "invalid" ||
        validateExpression(transparency.expression, env).status === "invalid"
      ) {
        return null;
      }
      try {
        return {
          expr: expressionToGlsl(fn.expression, env, null, [], scene.settings.angleMode, { ...dynamicMap, ...(fn.kind === "function" ? defaultParamGlslMap(fn.params) : {}) }),
          red: expressionToGlsl(color.red, env, "z", [], scene.settings.angleMode, dynamicMap),
          green: expressionToGlsl(color.green, env, "z", [], scene.settings.angleMode, dynamicMap),
          blue: expressionToGlsl(color.blue, env, "z", [], scene.settings.angleMode, dynamicMap),
          bound: expressionToGlsl(restriction.expression, env, null, [], scene.settings.angleMode, dynamicMap),
          transparency: expressionToGlsl(transparency.expression, env, "z", [], scene.settings.angleMode, dynamicMap),
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
          vec3 layerColor = clamp(vec3(${layer.red}, ${layer.green}, ${layer.blue}) / 255.0, 0.0, 1.0);
          float opacity = 1.0 - clamp(${layer.transparency}, 0.0, 1.0);
          color = mix(color, layerColor, opacity);
          painted = true;
        }
      }`
        )
        .join("\n")
    : "";
  const timeUniforms = timeUniformBindings().map(({ uniform }) => `uniform float ${uniform};`).join("\n      ");

  return `
      precision highp float;
      uniform vec2 u_resolution;
      uniform vec4 u_bounds;
      uniform vec4 u_clip_bounds;
      uniform bool u_clip_enabled;
      uniform float u_random_seed;
      uniform vec3 u_background;
      ${timeUniforms}

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
    float leptonUnion(float a, float b) { return min(a, b); }
    float leptonIntersect(float a, float b) { return max(a, b); }
    float leptonSubtract(float a, float b) { return max(-a, b); }
    float leptonRandom(vec2 value) { return fract(sin(dot(value, vec2(12.9898, 78.233)) + u_random_seed * 0.000173) * 43758.5453123); }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float x = mix(u_bounds.x, u_bounds.y, uv.x);
      float y = mix(u_bounds.z, u_bounds.w, uv.y);
      vec3 color = u_background;
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
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    window.__leptonShaderLog = gl.getProgramInfoLog(program);
    window.__leptonFailedShaderSource = fragmentSource;
    console.warn(window.__leptonShaderLog);
    gl.deleteProgram(program);
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
    window.__leptonFailedShaderSource = source;
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
  const normalizedSource = normalizeExpressionDisplayText(source);
  const piecewise = parsePiecewiseExpression(normalizedSource);
  if (piecewise) {
    const branches = piecewise.branches.map(({condition,value}) => ({ condition: compileExpression(resolvePiecewiseCondition(condition), localNames), value: compileExpression(value, localNames) }));
    const fallback = piecewise.fallback ? compileExpression(piecewise.fallback, localNames) : null;
    return (x,y,env) => { for (const branch of branches) if (branch.condition(x,y,env)) return branch.value(x,y,env); return fallback ? fallback(x,y,env) : NaN; };
  }
  let js = normalizeMathSyntax(normalizeExpressionText(normalizedSource));
  js = rewritePointSelectors(js, (point, coordinate) => `point("${point.id}",${coordinate})`);
  const functionEnv = sceneFunctionEnv(true);
  const rewriteRuntimeFunctionCalls = (expression) => rewriteCustomFunctionCalls(expression, functionEnv, (entry, args) => {
    if (args.length !== entry.params.length) {
      throw new Error(`Function ${entry.id} expects ${entry.params.length} input${entry.params.length === 1 ? "" : "s"}`);
    }
    return `call("${entry.id}", [${args.map(rewriteRuntimeFunctionCalls).join(",")}], x, y)`;
  });
  js = rewriteRuntimeFunctionCalls(js);
  js = convertPowers(js)
    .replaceAll(/~([A-Za-z]\w*)~/g, 'ref("$1", x, y)')
    .replaceAll(/\bpi\b/g, "Math.PI")
    .replaceAll(/\be\b/g, "Math.E")
    .replaceAll(/\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|abs|sign|floor|ceil|round|min|max|exp|log|pow)\b/g, "Math.$1")
    .replaceAll(/\barc(sin|cos|tan)\b/g, "Math.a$1");

  js = rewriteBareIdentifiers(
    js,
    (name) => localNames.has(name) ? `local("${name}")` : `ref("${name}", x, y)`,
    new Set(["Math", "E", "PI", "call", "local", "point"]),
    localNames
  );

  return new Function(
    "x",
    "y",
    "env",
    `
      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
      const union = (a, b) => Math.min(a, b);
      const intersect = (a, b) => Math.max(a, b);
      const subtract = (a, b) => Math.max(-a, b);
      const random = () => {
        const seed = Number(env.__randomSeed ?? 1);
        const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.000173) * 43758.5453123;
        return value - Math.floor(value);
      };
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
      const point = (name, coordinate) => env.__point ? env.__point(name, coordinate, env) : NaN;
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
  Object.defineProperty(runtimeEnv, "__randomSeed", { value: Number(scene.settings.randomSeed) || 1, enumerable: false, configurable: true });
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
  Object.defineProperty(runtimeEnv, "__point", {
    value: (name, coordinate, env) => {
      const point = dataEntries(scene.points).find((entry) => entry.id === name);
      const runtime = env.__runtime ?? { depth: 0, maxDepth: recursionLimit() };
      if (!point || runtime.depth >= runtime.maxDepth) return NaN;
      runtime.depth += 1;
      try { return compileExpression(coordinate === 0 ? point.x : point.y)(0, 0, env); }
      finally { runtime.depth -= 1; }
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
  const normalizedSource = normalizeExpressionDisplayText(source);
  const piecewise = parsePiecewiseExpression(normalizedSource);
  if (piecewise) {
    let result = piecewise.fallback ? expressionToGlsl(piecewise.fallback, env, zName, stack, angleMode, localMap) : "(0.0/0.0)";
    for (const branch of [...piecewise.branches].reverse()) result = `((${expressionToGlsl(resolvePiecewiseCondition(branch.condition), env, zName, stack, angleMode, localMap)}) ? (${expressionToGlsl(branch.value, env, zName, stack, angleMode, localMap)}) : (${result}))`;
    return result;
  }
  let expression = normalizeMathSyntax(normalizeExpressionText(normalizedSource));
  expression = rewritePointSelectors(expression, (point, coordinate) => {
    const pointKey = `point:${point.id}:${coordinate}`;
    if (stack.includes(pointKey) || stack.length >= recursionLimit()) return "(0.0/0.0)";
    return `(${expressionToGlsl(coordinate === 0 ? point.x : point.y, env, zName, [...stack, pointKey], angleMode, localMap)})`;
  });
  expression = rewriteCustomFunctionCalls(expression, env, (entry, args) => {
    if (args.length !== entry.params.length) {
      throw new Error(`Function ${entry.id} expects ${entry.params.length} input${entry.params.length === 1 ? "" : "s"}`);
    }
    const expandedArgs = args.map((arg) => expressionToGlsl(arg, env, zName, stack, angleMode, localMap));
    const nextLocalMap = { ...localMap, ...Object.fromEntries(entry.params.map((param, index) => [param, `(${expandedArgs[index]})`])) };
    return `(${expressionToGlsl(entry.expression, env, zName, [...stack, entry.id], angleMode, nextLocalMap)})`;
  });
  expression = inlineCustomVariables(expression, env, stack, zName, angleMode, localMap);
  expression = inlineBareVariables(expression, env, stack, zName, angleMode, localMap);
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
    .replaceAll(/\bunion\b/g, "leptonUnion")
    .replaceAll(/\bintersect\b/g, "leptonIntersect")
    .replaceAll(/\bsubtract\b/g, "leptonSubtract")
    .replaceAll(/\brandom\s*\(\s*\)/g, "leptonRandom(vec2(x,y))")
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
  if (!/^[\dA-Za-z_+\-*/().,\s~<>=!]+$/.test(expression)) {
    throw new Error(`Unsupported GLSL expression: ${source}`);
  }
  return expression;
}

function parsePiecewiseExpression(source) {
  const text=String(source??"").trim(); if(!text.startsWith("{")||!text.endsWith("}"))return null;
  const parts=splitTopLevelText(text.slice(1,-1),","); const branches=[]; let fallback="";
  for(const part of parts){const pair=splitTopLevelText(part,":");if(pair.length>1)branches.push({condition:pair.shift().trim(),value:pair.join(":").trim()});else fallback=part.trim();}
  return branches.length?{branches,fallback}:null;
}
function rewritePointSelectors(expression, build) {
  let output = String(expression ?? "");
  const points = dataEntries(scene.points).filter((point) => point.id).sort((a,b) => b.id.length-a.id.length);
  for (const point of points) {
    const id = point.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replaceAll(new RegExp(`\\b${id}\\s*(?:\\.\\s*([xy])|\\[\\s*([01])\\s*\\])`, "g"), (_, axis, index) => build(point, axis ? (axis === "x" ? 0 : 1) : Number(index)));
  }
  return output;
}
function splitTopLevelText(source, separator){const out=[];let start=0,depth=0;for(let i=0;i<source.length;i++){if("({[".includes(source[i]))depth++;else if(")}]".includes(source[i]))depth--;else if(source[i]===separator&&depth===0){out.push(source.slice(start,i));start=i+1;}}out.push(source.slice(start));return out;}
function resolvePiecewiseCondition(condition){const boundary=dataEntries(scene.restrictions).find(r=>r.id===condition.trim());if(!boundary)return condition;return `(${boundary.expression})${boundary.checkSmaller?"<=":">="}0`;}

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
    const nextLocalMap = entry.kind === "function" ? { ...localMap, ...defaultParamGlslMap(entry.params, zName) } : localMap;
    return `(${expressionToGlsl(entry.expression, env, zName, [...stack, name], angleMode, nextLocalMap)})`;
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
      const nextLocalMap = entry.kind === "function" ? { ...localMap, ...defaultParamGlslMap(entry.params, zName) } : localMap;
      return `(${expressionToGlsl(entry.expression, env, zName, [...stack, name], angleMode, nextLocalMap)})`;
    },
    GENERATED_GLSL_NAMES,
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
    if (/^u_time_\d+$/.test(name)) return name;
    if (overrideNames.has(name)) return replace(name);
    if (BUILTIN_NAMES.has(name) || extraReserved.has(name)) return name;
    return replace(name);
  });
}

function validateScene() {
  const env = sceneFunctionEnv();
  const drawEnv = sceneFunctionEnv(true);
  const duplicateIds = {
    functions: duplicateEntryIds(scene.functions),
    colors: duplicateEntryIds(scene.colors),
    restrictions: duplicateEntryIds(scene.restrictions),
    transparencies: duplicateEntryIds(scene.transparencies ?? []),
    folders: duplicateEntryIds(scene.folders ?? []),
    points: duplicateEntryIds(scene.points ?? [])
  };
  const diagnostics = {
    functions: [],
    colors: [],
    restrictions: [],
    transparencies: [],
    draws: [],
    folders: [],
    points: [],
    settings: [],
    hasErrors: false,
    summary: "GLSL ready"
  };
  diagnostics.settings = [viewportDiagnostic()];
  const timeVariableCount = scene.functions
    .filter((entry) => !isCommentEntry(entry))
    .map(normalizeFunctionEntry)
    .filter((entry) => entry.kind === "slider" && entry.time).length;

  diagnostics.functions = scene.functions.map((rawEntry) => {
    if (isCommentEntry(rawEntry)) return { status: "valid", message: "Comment" };
    const entry = normalizeFunctionEntry(rawEntry);
    const label = entry.kind === "slider" ? "Slider" : entry.kind === "function" ? "Function" : "Expression";
    const idResult = validateEntryId(entry.id, label, env, entry.kind === "slider" || entry.kind === "variable");
    if (idResult.status === "invalid") return idResult;
    const duplicateDiagnostic = duplicateIdDiagnostic(entry.id, label, duplicateIds.functions);
    if (entry.kind === "slider") {
      return combineDiagnostics([
        duplicateDiagnostic,
        idResult,
        sliderCoordinateDiagnostic(entry),
        timeVariableDiagnostic(entry, timeVariableCount),
        timeRateDiagnostic(entry, env),
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
    if (isCommentEntry(entry)) return { status: "valid", message: "Comment" };
    const idResult = validateEntryId(entry.id, "Color", env, false);
    const duplicateDiagnostic = duplicateIdDiagnostic(entry.id, "Color", duplicateIds.colors);
    const channels = {
      red: validateExpression(entry.red, env),
      green: validateExpression(entry.green, env),
      blue: validateExpression(entry.blue, env)
    };
    const combined = combineDiagnostics([
      duplicateDiagnostic,
      idResult,
      channels.red,
      channels.green,
      channels.blue
    ]);
    return { ...combined, channels };
  });
  diagnostics.restrictions = scene.restrictions.map((entry) => {
    if (isCommentEntry(entry)) return { status: "valid", message: "Comment" };
    const idResult = validateEntryId(entry.id, "Boundary", env, false);
    if (idResult.status === "invalid") return idResult;
    const duplicateDiagnostic = duplicateIdDiagnostic(entry.id, "Boundary", duplicateIds.restrictions);
    return combineDiagnostics([duplicateDiagnostic, idResult, validateExpression(entry.expression, env)]);
  });
  diagnostics.transparencies = (scene.transparencies ?? []).map((entry) => {
    if (isCommentEntry(entry)) return { status: "valid", message: "Comment" };
    return combineDiagnostics([
      duplicateIdDiagnostic(entry.id, "Transparency", duplicateIds.transparencies),
      validateEntryId(entry.id, "Transparency", env, false),
      validateExpression(entry.expression, env)
    ]);
  });
  diagnostics.draws = scene.draws.map((entry) => {
    if (isCommentEntry(entry)) return { status: "valid", message: "Comment" };
    if (entry.hidden) {
      return { status: "valid", message: "Draw layer hidden" };
    }
    const missing = [];
    const fn = resolveFunctionEntry(entry.equationId);
    const color = resolveColorEntry(drawComponent(entry, "color")?.id ?? "default");
    const restriction = resolveBoundaryEntry(drawComponent(entry, "boundary")?.id ?? "default");
    const transparency = resolveTransparencyEntry(drawComponent(entry, "transparency")?.id ?? "default");
    if (!fn) missing.push("function");
    if (!color) missing.push("color");
    if (!restriction) missing.push("boundary");
    if (!transparency) missing.push("transparency");
    if (missing.length) return { status: "invalid", message: `Missing ${missing.join(", ")}` };
    const affected = combineDiagnostics([
      validateExpression(fn.expression, drawEnv, [fn.id], fn.kind === "function" ? new Set(fn.params) : new Set()),
      validateExpression(color.red, drawEnv),
      validateExpression(color.green, drawEnv),
      validateExpression(color.blue, drawEnv),
      validateExpression(restriction.expression, drawEnv),
      validateExpression(transparency.expression, drawEnv)
    ]);
    return affected.status === "invalid"
      ? { status: "invalid", message: `Draw layer skipped: ${affected.message}` }
      : affected.status === "warning" || affected.status === "info"
        ? affected
      : { status: "valid", message: "Draw layer is valid" };
  });
  diagnostics.folders = (scene.folders ?? []).map((entry) => combineDiagnostics([
    duplicateIdDiagnostic(entry.id ?? "", "Folder", duplicateIds.folders),
    validateFolderName(entry.id ?? "")
  ]));
  diagnostics.folders = aggregateFolderDiagnostics(diagnostics);
  diagnostics.points = (scene.points ?? []).map((entry) => combineDiagnostics([
    duplicateIdDiagnostic(entry.id ?? "", "Point", duplicateIds.points),
    validateEntryId(entry.id ?? "", "Point", env, false),
    validateExpression(entry.x, env),
    validateExpression(entry.y, env),
    resolveColorEntry(entry.colorId ?? "default")
      ? { status: "valid", message: "Point color is valid" }
      : { status: "invalid", message: `Missing point color: ${entry.colorId}` }
  ]));

  const all = [...diagnostics.functions, ...diagnostics.colors, ...diagnostics.restrictions, ...diagnostics.transparencies, ...diagnostics.draws, ...diagnostics.points, ...diagnostics.folders, ...diagnostics.settings];
  const firstError = all.find((item) => item.status === "invalid");
  const firstInfo = all.find((item) => item.status === "info");
  const firstWarning = all.find((item) => item.status === "warning");
  diagnostics.hasErrors = Boolean(firstError);
  diagnostics.summary = firstError ? firstError.message : firstInfo ? firstInfo.message : firstWarning ? firstWarning.message : "GLSL ready";
  latestDiagnostics = diagnostics;
  return diagnostics;
}

function validateFolderName(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { status: "invalid", message: "Folder name cannot be blank" };
  if (/[={}\n\r]/.test(trimmed)) return { status: "invalid", message: "Folder names cannot contain =, {, or }" };
  return { status: "valid", message: "Folder name is valid" };
}

function aggregateFolderDiagnostics(diagnostics) {
  const memo = new Map();
  const visiting = new Set();
  const priority = { valid: 0, warning: 1, info: 2, invalid: 3 };
  const visit = (index) => {
    if (memo.has(index)) return memo.get(index);
    if (visiting.has(index)) return { status: "invalid", message: "Folder nesting cannot contain a cycle" };
    visiting.add(index);
    const folder = scene.folders[index];
    const uid = ensureEntryUid(folder, "folders");
    const candidates = [diagnostics.folders[index]];
    for (const ref of scene.dataOrder ?? []) {
      if (ref.parentUid !== uid) continue;
      const childIndex = scene[ref.kind]?.findIndex((entry) => ensureEntryUid(entry, ref.kind) === ref.uid) ?? -1;
      if (childIndex < 0) continue;
      candidates.push(ref.kind === "folders" ? visit(childIndex) : diagnostics[ref.kind]?.[childIndex]);
    }
    visiting.delete(index);
    const result = candidates.filter(Boolean).reduce((best, item) => (priority[item.status] > priority[best.status] ? item : best), { status: "valid", message: "Folder and contents are valid" });
    const wrapped = result.status === "valid" ? result : { status: result.status, message: `Folder contains: ${result.message}` };
    memo.set(index, wrapped);
    return wrapped;
  };
  return (scene.folders ?? []).map((_, index) => visit(index));
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

function timeRateDiagnostic(entry, env) {
  if (!entry.time) return { status: "valid", message: "Time rate is not active" };
  if (expressionDependsOnCoordinates(entry.timeRate, env)) {
    return { status: "invalid", message: "Time units per second cannot depend on x or y" };
  }
  const result = validateExpression(entry.timeRate, env);
  if (result.status === "invalid") return { status: "invalid", message: `Invalid time rate: ${result.message}` };
  const value = evaluateScalarSetting(entry.timeRate);
  return Number.isFinite(value)
    ? { status: "valid", message: `Time advances at ${value} unit${Math.abs(value) === 1 ? "" : "s"} per second` }
    : { status: "invalid", message: "Time units per second must evaluate to a finite number" };
}

function expressionDependsOnCoordinates(source, env, seen = new Set(), localNames = new Set()) {
  const identifiers = expressionIdentifiers(source);
  if (identifiers.some((name) => (name === "x" || name === "y") && !localNames.has(name))) return true;
  for (const name of identifiers) {
    if (seen.has(name) || BUILTIN_NAMES.has(name) || localNames.has(name)) continue;
    const definition = envEntry(env, name);
    if (!definition) continue;
    seen.add(name);
    if (expressionDependsOnCoordinates(definition.expression, env, seen, definition.kind === "function" ? new Set(definition.params) : new Set())) return true;
  }
  return false;
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
    if (isCommentEntry(entry)) continue;
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

function validateEntryId(id, label, env = {}, warnForReservedSubstring = true) {
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
  if (warnForReservedSubstring) {
    const substring = [...SUBSTRING_RESERVED_NAMES]
      .sort((left, right) => right.length - left.length)
      .find((name) => trimmed !== name && trimmed.includes(name));
    if (substring) {
      return { status: "warning", message: `${label} name "${trimmed}" contains reserved name "${substring}"` };
    }
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
    if (/\brandom\s*\(\s*[^)]/i.test(normalized)) throw new Error("random() does not accept a seed or other inputs; use the seed button on the graph");
    const emptyCall = [...normalized.matchAll(/\b([A-Za-z]\w*)\(\s*\)/g)].find((match) => match[1] !== "random");
    if (emptyCall) {
      throw new Error("Empty function argument");
    }
    const nodeCount = estimateExpandedNodeCount(source, env, stack, new Map(), localNames);
    if (nodeCount > NODE_BLUE_FLAG_THRESHOLD) {
      return { status: "info", message: `Equation is large (${formatNodeCount(nodeCount)} nodes); graph may not render` };
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
  return total > NODE_COUNT_DISPLAY_CAP + 1 ? NODE_COUNT_DISPLAY_CAP + 1 : total;
}

function formatNodeCount(value) {
  if (value > NODE_COUNT_DISPLAY_CAP) return `>${NODE_COUNT_DISPLAY_CAP.toLocaleString()}`;
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
  root.querySelectorAll(".expression-row[data-entry-kind][data-entry-index]").forEach((row) => {
    const status = row.querySelector(".entry-status");
    const kind = row.dataset.entryKind;
    const index = Number(row.dataset.entryIndex);
    const item = diagnostics[kind]?.[index];
    if (!status || !item) return;
    status.classList.toggle("valid", item.status === "valid");
    status.classList.toggle("invalid", item.status === "invalid");
    status.classList.toggle("info", item.status === "info");
    status.classList.toggle("warning", item.status === "warning");
    status.setAttribute("title", item.message);
    status.setAttribute("aria-label", item.message);
    row.setAttribute("title", item.message);
    const typeIcon = row.querySelector(".entry-type-static");
    if (typeIcon) {
      for (const state of ["valid", "invalid", "info", "warning"]) typeIcon.classList.toggle(state, item.status === state);
      typeIcon.setAttribute("title", item.message);
    }
    if (kind === "colors" && item.channels) {
      for (const [channel, channelDiagnostic] of Object.entries(item.channels)) {
        const light = row.querySelector(`[data-color-channel="${index}.${channel}"] .channel-status`);
        if (!light) continue;
        for (const state of ["valid", "invalid", "info", "warning"]) light.classList.toggle(state, channelDiagnostic.status === state);
        const label = channelDiagnostic.status === "valid" ? "status: valid" : channelDiagnostic.message;
        light.setAttribute("title", label);
        light.setAttribute("aria-label", label);
      }
    }
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
  random: "\\operatorname{random}",
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
  if (token.type === "command" && ["\\right", "\\rvert", "\\rfloor", "\\rceil"].includes(token.value)) return true;
  return token.type === "operator" && [")", "}", "]", ","].includes(token.value);
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

      if (name === "random") {
        return { type: "call", name, args: [] };
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
      const expr = parseInfixExpression(UNARY_OPERAND_PRECEDENCE);
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

      if (name === "random") {
        return { type: "call", name, args: [] };
      }
      
      let args = [];
      const nextToken = peek();
      if (nextToken && nextToken.type === "operator" && (nextToken.value === "{" || nextToken.value === "(")) {
        const openChar = nextToken.value;
        const closeChar = openChar === "{" ? "}" : ")";
        next();
        if (!(peek()?.type === "operator" && peek()?.value === closeChar)) {
          while (true) {
            args.push(parseInfixExpression(0));
            if (peek()?.type === "operator" && peek()?.value === ",") next();
            else break;
          }
        }
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
      } else if (opToken.value === "^") {
        left = { type: "power", base: left, exponent: right };
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
  // MathQuill adds \left/\right around scalable grouping delimiters. They are
  // presentation-only; retaining them makes a multi-argument operatorname call
  // look like one grouped argument to the AST parser.
  const normalized = String(source ?? "")
    .replace(/\\left\s*(?=[()[\]{}])/g, "")
    .replace(/\\right\s*(?=[()[\]{}])/g, "");
  const tokens = tokenizeLatex(normalized);
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
    const value = astToLatex(node.value);
    return `${node.op}${node.value.type === "binary" ? `\\left(${value}\\right)` : value}`;
  }
  if (node.type === "power") {
    const base = astToLatex(node.base);
    return `${node.base.type === "binary" || node.base.type === "unary" ? `\\left(${base}\\right)` : base}^{${astToLatex(node.exponent)}}`;
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
    if (name === "random" && args.length === 0) {
      return "\\operatorname{random}";
    }
    if (name === "abs" && args.length === 1) {
      return `\\left|${args[0]}\\right|`;
    }
    if (name === "floor" && args.length === 1) {
      return `\\operatorname{floor}\\left(${args[0]}\\right)`;
    }
    if (name === "ceil" && args.length === 1) {
      return `\\operatorname{ceil}\\left(${args[0]}\\right)`;
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
    return `frac{${astToLeptonText(node.num)}}{${astToLeptonText(node.den)}}`;
  }
  if (node.type === "unary") {
    const value = astToLeptonText(node.value);
    return `${node.op}${node.value.type === "binary" ? `(${value})` : value}`;
  }
  if (node.type === "power") {
    const rawBase = astToLeptonText(node.base);
    const base = node.base.type === "binary" || node.base.type === "unary" ? `(${rawBase})` : rawBase;
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
    if (name === "frac" && args.length === 2) {
      return `frac{${args[0]}}{${args[1]}}`;
    }
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
    const value = astToMathString(node.value);
    return `${node.op}${node.value.type === "binary" ? `(${value})` : value}`;
  }
  if (node.type === "power") {
    const rawBase = astToMathString(node.base);
    const base = node.base.type === "binary" || node.base.type === "unary" ? `(${rawBase})` : rawBase;
    const exponent = astToMathString(node.exponent);
    return `${base}^${node.exponent.type === "number" || node.exponent.type === "identifier" ? exponent : `(${exponent})`}`;
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
    const value = astToEditableHtml(node.value);
    return `${node.op}${node.value.type === "binary" ? `(${value})` : value}`;
  }
  if (node.type === "power") {
    const base = astToEditableHtml(node.base);
    const groupedBase = node.base.type === "binary" || node.base.type === "unary" ? `(${base})` : base;
    return `<span class="mq-power" data-command="power"><span class="mq-base">${groupedBase}</span><span class="mq-exponent">${astToEditableHtml(node.exponent)}</span></span>`;
  }
  if (node.type === "binary") {
    let left = astToEditableHtml(node.left);
    let right = astToEditableHtml(node.right);
    if (node.left.type === "binary" && getOpPrecedence(node.left.op) < getOpPrecedence(node.op)) left = `(${left})`;
    if (node.right.type === "binary" && getOpPrecedence(node.right.op) <= getOpPrecedence(node.op)) right = `(${right})`;
    return `${left}${node.op}${right}`;
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

function sourceFromRenderedNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  if (node.dataset?.latex) return node.dataset.latex;
  return Array.from(node.childNodes).map(sourceFromRenderedNode).join("");
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
    let start = scanIdentifierStart(source, cursor) ?? cursor;
    if (source[start - 1] === "^") start = splitPreviousOperand(source, start - 1).start;
    return { start };
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
    show_coordinate_grid: "showCoordinateGrid", show_grid: "showGrid", show_x_axis: "showXAxis", show_y_axis: "showYAxis", show_x_numbers: "showXNumbers", show_y_numbers: "showYNumbers",
    unbounded_decimal_places: "unboundedDecimalPlaces",
    random_seed: "randomSeed",
    unbounded_integer_digits: null
  };
  const mapped = settingMap[String(key ?? "").trim()];
  if (!mapped) return;
  if (mapped === "angleMode") {
    target.settings[mapped] = normalizeAngleMode(value);
  } else if (mapped === "backgroundColor") {
    target.settings[mapped] = String(value ?? "").trim() || "0";
  } else if (["ensureSquareGrid", "drawOnlyInsideBoundary", "showCoordinateGrid", "showGrid", "showXAxis", "showYAxis", "showXNumbers", "showYNumbers"].includes(mapped)) {
    target.settings[mapped] = parseLeptonBoolean(value);
    if (mapped === "showXAxis" && !target.settings[mapped]) target.settings.showXNumbers = false;
    if (mapped === "showYAxis" && !target.settings[mapped]) target.settings.showYNumbers = false;
    if (mapped === "showXNumbers" && target.settings.showXAxis === false) target.settings.showXNumbers = false;
    if (mapped === "showYNumbers" && target.settings.showYAxis === false) target.settings.showYNumbers = false;
  } else if (mapped === "aspectRatio") {
    target.settings[mapped] = String(value ?? "").trim() || "1:1";
  } else if (["maxRecursion", "unboundedDecimalPlaces", "randomSeed"].includes(mapped)) {
    const number = Number(value);
    if (Number.isFinite(number)) target.settings[mapped] = number;
  } else {
    target.settings[mapped] = String(value ?? "").trim();
  }
}

function exportScene() {
  ensureSceneDataOrder(scene);
  return [
    ...settingsCommentEntries().map((entry) => exportStandaloneComment(entry, "settings")),
    exportSettingLine("x_min", scene.settings.xMin),
    exportSettingLine("x_max", scene.settings.xMax),
    exportSettingLine("y_min", scene.settings.yMin),
    exportSettingLine("y_max", scene.settings.yMax),
    exportSettingLine("max_recursion", scene.settings.maxRecursion),
    exportSettingLine("angle_mode", normalizeAngleMode(scene.settings.angleMode)),
    exportSettingLine("background_color", scene.settings.backgroundColor ?? "0"),
    exportSettingLine("ensure_square_grid", formatLeptonBoolean(scene.settings.ensureSquareGrid !== false)),
    exportSettingLine("aspect_ratio", scene.settings.aspectRatio ?? "1:1"),
    exportSettingLine("draw_only_inside_boundary", formatLeptonBoolean(Boolean(scene.settings.drawOnlyInsideBoundary))),
    exportSettingLine("show_coordinate_grid", formatLeptonBoolean(scene.settings.showCoordinateGrid !== false)),
    exportSettingLine("show_grid", formatLeptonBoolean(scene.settings.showGrid !== false)),
    exportSettingLine("show_x_axis", formatLeptonBoolean(scene.settings.showXAxis !== false)),
    exportSettingLine("show_y_axis", formatLeptonBoolean(scene.settings.showYAxis !== false)),
    exportSettingLine("show_x_numbers", formatLeptonBoolean(scene.settings.showXNumbers !== false)),
    exportSettingLine("show_y_numbers", formatLeptonBoolean(scene.settings.showYNumbers !== false)),
    exportSettingLine("unbounded_decimal_places", clampInteger(scene.settings.unboundedDecimalPlaces ?? 3, 0, 12)),
    exportSettingLine("random_seed", clampInteger(scene.settings.randomSeed ?? 1, 1, 2147483647)),
    ...exportDataTree()
  ].join("\n");
}

function exportDataTree(parentUid = "", depth = 0) {
  const lines = [];
  for (const item of orderedDataEntries(scene).filter((entry) => (entry.parentUid || "") === parentUid)) {
    const indent = "  ".repeat(depth);
    if (item.kind === "folders") {
      const uid = ensureEntryUid(item.entry, "folders");
      lines.push(`${indent}${appendInlineComment(`folder ${item.entry.id || "folder"} = {`, item.entry.comment)}`);
      lines.push(...exportDataTree(uid, depth + 1));
      lines.push(`${indent}}`);
    } else {
      const line = exportOrderedDataEntry(item.kind, item.entry);
      if (line) lines.push(`${indent}${line}`);
    }
  }
  return lines;
}

function exportSettingLine(key, value) {
  return appendInlineComment(`set ${key} = ${value}`, scene.settingLineComments?.[key]);
}

function exportFunctionEntry(rawEntry, section = "functions") {
  if (isCommentEntry(rawEntry)) return exportStandaloneComment(rawEntry, section);
  const entry = normalizeFunctionEntry(rawEntry);
  const expression = textModeExpression(entry.expression);
  let line = "";
  if (entry.kind === "slider") {
    const range = entry.time && normalizeTimeMode(entry.timeMode) === "unbounded" ? "" : ` range ${textModeExpression(entry.sliderMin)}~${textModeExpression(entry.sliderMax)}`;
    const speed = entry.time ? ` speed ${textModeExpression(entry.timeRate)}` : "";
    line = entry.time ? `time ${entry.timeMode} ${entry.id} = ${expression}${range}${speed}` : `slider ${entry.id} = ${expression}${range}`;
  } else if (entry.kind === "function") {
    line = `function ${entry.id}(${entry.params.join(",")}) = ${expression}`;
  } else {
    line = `expression ${entry.id} = ${expression}`;
  }
  return appendInlineComment(line, entry.comment);
}

function exportColorEntry(entry) {
  if (isCommentEntry(entry)) return exportStandaloneComment(entry, "colors");
  return appendInlineComment(
    `colour ${entry.id} = ${textModeExpression(entry.red)}~${textModeExpression(entry.green)}~${textModeExpression(entry.blue)}`,
    entry.comment
  );
}

function exportRestrictionEntry(entry) {
  if (isCommentEntry(entry)) return exportStandaloneComment(entry, "restrictions");
  return appendInlineComment(
    `boundary ${entry.id} = ${textModeExpression(entry.expression)}~${formatLeptonBoolean(entry.checkSmaller)}`,
    entry.comment
  );
}

function exportTransparencyEntry(entry) {
  if (isCommentEntry(entry)) return exportStandaloneComment(entry, "transparencies");
  return appendInlineComment(`transparency ${entry.id} = ${textModeExpression(entry.expression)}`, entry.comment);
}

function exportDrawEntry(entry) {
  if (isCommentEntry(entry)) return exportStandaloneComment(entry, "draws");
  const draw = normalizeDrawEntry(entry);
  const fields = [draw.equationId];
  for (const component of draw.components) {
    const key = component.type === "color" ? "colour" : component.type;
    fields.push(`${key}=${component.id}`);
  }
  if (draw.hidden) fields.push("visible=False");
  return appendInlineComment(
    `draw(${fields.join(",")})`,
    entry.comment
  );
}

function exportPointEntry(entry) {
  return appendInlineComment(`point ${entry.id} = (${textModeExpression(entry.x)},${textModeExpression(entry.y)})~${formatLeptonBoolean(entry.draggable)}~${entry.colorId ?? "default"}`, entry.comment);
}

function exportStandaloneComment(entry, section = "functions") {
  const text = commentText(entry).trim();
  return text ? `// ${text}` : `//`;
}

function appendInlineComment(line, comment) {
  const trimmed = String(comment ?? "").trim();
  return trimmed ? `${line} // ${trimmed}` : line;
}

function splitLeptonComment(line) {
  const index = String(line ?? "").indexOf("//");
  if (index === -1) return { code: String(line ?? ""), comment: "", hasComment: false };
  return {
    code: String(line ?? "").slice(0, index).trimEnd(),
    comment: String(line ?? "").slice(index + 2),
    hasComment: true
  };
}

function withInlineComment(entry, comment) {
  const trimmed = String(comment ?? "").trim();
  return trimmed ? { ...entry, comment: trimmed } : entry;
}

function parseStandaloneComment(comment, currentSection = "functions") {
  const text = String(comment ?? "").trimStart();
  const match = text.match(/^(settings?|functions?|colou?rs?|bounds?|boundaries|restrictions?|transparenc(?:y|ies)|draws?)\s*:\s*(.*)$/i);
  if (!match) return { section: currentSection, text };
  const section = {
    setting: "settings",
    settings: "settings",
    function: "functions",
    functions: "functions",
    color: "colors",
    colors: "colors",
    colour: "colors",
    colours: "colors",
    bound: "restrictions",
    bounds: "restrictions",
    boundary: "restrictions",
    boundaries: "restrictions",
    restriction: "restrictions",
    restrictions: "restrictions",
    transparency: "transparencies",
    transparencies: "transparencies",
    draw: "draws",
    draws: "draws"
  }[match[1].toLowerCase()] ?? currentSection;
  return { section, text: match[2] };
}

function splitSliderRange(source) {
  const speedMatch = String(source ?? "").match(/^(.*?)(?:\s+speed\s+(.+))?$/i);
  const withoutSpeed = speedMatch?.[1] ?? source ?? "";
  const match = String(withoutSpeed).match(/^(.*?)(?:\s+range\s+(.+?)\s*~\s*(.+))?$/i);
  return {
    expression: (match?.[1] ?? source ?? "").trim(),
    sliderMin: (match?.[2] ?? "0").trim(),
    sliderMax: (match?.[3] ?? "10").trim(),
    timeRate: (speedMatch?.[2] ?? "1").trim()
  };
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
          output += `frac{${num}}{${den}}`;
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
          output += `frac{${num}}{${den}}`;
          i = endParen2 + 1;
          continue;
        }
      } else if (endParen1 !== -1) {
        const args = splitFunctionArgs(source.slice(startParen + 1, endParen1));
        if (args.length === 2) {
          const num = convertFracToDivisions(args[0]);
          const den = convertFracToDivisions(args[1]);
          output += `frac{${num}}{${den}}`;
          i = endParen1 + 1;
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
  next.transparencies = [];
  next.draws = [];
  next.folders = [];
  next.points = [];
  next.dataOrder = [];
  next.settingsComments = [];
  next.settingLineComments = {};
  let currentCommentSection = "functions";
  const pendingComments = [];
  const folderStack = [];
  const queueStandaloneComment = (comment) => {
    if (!String(comment ?? "").trim()) return;
    pendingComments.push(parseStandaloneComment(comment, null));
  };
  const flushPendingComments = (section) => {
    for (const pending of pendingComments.splice(0)) {
      const targetSection = pending.section ?? section;
      if (targetSection === "settings") {
        next.settingsComments.push(createCommentEntry(pending.text));
      } else {
        pushDataEntry(next, targetSection, createCommentEntry(pending.text));
      }
      currentCommentSection = targetSection;
    }
  };

  for (const rawLine of raw.replace(/\r\n/g, "\n").split("\n")) {
    const { code, comment } = splitLeptonComment(rawLine);
    const line = code.trim();
    if (!line) {
      queueStandaloneComment(comment);
      continue;
    }
    if (line === "~~~~~") continue;
    const folderOpen = line.match(/^folder\s+(.+?)\s*=\s*\{$/i);
    if (folderOpen) {
      next._importParentUid = folderStack.at(-1) ?? "";
      const folder = pushDataEntry(next, "folders", withInlineComment({ id: folderOpen[1].trim(), collapsed: false }, comment));
      folderStack.push(folder._uid);
      next._importParentUid = folder._uid;
      continue;
    }
    if (line === "}") {
      folderStack.pop();
      next._importParentUid = folderStack.at(-1) ?? "";
      continue;
    }
    if (line.startsWith("F:")) {
      const [id, expression] = splitFirst(line.slice(2), "~");
      flushPendingComments("functions");
      currentCommentSection = "functions";
      pushDataEntry(next, "functions", withInlineComment({ id, kind: "variable", expression: convertDivisionsToFrac(expression) }, comment));
    } else if (line.startsWith("C:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [red = "0", green = "0", blue = "0"] = rest.split("~");
      flushPendingComments("colors");
      currentCommentSection = "colors";
      pushDataEntry(next, "colors", withInlineComment({ id, red, green, blue }, comment));
    } else if (line.startsWith("R:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [expression = "1", flag = "0"] = rest.split("~");
      flushPendingComments("restrictions");
      currentCommentSection = "restrictions";
      pushDataEntry(next, "restrictions", withInlineComment({ id, expression: convertDivisionsToFrac(expression), checkSmaller: parseLeptonBoolean(flag) }, comment));
    } else if (line.startsWith("D~")) {
      const [, equationId, colorId, restrictionId, hidden = "0"] = line.split("~");
      flushPendingComments("draws");
      currentCommentSection = "draws";
      pushDataEntry(next, "draws", withInlineComment({ equationId, components: [{ type: "color", id: colorId }, { type: "boundary", id: restrictionId }], hidden: parseLeptonBoolean(hidden) }, comment));
    } else if (line.startsWith("S:")) {
      const [key, value] = splitFirst(line.slice(2), "~");
      flushPendingComments("settings");
      currentCommentSection = "settings";
      setSceneSetting(next, key, value);
      if (comment.trim()) next.settingLineComments[key] = comment.trim();
    } else if (/^set\s+/i.test(line)) {
      const assignment = line.match(/^set\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) {
        flushPendingComments("settings");
        currentCommentSection = "settings";
        setSceneSetting(next, assignment[1], assignment[2]);
        if (comment.trim()) next.settingLineComments[assignment[1]] = comment.trim();
      }
    } else if (/^(variable|expression)\s+/i.test(line)) {
      const assignment = line.match(/^(?:variable|expression)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) {
        flushPendingComments("functions");
        currentCommentSection = "functions";
        pushDataEntry(next, "functions", withInlineComment({ id: assignment[1], kind: "variable", expression: convertDivisionsToFrac(assignment[2].trim()) }, comment));
      }
    } else if (/^(slider|time)\s+/i.test(line)) {
      const assignment = line.match(/^(slider|time)(?:\s+(bounded_looped|bounded looped|bounded|unbounded))?\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) {
        const time = assignment[1].toLowerCase() === "time";
        const timeMode = normalizeTimeMode(assignment[2]);
        const range = splitSliderRange(assignment[4]);
        flushPendingComments("functions");
        currentCommentSection = "functions";
        pushDataEntry(next, "functions", withInlineComment({
          id: assignment[3],
          kind: "slider",
          expression: convertDivisionsToFrac(range.expression),
          sliderMin: convertDivisionsToFrac(range.sliderMin),
          sliderMax: convertDivisionsToFrac(range.sliderMax),
          time,
          timeMode,
          timeRate: convertDivisionsToFrac(range.timeRate)
        }, comment));
      }
    } else if (/^(function|map)\s+/i.test(line)) {
      const callAssignment = line.match(/^(?:function|map)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*=\s*(.+)$/i);
      if (callAssignment) {
        flushPendingComments("functions");
        currentCommentSection = "functions";
        pushDataEntry(next, "functions", withInlineComment({
          id: callAssignment[1],
          kind: "function",
          params: parseFunctionParams(callAssignment[2]),
          expression: convertDivisionsToFrac(callAssignment[3].trim())
        }, comment));
      } else {
        const assignment = line.match(/^(?:function|map)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
        if (assignment) {
          flushPendingComments("functions");
          currentCommentSection = "functions";
          pushDataEntry(next, "functions", withInlineComment({ id: assignment[1], kind: "variable", expression: convertDivisionsToFrac(assignment[2].trim()) }, comment));
        }
      }
    } else if (/^(colour|color)\s+/i.test(line)) {
      const assignment = line.match(/^(?:colour|color)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) {
        const [red = "0", green = "0", blue = "0"] = assignment[2].split("~").map((part) => part.trim());
        flushPendingComments("colors");
        currentCommentSection = "colors";
        pushDataEntry(next, "colors", withInlineComment({ id: assignment[1], red, green, blue }, comment));
      }
    } else if (/^(boundary|restriction)\s+/i.test(line)) {
      const assignment = line.match(/^(?:boundary|restriction)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) {
        const [expression = "1", flag = "False"] = assignment[2].split("~").map((part) => part.trim());
        flushPendingComments("restrictions");
        currentCommentSection = "restrictions";
        pushDataEntry(next, "restrictions", withInlineComment({ id: assignment[1], expression: convertDivisionsToFrac(expression), checkSmaller: parseLeptonBoolean(flag) }, comment));
      }
    } else if (/^transparency\s+/i.test(line)) {
      const assignment = line.match(/^transparency\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if (assignment) {
        flushPendingComments("transparencies");
        currentCommentSection = "transparencies";
        pushDataEntry(next, "transparencies", withInlineComment({ id: assignment[1], expression: convertDivisionsToFrac(assignment[2].trim()) }, comment));
      }
    } else if (/^draw\s*\(/i.test(line)) {
      const call = line.match(/^draw\s*\((.*)\)\s*$/i);
      if (call) {
        const args = splitFunctionArgs(call[1]).map((part) => part.trim());
        const equationId = args.shift() ?? "";
        let hidden = false;
        const components = [];
        if (args.some((part) => part.includes("="))) {
          for (const part of args) {
            const [rawKey, rawValue] = splitFirst(part, "=");
            const key = rawKey.trim().toLowerCase();
            const value = rawValue.trim();
            if (key === "colour" || key === "color") components.push({ type: "color", id: value });
            else if (key === "boundary" || key === "restriction") components.push({ type: "boundary", id: value });
            else if (key === "transparency") components.push({ type: "transparency", id: value });
            else if (key === "visible") hidden = !parseLeptonBoolean(value);
          }
        } else {
          const [colorId = "", restrictionId = "", legacyHidden = "False"] = args;
          if (colorId) components.push({ type: "color", id: colorId });
          if (restrictionId) components.push({ type: "boundary", id: restrictionId });
          hidden = parseLeptonBoolean(legacyHidden);
        }
        flushPendingComments("draws");
        currentCommentSection = "draws";
        pushDataEntry(next, "draws", withInlineComment({ equationId, components, hidden }, comment));
      }
    } else if (/^point\s+/i.test(line)) {
      const match = line.match(/^point\s+([A-Za-z_]\w*)\s*=\s*\((.+),(.+)\)\s*~\s*(True|False)(?:\s*~\s*([A-Za-z_]\w*|default))?$/i);
      if (match) pushDataEntry(next, "points", withInlineComment({ id: match[1], x: match[2].trim(), y: match[3].trim(), draggable: parseLeptonBoolean(match[4]), colorId: match[5] || "default" }, comment));
    }
  }
  flushPendingComments(currentCommentSection);

  delete next._importParentUid;

  return normalizeSceneReferences(next);
}

function normalizeSceneReferences(next) {
  const hasFunction = (id) => dataEntries(next.functions).some((entry) => entry.id === id);
  const ensureFunction = (preferredId, expression) => {
    const trimmed = String(expression ?? "").trim();
    if (hasFunction(trimmed)) return trimmed;
    let id = preferredId;
    let suffix = 2;
    while (hasFunction(id)) {
      id = `${preferredId}${suffix}`;
      suffix += 1;
    }
    pushDataEntry(next, "functions", { id, kind: "variable", expression: trimmed || "0" });
    return id;
  };

  next.restrictions.forEach((restriction) => {
    if (isCommentEntry(restriction)) return;
    restriction.expression = ensureFunction(`${restriction.id}_fn`, restriction.expression);
  });
  next.points.forEach((point) => {
    if (!point.colorId || (point.colorId !== "default" && !dataEntries(next.colors).some((color) => color.id === point.colorId))) point.colorId = "default";
  });
  next.draws = next.draws.map((draw) => isCommentEntry(draw) ? draw : normalizeDrawEntry(draw));
  if (next.settings.backgroundColor !== "0" && !dataEntries(next.colors).some((color) => color.id === next.settings.backgroundColor)) {
    next.settings.backgroundColor = "0";
  }
  ensureSceneDataOrder(next);
  return next;
}

function stripChannelPrefix(value) {
  return value.replace(/^[rgb]\s*=\s*/, "").trim();
}

function normalizeExpressionText(value) {
  const display = normalizeExpressionDisplayText(value);
  const pointSelectors = [];
  const protectedDisplay = rewritePointSelectors(display, (point, coordinate) => {
    const token = `leptonpointselector${pointSelectors.length}`;
    pointSelectors.push({ token, value: `${point.id}.${coordinate === 0 ? "x" : "y"}` });
    return token;
  });
  let normalized = latexToExpression(protectedDisplay);
  for (const selector of pointSelectors) normalized = normalized.replaceAll(selector.token, selector.value);
  return normalized;
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
    .replaceAll(/\\right\s*\]/g, "]")
    .replaceAll(/\\left\s*\\\{/g, "{")
    .replaceAll(/\\right\s*\\\}/g, "}");
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
    const { code } = splitLeptonComment(line);
    const declaration = code.match(/^\s*(?:variable|expression|slider|function|map|colour|color|boundary|restriction|transparency)\s+([A-Za-z_]\w*)/i);
    if (declaration) ids.add(declaration[1]);
    const time = code.match(/^\s*time\s+(?:bounded|unbounded|bounded_looped)\s+([A-Za-z_]\w*)/i);
    if (time) ids.add(time[1]);
  });
  return ids;
}

function highlightLeptonLine(line, context = { declaredIds: new Set() }) {
  const { code, comment, hasComment } = splitLeptonComment(line);
  return highlightLeptonCode(code, context) + (hasComment ? `<span class="syntax-comment">//${escapeHtml(comment)}</span>` : "");
}

function highlightLeptonCode(line, context = { declaredIds: new Set() }) {
  const folder = line.match(/^(\s*)(folder)(\s+)(.+?)(\s*=\s*\{)(.*)$/i);
  if (folder) {
    return `${escapeHtml(folder[1])}<span class="syntax-keyword">${folder[2]}</span>${escapeHtml(folder[3])}<span class="syntax-variable">${escapeHtml(folder[4])}</span><span class="syntax-operator">${escapeHtml(folder[5])}</span>${escapeHtml(folder[6])}`;
  }
  const declaration = line.match(/^(\s*)(set|variable|expression|slider|time|function|map|colour|color|boundary|restriction|transparency)(\b)/i);
  if (declaration) {
    const prefix = escapeHtml(declaration[1]);
    const keyword = declaration[2].toLowerCase();
    const rest = line.slice(declaration[1].length + keyword.length);
    const functionParams = ["function", "map"].includes(keyword) ? parseFunctionParams(line.match(/^\s*(?:function|map)\s+[A-Za-z_]\w*\s*\(([^)]*)\)/i)?.[1] ?? "") : [];
    return `${prefix}<span class="syntax-keyword">${declaration[2]}</span>${highlightLeptonTokens(rest, {
      ...context,
      markFirstNameAsSetting: keyword === "set",
      mathDefinition: ["variable", "expression", "slider", "time", "function", "map"].includes(keyword),
      localIds: new Set(functionParams)
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
  let afterDefinitionEquals = false;
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
      const inMathDefinition = Boolean(context.mathDefinition && afterDefinitionEquals);
      if (inMathDefinition) {
        cls = "syntax-number";
        if (token === "x" || token === "y" || context.declaredIds?.has(token) || context.localIds?.has(token)) {
          cls = "syntax-name";
        }
      } else if (context.markFirstNameAsSetting && firstName) {
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
    if (char === "=" && context.mathDefinition) afterDefinitionEquals = true;
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
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
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
    thumbnail: normalizeSavedGraphThumbnail(graph.thumbnail),
    createdAt: String(graph.createdAt ?? new Date().toISOString()),
    updatedAt: String(graph.updatedAt ?? graph.createdAt ?? new Date().toISOString())
  };
}

function writeSavedGraphs(graphs) {
  const compactGraphs = graphs.slice(0, SAVED_GRAPHS_LIMIT).map((graph) => ({
    ...graph,
    thumbnail: savedGraphThumbnailState(graph.thumbnail) === "compact" ? graph.thumbnail : fallbackSavedGraphThumbnail()
  }));
  localStorage.setItem(SAVED_GRAPHS_KEY, JSON.stringify(compactGraphs));
}

function isStorageQuotaError(error) {
  return error?.name === "QuotaExceededError" || error?.code === 22 || error?.code === 1014;
}

function saveCurrentGraph(name, { forceNew = false } = {}) {
  const graphs = loadSavedGraphs();
  const existing = forceNew ? null : graphs.find((graph) => graph.id === activeSavedGraphId);
  const now = new Date().toISOString();
  const graph = {
    id: existing?.id ?? createSavedGraphId(),
    name,
    scene: exportScene(),
    thumbnail: captureGraphThumbnail(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  writeSavedGraphs([graph, ...graphs.filter((saved) => saved.id !== graph.id)]);
  activeSavedGraphId = graph.id;
  markSaved();
  return graph;
}

function savedGraphForId(id) {
  if (!id) return null;
  return loadSavedGraphs().find((graph) => graph.id === id) ?? null;
}

function exportCurrentGraphImage() {
  syncFields();
  const diagnostics = validateScene();
  const exportViewport = exportViewportForImage();
  const size = exportCanvasSizeForViewport(exportViewport);
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = size.width;
  exportCanvas.height = size.height;
  const viewportIssue = diagnostics.settings?.find((item) => item.status === "invalid");
  if (viewportIssue || !isValidViewport(exportViewport)) {
    drawErrorCanvas(exportCanvas, viewportIssue?.message ?? "Invalid export viewport");
  } else {
    const exportedWithGl = renderSceneWebGlInto(exportCanvas, {
      cssWidth: size.width,
      cssHeight: size.height,
      dpr: 1,
      visibleViewport: exportViewport,
      updateOverlay: false,
      synchronous: true,
      fallbackOnFailure: true
    });
    if (!exportedWithGl) {
      drawErrorCanvas(exportCanvas, "Export needs GLSL-compatible expressions");
    }
  }
  requestAnimationFrame(() => {
    const filename = `${safeDownloadName(defaultSavedGraphName())}.png`;
    const download = (url) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
    };

    if (typeof exportCanvas.toBlob === "function") {
      exportCanvas.toBlob((blob) => {
        if (!blob) {
          download(exportCanvas.toDataURL("image/png"));
          return;
        }
        const url = URL.createObjectURL(blob);
        download(url);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
      return;
    }
    download(exportCanvas.toDataURL("image/png"));
  });
}

function exportViewportForImage() {
  const candidate = sceneViewport();
  if (isValidViewport(candidate)) return candidate;
  return {
    xMin: Number(DEFAULT_SCENE.settings.xMin),
    xMax: Number(DEFAULT_SCENE.settings.xMax),
    yMin: Number(DEFAULT_SCENE.settings.yMin),
    yMax: Number(DEFAULT_SCENE.settings.yMax)
  };
}

function exportCanvasSizeForViewport(exportViewport, sourceRect = null) {
  const fallbackRect = { width: 1200, height: 1200 };
  const canvas = root?.querySelector?.(".grid-canvas");
  const rect = sourceRect ?? canvas?.getBoundingClientRect?.() ?? fallbackRect;
  const dpr = window.devicePixelRatio || 1;
  const availableWidth = Math.max(1, Math.floor((rect.width || fallbackRect.width) * dpr));
  const availableHeight = Math.max(1, Math.floor((rect.height || fallbackRect.height) * dpr));
  const xRange = Math.max(Number.EPSILON, exportViewport.xMax - exportViewport.xMin);
  const yRange = Math.max(Number.EPSILON, exportViewport.yMax - exportViewport.yMin);
  const viewportRatio = xRange / yRange;
  const availableRatio = availableWidth / Math.max(1, availableHeight);
  let width;
  let height;
  if (availableRatio > viewportRatio) {
    height = availableHeight;
    width = height * viewportRatio;
  } else {
    width = availableWidth;
    height = width / viewportRatio;
  }
  const maxDimension = 2400;
  const largest = Math.max(width, height);
  if (largest > maxDimension) {
    const scale = maxDimension / largest;
    width *= scale;
    height *= scale;
  }
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };
}

function safeDownloadName(value) {
  const cleaned = String(value || "lepton-graph")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "lepton-graph";
}

function deleteSavedGraph(id) {
  writeSavedGraphs(loadSavedGraphs().filter((graph) => graph.id !== id));
  if (activeSavedGraphId === id) activeSavedGraphId = null;
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
    return createGraphThumbnailDataUrl(canvas);
  } catch {
    return fallbackSavedGraphThumbnail();
  }
}

function createGraphThumbnailDataUrl(sourceCanvas) {
  const thumbnail = document.createElement("canvas");
  thumbnail.width = SAVED_GRAPH_THUMBNAIL_WIDTH;
  thumbnail.height = SAVED_GRAPH_THUMBNAIL_HEIGHT;
  const context = thumbnail.getContext("2d");
  if (!context) return fallbackSavedGraphThumbnail();

  context.fillStyle = "#111827";
  context.fillRect(0, 0, thumbnail.width, thumbnail.height);
  const scale = Math.min(thumbnail.width / sourceCanvas.width, thumbnail.height / sourceCanvas.height);
  const width = sourceCanvas.width * scale;
  const height = sourceCanvas.height * scale;
  context.drawImage(sourceCanvas, (thumbnail.width - width) / 2, (thumbnail.height - height) / 2, width, height);
  return normalizeSavedGraphThumbnail(thumbnail.toDataURL("image/jpeg", SAVED_GRAPH_THUMBNAIL_QUALITY));
}

function normalizeSavedGraphThumbnail(value) {
  const thumbnail = String(value ?? "");
  const state = savedGraphThumbnailState(thumbnail);
  return state === "compact" || state === "legacy" || state === "fallback" ? thumbnail : fallbackSavedGraphThumbnail();
}

function savedGraphThumbnailState(value) {
  const thumbnail = String(value ?? "");
  if (/^data:image\/(?:jpeg|webp);/i.test(thumbnail) && thumbnail.length <= SAVED_GRAPH_THUMBNAIL_MAX_CHARACTERS) return "compact";
  if (/^data:image\/png;/i.test(thumbnail) && thumbnail.length <= SAVED_GRAPH_LEGACY_THUMBNAIL_MAX_CHARACTERS) return "legacy";
  if (thumbnail === fallbackSavedGraphThumbnail()) return "fallback";
  return "invalid";
}

function bindSavedGraphThumbnailRecovery() {
  const previews = Array.from(root.querySelectorAll?.("[data-saved-thumbnail-id]") ?? []);
  if (!previews.length) return;
  const recover = (image) => {
    const id = image.dataset.savedThumbnailId;
    if (!id || recoveringSavedGraphThumbnails.has(id)) return;
    const graph = loadSavedGraphs().find((entry) => entry.id === id);
    if (!graph || savedGraphThumbnailState(graph.thumbnail) === "compact") return;
    recoverSavedGraphThumbnail(graph, image);
  };
  if (typeof IntersectionObserver !== "function") {
    previews.slice(0, 8).forEach(recover);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      recover(entry.target);
    }
  }, { root: root.querySelector?.(".saved-graph-list") ?? null, rootMargin: "80px" });
  previews.forEach((image) => observer.observe(image));
}

async function recoverSavedGraphThumbnail(graph, image) {
  recoveringSavedGraphThumbnails.add(graph.id);
  try {
    const state = savedGraphThumbnailState(graph.thumbnail);
    const thumbnail = state === "legacy"
      ? await compactSavedGraphThumbnail(graph.thumbnail)
      : renderSavedSceneThumbnail(graph.scene);
    if (savedGraphThumbnailState(thumbnail) !== "compact") return;
    persistRecoveredSavedGraphThumbnail(graph.id, thumbnail);
    if (image?.isConnected) image.src = thumbnail;
  } catch {
    // A failed preview must never make the saved graph itself unavailable.
  } finally {
    recoveringSavedGraphThumbnails.delete(graph.id);
  }
}

function compactSavedGraphThumbnail(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(createGraphThumbnailDataUrl(image));
    image.onerror = () => reject(new Error("Saved preview could not be decoded"));
    image.src = source;
  });
}

function renderSavedSceneThumbnail(source) {
  const previousScene = scene;
  const previousViewport = viewport;
  try {
    scene = importScene(source);
    viewport = sceneViewport();
    const canvas = document.createElement("canvas");
    const rendered = renderSceneWebGlInto(canvas, {
      cssWidth: SAVED_GRAPH_THUMBNAIL_WIDTH,
      cssHeight: SAVED_GRAPH_THUMBNAIL_HEIGHT,
      dpr: 1,
      visibleViewport: viewport,
      updateOverlay: false,
      synchronous: true,
      fallbackOnFailure: true
    });
    return rendered ? createGraphThumbnailDataUrl(canvas) : fallbackSavedGraphThumbnail();
  } finally {
    scene = previousScene;
    viewport = previousViewport;
  }
}

function persistRecoveredSavedGraphThumbnail(id, thumbnail) {
  const raw = JSON.parse(localStorage.getItem(SAVED_GRAPHS_KEY) ?? "[]");
  if (!Array.isArray(raw)) return;
  const graph = raw.find((entry) => String(entry?.id ?? "") === id);
  if (!graph) return;
  graph.thumbnail = thumbnail;
  localStorage.setItem(SAVED_GRAPHS_KEY, JSON.stringify(raw.slice(0, SAVED_GRAPHS_LIMIT)));
}

function fallbackSavedGraphThumbnail() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#111827"/><path d="M0 70 C30 20 52 88 78 45 S125 62 160 24" fill="none" stroke="#8ec5ff" stroke-width="5"/><path d="M0 86 C36 42 58 98 94 58 S128 76 160 48" fill="none" stroke="#f6b35e" stroke-width="3"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

window.__leptonDebug = {
  version: APP_VERSION,
  latexToExpression,
  renderEditableLatex,
  serializeMathField,
  exportCanvasSizeForViewport,
  exportViewportForImage,
  moveMixedDataEntry,
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
