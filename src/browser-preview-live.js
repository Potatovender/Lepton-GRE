const DEFAULT_SCENE = {
  functions: [
    { id: "eq", expression: "sin(x)+cos(y)" },
    { id: "r", expression: "128+127*sin(x)" },
    { id: "g", expression: "128+127*cos(x)" },
    { id: "b", expression: "180" },
    { id: "rest", expression: "1" }
  ],
  colors: [{ id: "rgb", red: "r", green: "g", blue: "b" }],
  restrictions: [{ id: "rest", expression: "rest", checkSmaller: false }],
  draws: [{ equationId: "eq", colorId: "rgb", restrictionId: "rest" }],
  settings: {
    xMin: -15,
    xMax: 15,
    xPoints: 120,
    yMin: -15,
    yMax: 15,
    yPoints: 120,
    maxRecursion: 100,
    angleMode: "radians"
  }
};

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

const RESERVED_FUNCTION_NAMES = new Set([...BUILTIN_NAMES].filter((name) => !["x", "y", "z", "pi", "e", "Math", "ref", "NaN"].includes(name)));
const SUBSTRING_REFERENCE_NAMES = new Set([...BUILTIN_NAMES].filter((name) => !["x", "y", "z", "e", "Math", "PI", "ref", "NaN"].includes(name) && name.length > 1));
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
const NODE_BLUE_FLAG_THRESHOLD = 2 ** 12;
const NODE_RED_FLAG_THRESHOLD = 2 ** 16;

let scene = structuredClone(DEFAULT_SCENE);
let displayMode = "standard";
let activeTab = "functions";
let sidebarWidth = Number(localStorage.getItem("lepton-sidebar-width") ?? "380");
let sidebarCollapsed = localStorage.getItem("lepton-sidebar-collapsed") === "true";
let viewport = loadViewport();
let panRenderFrame = 0;
const listControls = {
  functions: { query: "", sort: "custom" },
  colors: { query: "", sort: "custom" },
  restrictions: { query: "", sort: "custom" }
};
const editorHistory = new Map();

const root = document.querySelector("#app");
window.__leptonForceGradient = false;

function renderApp() {
  const diagnostics = validateScene();
  root.innerHTML = `
    <main class="app-shell ${sidebarCollapsed ? "app-shell-sidebar-collapsed" : ""}" style="--sidebar-width: ${sidebarWidth}px">
      <section class="expression-panel ${displayMode === "text" ? "expression-panel-text" : ""}" aria-label="Expression editor">
        <header class="panel-header">
          <div class="brand-row">
            <strong>Lepton GRE</strong>
            <button class="toolbar-button primary" data-action="render">Refresh</button>
          </div>
          <div class="display-row" aria-label="Display mode">
            <button class="display-button" data-display-mode="standard" aria-selected="${displayMode === "standard"}">Standard</button>
            <button class="display-button" data-display-mode="text" aria-selected="${displayMode === "text"}">Text</button>
          </div>
        </header>
        <nav class="tab-row" aria-label="Editor sections" ${displayMode === "text" ? "hidden" : ""}>
          ${tabs
            .map(([id, label]) => `<button class="tab-button" data-tab="${id}" aria-selected="${id === activeTab}">${label}</button>`)
            .join("")}
        </nav>
        <div class="entry-list ${displayMode === "text" ? "entry-list-text" : ""}">${renderPanel()}</div>
      </section>
      <div class="sidebar-resizer" role="separator" aria-label="Resize expression panel" tabindex="0"></div>
      <section class="renderer-pane" aria-label="Grid renderer">
        <button class="sidebar-toggle" data-action="toggle-sidebar" aria-label="${sidebarCollapsed ? "Show expression panel" : "Hide expression panel"}" aria-pressed="${sidebarCollapsed}">
          <span aria-hidden="true"></span>
        </button>
        <canvas class="grid-canvas"></canvas>
        <div class="render-overlay">${scene.settings.angleMode} · depth ${scene.settings.maxRecursion} · ${diagnostics.summary}</div>
      </section>
    </main>
  `;

  bindEvents();
  bindCanvasPan();
  renderScene(diagnostics);
}

function renderPanel() {
  const diagnostics = validateScene();

  if (displayMode === "text") {
    return `
      <div class="text-mode-panel">
        <textarea class="scene-textarea" data-scene-text spellcheck="false">${escapeHtml(exportScene())}</textarea>
        <div class="text-mode-actions">
          <button class="toolbar-button primary" data-action="apply-text">Apply</button>
          <button class="toolbar-button" data-action="refresh-text">Refresh text</button>
        </div>
      </div>
    `;
  }

  if (activeTab === "functions") {
    return [
      listControlBar("functions", "Search functions"),
      ...visibleEntries(scene.functions, "functions").map(
        ([entry, index]) => expressionRow(diagnostics.functions[index]?.status ?? "invalid", diagnostics.functions[index]?.message ?? "", `
          <input class="entry-id" data-field="functions.${index}.id" value="${escapeHtml(entry.id)}" aria-label="Function id" />
          ${mathEditor(`functions.${index}.expression`, entry.expression, "Function expression")}
        `, "functions", index)
      ),
      addRow("Add function", "functions")
    ].join("");
  }

  if (activeTab === "colors") {
    return [
      listControlBar("colors", "Search colors"),
      ...visibleEntries(scene.colors, "colors").map(
        ([entry, index]) => expressionRow(diagnostics.colors[index]?.status ?? "invalid", diagnostics.colors[index]?.message ?? "", `
          <input class="entry-id" data-field="colors.${index}.id" value="${escapeHtml(entry.id)}" aria-label="Color id" />
          <label class="channel-row"><span class="channel-label">r</span><select class="compact-field" data-field="colors.${index}.red">${options(scene.functions, entry.red)}</select></label>
          <label class="channel-row"><span class="channel-label">g</span><select class="compact-field" data-field="colors.${index}.green">${options(scene.functions, entry.green)}</select></label>
          <label class="channel-row"><span class="channel-label">b</span><select class="compact-field" data-field="colors.${index}.blue">${options(scene.functions, entry.blue)}</select></label>
        `, "colors", index)
      ),
      addRow("Add color", "colors")
    ].join("");
  }

  if (activeTab === "restrictions") {
    return [
      listControlBar("restrictions", "Search bounds"),
      ...visibleEntries(scene.restrictions, "restrictions").map(
        ([entry, index]) => expressionRow(diagnostics.restrictions[index]?.status ?? "invalid", diagnostics.restrictions[index]?.message ?? "", `
          <input class="entry-id" data-field="restrictions.${index}.id" value="${escapeHtml(entry.id)}" aria-label="Restriction id" />
          <label class="settings-row"><span>Function reference</span><select class="compact-field" data-field="restrictions.${index}.expression">${options(scene.functions, entry.expression)}</select></label>
          <label class="inline-check"><input type="checkbox" data-field="restrictions.${index}.checkSmaller" ${entry.checkSmaller ? "checked" : ""} /> <= 0</label>
        `, "restrictions", index)
      ),
      addRow("Add boundary", "restrictions")
    ].join("");
  }

  if (activeTab === "draws") {
    return [
      ...scene.draws.map(
        (entry, index) => expressionRow(diagnostics.draws[index]?.status ?? "invalid", diagnostics.draws[index]?.message ?? "", `
          <div class="draw-layer-toolbar">
            <button class="draw-drag-handle" data-draw-handle="${index}" draggable="true" title="Drag to reorder draw layer" aria-label="Drag to reorder draw layer">↕</button>
            <button class="draw-visibility" data-toggle-draw="${index}" aria-pressed="${entry.hidden ? "true" : "false"}">${entry.hidden ? "Show" : "Hide"}</button>
          </div>
          <select class="compact-field" data-field="draws.${index}.equationId">${options(scene.functions, entry.equationId)}</select>
          <select class="compact-field" data-field="draws.${index}.colorId">${options(scene.colors, entry.colorId)}</select>
          <select class="compact-field" data-field="draws.${index}.restrictionId">${options(scene.restrictions, entry.restrictionId)}</select>
        `, "draws", index, { rowClass: entry.hidden ? "expression-row-hidden" : "", attrs: `data-draw-index="${index}"` })
      ),
      addRow("Add draw layer", "draws")
    ].join("");
  }

  return `
    <div class="settings-grid">
      ${settingsField("xMin", "x minimum")}
      ${settingsField("xMax", "x maximum")}
      ${settingsField("yMin", "y minimum")}
      ${settingsField("yMax", "y maximum")}
      ${settingsField("maxRecursion", "max recursion")}
      <label class="settings-row">
        <span>Angle mode</span>
        <select class="compact-field" data-field="settings.angleMode">
          <option value="radians" ${scene.settings.angleMode === "radians" ? "selected" : ""}>radians</option>
          <option value="degrees" ${scene.settings.angleMode === "degrees" ? "selected" : ""}>degrees</option>
        </select>
      </label>
    </div>
  `;
}

function listControlBar(kind, placeholder) {
  const state = listControls[kind];
  return `
    <div class="list-controls" data-list-controls="${kind}">
      <input class="list-search compact-field" data-entry-search="${kind}" value="${escapeHtml(state.query)}" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(placeholder)} by ID" />
      <select class="list-sort compact-field" data-entry-sort="${kind}" aria-label="Sort ${escapeHtml(kind)} by ID">
        <option value="custom" ${state.sort === "custom" ? "selected" : ""}>Custom</option>
        <option value="az" ${state.sort === "az" ? "selected" : ""}>ID A-Z</option>
        <option value="za" ${state.sort === "za" ? "selected" : ""}>ID Z-A</option>
      </select>
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

function mathEditor(field, value, label, small = false) {
  const source = normalizeExpressionDisplayText(value);
  const latex = latexSourceFromExpression(source);
  return `
    <div class="mathquill-editor ${small ? "mathquill-editor-small" : ""}">
      <span class="mathquill-field ${small ? "mathquill-field-small" : ""}" data-field="${field}" data-value="${escapeHtml(latex)}" aria-label="${escapeHtml(label)}"></span>
    </div>
  `;
}

function expressionRow(status, message, content, kind = null, index = null, options = {}) {
  return `
    <div class="expression-row ${options.rowClass ?? ""}" title="${escapeHtml(message)}" ${options.attrs ?? ""}>
      <span class="entry-status ${status}" aria-label="${escapeHtml(message || status)}"></span>
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

function settingsField(key, label) {
  return `
    <label class="settings-row">
      <span>${label}</span>
      <input class="compact-field" type="number" data-field="settings.${key}" value="${scene.settings[key]}" />
    </label>
  `;
}

function options(entries, selected) {
  const hasSelected = entries.some((entry) => entry.id === selected);
  return [
    ...(hasSelected || !selected ? [] : [`<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (missing)</option>`]),
    ...entries.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === selected ? "selected" : ""}>${escapeHtml(entry.id)}</option>`)
  ].join("");
}

function bindEvents() {
  bindSidebarResize();

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

  root.querySelectorAll("[data-entry-sort]").forEach((field) => {
    field.addEventListener("change", () => {
      listControls[field.dataset.entrySort].sort = field.value;
      renderApp();
    });
  });

  root.querySelector('[data-action="render"]')?.addEventListener("click", () => {
    syncFields();
    renderApp();
  });
  root.querySelector('[data-action="toggle-sidebar"]')?.addEventListener("click", () => {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem("lepton-sidebar-collapsed", String(sidebarCollapsed));
    renderApp();
  });
  root.querySelector('[data-action="apply-text"]')?.addEventListener("click", () => {
    const text = root.querySelector("[data-scene-text]")?.value ?? "";
    scene = importScene(text);
    viewport = sceneViewport();
    saveViewport();
    renderApp();
  });
  root.querySelector('[data-action="refresh-text"]')?.addEventListener("click", () => {
    const field = root.querySelector("[data-scene-text]");
    if (field) field.value = exportScene();
  });
  root.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
    scene = structuredClone(DEFAULT_SCENE);
    viewport = loadViewport(true);
    renderApp();
  });
  root.querySelector('[data-action="export"]')?.addEventListener("click", () => {
    window.prompt("Copy exported scene", exportScene());
  });
  root.querySelector('[data-action="import"]')?.addEventListener("click", () => {
    const raw = window.prompt("Paste exported scene");
    if (raw) {
      scene = importScene(raw);
      renderApp();
    }
  });

  const MQ = window.MathQuill.getInterface(3);
  root.querySelectorAll(".mathquill-field[data-field]").forEach((el) => {
    const fieldName = el.dataset.field;
    const initialValue = el.dataset.value ?? "";

    const mathField = MQ.MathField(el, {
      autoCommands: "pi theta sqrt sum",
      autoOperatorNames: "sin cos tan ln log exp min max clamp round floor ceil abs sign sinh cosh tanh arcsin arccos arctan sec csc cot arccot arcsec arccsc sech csch coth arcsinh arccosh arctanh arcsech arccsch arccoth cbrt asin acos atan",
      handlers: {
        edit: () => {
          const latex = mathField.latex();
          el.dataset.value = latex;

          const cleanExpr = latexToLeptonText(latex);

          const [collection, rawIndex, property] = fieldName.split(".");
          const index = Number(rawIndex);
          if (collection === "functions" && property === "expression") {
            const assignment = parseAssignment(cleanExpr);
            if (assignment) {
              scene.functions[index].id = assignment.id;
              scene.functions[index].expression = assignment.expression;
              const idInput = root.querySelector(`[data-field="functions.${index}.id"]`);
              if (idInput) idInput.value = assignment.id;
            } else {
              scene.functions[index].expression = cleanExpr;
            }
          } else {
            scene[collection][index][property] = cleanExpr;
          }

          const diagnostics = validateScene();
          updateStatusLights(diagnostics);
          renderScene(diagnostics);
        }
      }
    });

    mathField.latex(initialValue);
  });

  root.querySelectorAll(".mathquill-field").forEach((field) => {
    field.addEventListener(
      "wheel",
      (event) => {
        if (field.scrollWidth <= field.clientWidth) return;
        const horizontal = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        if (!horizontal) return;
        field.scrollLeft += horizontal;
        event.preventDefault();
      },
      { passive: false }
    );
  });

  root.querySelectorAll("input.entry-id[data-field]").forEach((field) => {
    field.addEventListener("input", () => {
      updateField(field);
      const diagnostics = validateScene();
      updateStatusLights(diagnostics);
      renderScene(diagnostics);
    });
  });

  root.querySelectorAll("[data-field]").forEach((field) => {
    field.addEventListener("change", () => {
      updateField(field);
      renderApp();
    });
  });

  root.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      addEntry(button.dataset.add);
      renderApp();
    });
  });

  root.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      deleteEntry(button.dataset.delete, Number(button.dataset.index));
      renderApp();
    });
  });

  root.querySelectorAll("[data-toggle-draw]").forEach((button) => {
    button.addEventListener("click", () => {
      syncFields();
      toggleDrawHidden(Number(button.dataset.toggleDraw));
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
      moveDrawLayer(from, to);
      renderApp();
    });
  });
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
    moveDrawLayer(from, to);
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

function updateField(field) {
  const [collection, rawIndex, property] = field.dataset.field.split(".");
  let value = readFieldValue(field);
  if (property === "id") value = value.trim();

  if (collection === "settings") {
    scene.settings[rawIndex] = rawIndex === "angleMode" ? value : Number(value);
    if (["xMin", "xMax", "yMin", "yMax"].includes(rawIndex)) {
      viewport = sceneViewport();
      saveViewport();
    }
    return;
  }

  if (collection === "functions" && property === "expression") {
    const assignment = parseAssignment(value);
    if (assignment) {
      scene.functions[Number(rawIndex)].id = assignment.id;
      scene.functions[Number(rawIndex)].expression = assignment.expression;
      return;
    }
  }

  scene[collection][Number(rawIndex)][property] = value;
  if (field.classList?.contains("mathquill-field")) {
    field.dataset.value = latexSourceFromExpression(value);
  }
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

function addEntry(kind) {
  if (kind === "functions") scene.functions.push({ id: `f${scene.functions.length + 1}`, expression: "x+y" });
  if (kind === "colors") scene.colors.push({ id: `c${scene.colors.length + 1}`, red: scene.functions[0]?.id ?? "", green: scene.functions[0]?.id ?? "", blue: scene.functions[0]?.id ?? "" });
  if (kind === "restrictions") scene.restrictions.push({ id: `r${scene.restrictions.length + 1}`, expression: scene.functions[0]?.id ?? "", checkSmaller: false });
  if (kind === "draws") {
    scene.draws.push({
      equationId: scene.functions[0]?.id ?? "",
      colorId: scene.colors[0]?.id ?? "",
      restrictionId: scene.restrictions[0]?.id ?? "",
      hidden: false
    });
  }
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
  drawGrid(ctx, rect.width, rect.height);

  const env = buildRuntimeEnv(Object.fromEntries(scene.functions.map((entry) => [entry.id, entry.expression])));
  const visibleViewport = displayViewportForSize(viewport, rect.width, rect.height);
  const xPoints = axis(visibleViewport.xMin, visibleViewport.xMax, scene.settings.xPoints);
  const yPoints = axis(visibleViewport.yMin, visibleViewport.yMax, scene.settings.yPoints);
  const pixelWidth = rect.width / Math.max(1, xPoints.length - 1);
  const pixelHeight = rect.height / Math.max(1, yPoints.length - 1);

  for (const draw of scene.draws) {
    if (draw.hidden) continue;
    const fn = scene.functions.find((entry) => entry.id === draw.equationId);
    const color = scene.colors.find((entry) => entry.id === draw.colorId);
    const restriction = scene.restrictions.find((entry) => entry.id === draw.restrictionId);
    if (!fn || !color || !restriction) continue;

    let evaluate;
    let red;
    let green;
    let blue;
    let boundary;
    try {
      evaluate = compileExpression(fn.expression);
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
        const boundaryValue = boundary(x, y, env);
        if (!Number.isFinite(boundaryValue)) continue;
        if (restriction.checkSmaller ? boundaryValue > 0 : boundaryValue < 0) continue;

        const z = evaluate(x, y, env);
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
  gl.clearColor(0.97, 0.98, 0.99, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  return true;
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

  const env = Object.fromEntries(scene.functions.map((entry) => [entry.id, entry.expression]));
  const layers = scene.draws
    .map((draw) => {
      if (draw?.hidden) return null;
      const fn = scene.functions.find((entry) => entry.id === draw?.equationId);
      const color = scene.colors.find((entry) => entry.id === draw?.colorId);
      const restriction = scene.restrictions.find((entry) => entry.id === draw?.restrictionId);
      if (!fn || !color || !restriction) return null;
      if (
        validateExpression(fn.expression, env, [fn.id]).status === "invalid" ||
        validateExpression(color.red, env).status === "invalid" ||
        validateExpression(color.green, env).status === "invalid" ||
        validateExpression(color.blue, env).status === "invalid" ||
        validateExpression(restriction.expression, env).status === "invalid"
      ) {
        return null;
      }
      try {
        return {
          expr: expressionToGlsl(fn.expression, env, null, [], scene.settings.angleMode),
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

  return `
      precision highp float;
      uniform vec2 u_resolution;
      uniform vec4 u_bounds;

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
      vec3 color = vec3(0.97, 0.98, 0.99);
      bool painted = false;
      ${layerShader}
      gl_FragColor = vec4(color, 1.0);
    }
  `;
}

function drawGrid(ctx, width, height) {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);
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

function compileExpression(source) {
  let js = normalizeMathSyntax(normalizeExpressionText(source));
  js = convertPowers(js)
    .replaceAll(/~([A-Za-z]\w*)~/g, 'ref("$1", x, y)')
    .replaceAll(/\bpi\b/g, "Math.PI")
    .replaceAll(/\be\b/g, "Math.E")
    .replaceAll(/\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|abs|sign|floor|ceil|round|min|max|exp|log|pow)\b/g, "Math.$1")
    .replaceAll(/\barc(sin|cos|tan)\b/g, "Math.a$1");

  js = rewriteBareIdentifiers(js, (name) => `ref("${name}", x, y)`, new Set(["Math", "E", "PI"]));

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
      return ${js};
    `
  );
}

function buildRuntimeEnv(expressions) {
  const runtimeEnv = {};
  for (const [id, expression] of Object.entries(expressions)) {
    runtimeEnv[id] = (x, y, env) => compileExpression(expression)(x, y, env);
  }
  return attachRuntimeGuard(runtimeEnv);
}

function expressionToGlsl(source, env = {}, zName = null, stack = [], angleMode = "radians") {
  if (stack.length > recursionLimit()) {
    return recursionBaseGlsl(zName);
  }
  let expression = normalizeExpressionText(source);
  expression = inlineCustomVariables(expression, env, stack, zName, angleMode);
  expression = inlineBareVariables(expression, env, stack, zName, angleMode);
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

function inlineCustomVariables(expression, env, stack, zName, angleMode = "radians") {
  return expression.replaceAll(/~([A-Za-z]\w*)~/g, (_, name) => {
    if (!env[name]) {
      throw new Error(`Unknown reference ~${name}~`);
    }
    if (stack.length >= recursionLimit()) {
      return `(${recursionBaseGlsl(zName)})`;
    }
    return `(${expressionToGlsl(env[name], env, zName, [...stack, name], angleMode)})`;
  });
}

function inlineBareVariables(expression, env, stack, zName, angleMode = "radians") {
  return rewriteBareIdentifiers(
    expression,
    (name) => {
      if (!env[name]) {
        throw new Error(`Unknown variable: ${name}`);
      }
      if (stack.length >= recursionLimit()) {
        return `(${recursionBaseGlsl(zName)})`;
      }
      return `(${expressionToGlsl(env[name], env, zName, [...stack, name], angleMode)})`;
    },
    new Set()
  );
}

function rewriteBareIdentifiers(expression, replace, extraReserved) {
  const stringRanges = [];
  expression.replaceAll(/"[^"]*"/g, (match, offset) => {
    stringRanges.push([offset, offset + match.length]);
    return match;
  });

  return expression.replaceAll(/\b[A-Za-z_]\w*\b/g, (name, offset) => {
    if (stringRanges.some(([start, end]) => offset >= start && offset < end)) return name;
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
  const env = Object.fromEntries(scene.functions.filter((entry) => entry.id.trim()).map((entry) => [entry.id, entry.expression]));
  const diagnostics = {
    functions: [],
    colors: [],
    restrictions: [],
    draws: [],
    hasErrors: false,
    summary: "GLSL ready"
  };

  diagnostics.functions = scene.functions.map((entry) => {
    const idResult = validateEntryId(entry.id, "Function", env);
    if (idResult.status === "invalid") return idResult;
    const result = validateExpression(entry.expression, env, [entry.id]);
    if (result.status === "valid" && idResult.status === "warning") {
      return idResult;
    }
    if (result.status === "valid" && RESERVED_FUNCTION_NAMES.has(entry.id)) {
      return { status: "warning", message: `"${entry.id}" shadows a built-in function name` };
    }
    return result;
  });
  diagnostics.colors = scene.colors.map((entry) => {
    const idResult = validateEntryId(entry.id, "Color", env);
    if (idResult.status === "invalid") return idResult;
    return combineDiagnostics([
      idResult,
      validateExpression(entry.red, env),
      validateExpression(entry.green, env),
      validateExpression(entry.blue, env)
    ]);
  });
  diagnostics.restrictions = scene.restrictions.map((entry) => {
    const idResult = validateEntryId(entry.id, "Boundary", env);
    if (idResult.status === "invalid") return idResult;
    return combineDiagnostics([idResult, validateExpression(entry.expression, env)]);
  });
  diagnostics.draws = scene.draws.map((entry) => {
    if (entry.hidden) {
      return { status: "valid", message: "Draw layer hidden" };
    }
    const missing = [];
    const functionIndex = scene.functions.findIndex((candidate) => candidate.id === entry.equationId);
    const colorIndex = scene.colors.findIndex((candidate) => candidate.id === entry.colorId);
    const restrictionIndex = scene.restrictions.findIndex((candidate) => candidate.id === entry.restrictionId);
    if (functionIndex === -1) missing.push("function");
    if (colorIndex === -1) missing.push("color");
    if (restrictionIndex === -1) missing.push("boundary");
    if (missing.length) return { status: "invalid", message: `Missing ${missing.join(", ")}` };
    const affected = [
      diagnostics.functions[functionIndex],
      diagnostics.colors[colorIndex],
      diagnostics.restrictions[restrictionIndex]
    ].find((item) => item?.status === "invalid");
    return affected
      ? { status: "invalid", message: `Draw layer skipped: ${affected.message}` }
      : { status: "valid", message: "Draw layer is valid" };
  });

  const all = [...diagnostics.functions, ...diagnostics.colors, ...diagnostics.restrictions, ...diagnostics.draws];
  const firstError = all.find((item) => item.status === "invalid");
  const firstInfo = all.find((item) => item.status === "info");
  const firstWarning = all.find((item) => item.status === "warning");
  diagnostics.hasErrors = Boolean(firstError);
  diagnostics.summary = firstError ? firstError.message : firstInfo ? firstInfo.message : firstWarning ? firstWarning.message : "GLSL ready";
  return diagnostics;
}

function validateEntryId(id, label, env = {}) {
  if (!id.trim()) {
    return { status: "invalid", message: `${label} name cannot be blank` };
  }
  if (!/^[A-Za-z_]\w*$/.test(id)) {
    return { status: "invalid", message: `${label} name must start with a letter or underscore` };
  }
  const warning = findSubstringReferenceWarning(id, env);
  if (warning) {
    return { status: "warning", message: `${label} name "${id}" contains ${warning}` };
  }
  return { status: "valid", message: `${label} name is valid` };
}

function validateExpression(source, env, stack = []) {
  try {
    const normalized = normalizeExpressionText(source);
    assertCompleteExpression(normalized);
    if (/\b[A-Za-z]\w*\(\s*\)/.test(normalized)) {
      throw new Error("Empty function argument");
    }
    const nodeCount = estimateExpandedNodeCount(source, env, stack);
    if (nodeCount > NODE_RED_FLAG_THRESHOLD) {
      throw new Error(`Equation is too large (${formatNodeCount(nodeCount)} nodes); refusing to generate`);
    }
    if (nodeCount > NODE_BLUE_FLAG_THRESHOLD) {
      return { status: "info", message: `Equation is large (${formatNodeCount(nodeCount)} nodes); rendering may be slower` };
    }
    expressionToGlsl(source, env, null, stack);
    const runtimeEnv = buildRuntimeEnv(env);
    compileExpression(source)(1, 1, runtimeEnv);
    const warning = findSubstringReferenceWarning(normalized, env);
    if (warning) {
      return { status: "warning", message: `Expression contains ${warning}` };
    }
    return { status: "valid", message: "Expression is valid" };
  } catch (error) {
    return { status: "invalid", message: error.message };
  }
}

function findSubstringReferenceWarning(source, env = {}) {
  const candidates = new Set(SUBSTRING_REFERENCE_NAMES);
  for (const name of Object.keys(env)) {
    if (name.length > 1 && name !== "e") {
      candidates.add(name);
    }
  }

  const matches = new Set();
  const identifiers = String(source).match(/\b[A-Za-z_]\w*\b/g) ?? [];
  for (const identifier of identifiers) {
    if (BUILTIN_NAMES.has(identifier)) continue;
    const lowerIdentifier = identifier.toLowerCase();
    for (const candidate of candidates) {
      const lowerCandidate = candidate.toLowerCase();
      if (lowerIdentifier === lowerCandidate) continue;
      if (lowerIdentifier.includes(lowerCandidate)) {
        matches.add(candidate);
      }
    }
  }

  if (!matches.size) return "";
  const names = [...matches].sort((left, right) => left.localeCompare(right));
  return `reserved substring${names.length === 1 ? "" : "s"} ${names.map((name) => `"${name}"`).join(", ")}`;
}

function estimateExpandedNodeCount(source, env = {}, stack = [], memo = new Map()) {
  const normalized = normalizeExpressionText(source).replaceAll(/~([A-Za-z]\w*)~/g, "$1");
  let total = countLocalExpressionNodes(normalized);
  const identifiers = normalized.matchAll(/\b[A-Za-z_]\w*\b/g);
  for (const match of identifiers) {
    const name = match[0];
    if (BUILTIN_NAMES.has(name) || !env[name]) continue;
    if (stack.length >= recursionLimit()) {
      total = cappedNodeAdd(total, 2);
      continue;
    }
    const memoKey = `${name}:${stack.length}`;
    if (memo.has(memoKey)) {
      total = cappedNodeAdd(total, Math.max(0, memo.get(memoKey) - 1));
      continue;
    }
    const value = estimateExpandedNodeCount(env[name], env, [...stack, name], memo);
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
  return items.find((item) => item.status === "invalid") ??
    items.find((item) => item.status === "info") ??
    items.find((item) => item.status === "warning") ??
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
  field.dispatchEvent(new InputEvent("input", { bubbles: true }));
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
  if (/^(?:sqrt|cbrt|abs|floor|ceil|sin|cos|tan|asin|acos|atan|arcsin|arccos|arctan|log|ln|exp|sec|csc|cot)\([^()]*\)$/.test(value)) return true;
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
  return /\\(?:operatorname|frac|sqrt|left\||lvert|lfloor|lceil|abs|floor|ceil|sin|cos|tan|asin|acos|atan|arcsin|arccos|arctan|log|ln|min|max|exp|sec|csc|cot|round|clamp)\b/.test(source);
}

function hasInternalRenderableCall(source) {
  return /\b(?:frac|sqrt|abs|floor|ceil|sin|cos|tan|asin|acos|atan|arcsin|arccos|arctan|log|ln|min|max|exp|sec|csc|cot|round|clamp)\(/.test(source);
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
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
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
  sinh: "\\sinh",
  cosh: "\\cosh",
  tanh: "\\tanh",
  log: "\\log",
  ln: "\\ln",
  exp: "\\exp",
  sec: "\\sec",
  csc: "\\csc",
  cot: "\\cot",
  min: "\\min",
  max: "\\max"
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

function exportScene() {
  return [
    ...scene.functions.map((entry) => `F:${entry.id}~${textModeExpression(entry.expression)}`),
    "~~~~~",
    ...scene.colors.map((entry) => `C:${entry.id}~${textModeExpression(entry.red)}~${textModeExpression(entry.green)}~${textModeExpression(entry.blue)}`),
    "~~~~~",
    ...scene.restrictions.map((entry) => `R:${entry.id}~${textModeExpression(entry.expression)}~${entry.checkSmaller ? 1 : 0}`),
    "~~~~~",
    ...scene.draws.map((entry) => `D~${entry.equationId}~${entry.colorId}~${entry.restrictionId}~${entry.hidden ? 1 : 0}`),
    "~~~~~",
    `S:x_min~${scene.settings.xMin}`,
    `S:x_max~${scene.settings.xMax}`,
    `S:y_min~${scene.settings.yMin}`,
    `S:y_max~${scene.settings.yMax}`,
    `S:max_recursion~${scene.settings.maxRecursion}`,
    `S:angle_mode~${scene.settings.angleMode}`
  ].join("\n");
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
  const normalized = normalizeExpressionDisplayText(source);
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
      next.functions.push({ id, expression: convertDivisionsToFrac(expression) });
    } else if (line.startsWith("C:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [red = "0", green = "0", blue = "0"] = rest.split("~");
      next.colors.push({ id, red, green, blue });
    } else if (line.startsWith("R:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [expression = "1", flag = "0"] = rest.split("~");
      next.restrictions.push({ id, expression: convertDivisionsToFrac(expression), checkSmaller: flag === "1" });
    } else if (line.startsWith("D~")) {
      const [, equationId, colorId, restrictionId, hidden = "0"] = line.split("~");
      next.draws.push({ equationId, colorId, restrictionId, hidden: hidden === "1" });
    } else if (line.startsWith("S:")) {
      const [key, value] = splitFirst(line.slice(2), "~");
      const settingMap = { x_min: "xMin", x_max: "xMax", y_min: "yMin", y_max: "yMax", max_recursion: "maxRecursion", angle_mode: "angleMode" };
      const mapped = settingMap[key];
      if (mapped) next.settings[mapped] = mapped === "angleMode" ? value : Number(value);
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
    next.functions.push({ id, expression: trimmed || "0" });
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
  const stripped = stripChannelPrefix(value);
  const assignment = parseAssignment(stripped);
  return assignment ? assignment.expression : stripped;
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
  return {
    xMin: scene.settings.xMin,
    xMax: scene.settings.xMax,
    yMin: scene.settings.yMin,
    yMax: scene.settings.yMax
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

function unescapeHtml(value) {
  return String(value)
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

window.__leptonDebug = {
  latexToExpression,
  renderEditableLatex,
  serializeMathField
};

window.addEventListener("resize", () => {
  reflowMathLayout(root);
  requestAnimationFrame(() => reflowMathLayout(root));
  renderScene();
});

if (typeof URLSearchParams !== "undefined" && window.location && new URLSearchParams(window.location.search).get("capture") === "1") {
  document.body.classList.add("capture-mode");
}

loadSceneFromUrl();
renderApp();

function loadSceneFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const encodedScene = params.get("scene");
    if (!encodedScene) return;
    scene = importScene(encodedScene);
    viewport = sceneViewport();
    saveViewport();
  } catch (error) {
    window.__leptonRuntimeError = `Scene preload failed: ${error.message}`;
  }
}
