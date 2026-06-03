const DEFAULT_SCENE = {
  functions: [{ id: "eq", expression: "sin(x)+cos(y)" }],
  colors: [{ id: "rgb", red: "128+127*sin(x)", green: "128+127*cos(x)", blue: "180" }],
  restrictions: [{ id: "rest", expression: "1", checkSmaller: false }],
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
  "sqrt",
  "log",
  "ln",
  "abs",
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
  sqrt: { internal: "sqrt", args: 1, display: "sqrt" },
  log: { internal: "log", args: 1, display: "log" },
  ln: { internal: "ln", args: 1, display: "ln" },
  abs: { internal: "abs", args: 1, display: "abs" },
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

let scene = structuredClone(DEFAULT_SCENE);
let activeTab = "functions";
let sidebarWidth = Number(localStorage.getItem("lepton-sidebar-width") ?? "380");
let viewport = loadViewport();
let panRenderFrame = 0;

const root = document.querySelector("#app");
window.__leptonForceGradient = false;

function renderApp() {
  const diagnostics = validateScene();
  root.innerHTML = `
    <main class="app-shell" style="--sidebar-width: ${sidebarWidth}px">
      <section class="expression-panel" aria-label="Expression editor">
        <header class="panel-header">
          <div class="brand-row">
            <strong>Lepton-GRE</strong>
            <button class="toolbar-button primary" data-action="render">Render</button>
          </div>
        </header>
        <nav class="tab-row" aria-label="Editor sections">
          ${tabs
            .map(([id, label]) => `<button class="tab-button" data-tab="${id}" aria-selected="${id === activeTab}">${label}</button>`)
            .join("")}
        </nav>
        <div class="entry-list">${renderPanel()}</div>
        <footer class="panel-footer">
          <button class="toolbar-button" data-action="import">Import</button>
          <button class="toolbar-button" data-action="export">Export</button>
          <button class="toolbar-button" data-action="reset">Reset</button>
        </footer>
      </section>
      <div class="sidebar-resizer" role="separator" aria-label="Resize expression panel" tabindex="0"></div>
      <section class="renderer-pane" aria-label="Grid renderer">
        <canvas class="grid-canvas"></canvas>
        <div class="render-overlay">${scene.settings.xPoints} x ${scene.settings.yPoints} · ${scene.settings.angleMode} · depth ${scene.settings.maxRecursion} · ${diagnostics.summary}</div>
      </section>
    </main>
  `;

  bindEvents();
  bindCanvasPan();
  renderScene(diagnostics);
}

function renderPanel() {
  const diagnostics = validateScene();

  if (activeTab === "functions") {
    return [
      ...scene.functions.map(
        (entry, index) => expressionRow(diagnostics.functions[index]?.status ?? "invalid", diagnostics.functions[index]?.message ?? "", `
          <input class="entry-id" data-field="functions.${index}.id" value="${escapeHtml(entry.id)}" aria-label="Function id" />
          ${mathEditor(`functions.${index}.expression`, entry.expression, "Function expression")}
        `)
      ),
      addRow("Add function", "functions")
    ].join("");
  }

  if (activeTab === "colors") {
    return [
      ...scene.colors.map(
        (entry, index) => expressionRow(diagnostics.colors[index]?.status ?? "invalid", diagnostics.colors[index]?.message ?? "", `
          <input class="entry-id" data-field="colors.${index}.id" value="${escapeHtml(entry.id)}" aria-label="Color id" />
          <label class="channel-row"><span class="channel-label">r =</span>${mathEditor(`colors.${index}.red`, entry.red, "Red expression", true)}</label>
          <label class="channel-row"><span class="channel-label">g =</span>${mathEditor(`colors.${index}.green`, entry.green, "Green expression", true)}</label>
          <label class="channel-row"><span class="channel-label">b =</span>${mathEditor(`colors.${index}.blue`, entry.blue, "Blue expression", true)}</label>
        `)
      ),
      addRow("Add color", "colors")
    ].join("");
  }

  if (activeTab === "restrictions") {
    return [
      ...scene.restrictions.map(
        (entry, index) => expressionRow(diagnostics.restrictions[index]?.status ?? "invalid", diagnostics.restrictions[index]?.message ?? "", `
          <input class="entry-id" data-field="restrictions.${index}.id" value="${escapeHtml(entry.id)}" aria-label="Restriction id" />
          ${mathEditor(`restrictions.${index}.expression`, entry.expression, "Restriction expression")}
          <label class="inline-check"><input type="checkbox" data-field="restrictions.${index}.checkSmaller" ${entry.checkSmaller ? "checked" : ""} /> <= 0</label>
        `)
      ),
      addRow("Add boundary", "restrictions")
    ].join("");
  }

  if (activeTab === "draws") {
    return [
      ...scene.draws.map(
        (entry, index) => expressionRow(diagnostics.draws[index]?.status ?? "invalid", diagnostics.draws[index]?.message ?? "", `
          <select class="compact-field" data-field="draws.${index}.equationId">${options(scene.functions, entry.equationId)}</select>
          <select class="compact-field" data-field="draws.${index}.colorId">${options(scene.colors, entry.colorId)}</select>
          <select class="compact-field" data-field="draws.${index}.restrictionId">${options(scene.restrictions, entry.restrictionId)}</select>
        `)
      ),
      addRow("Add draw layer", "draws")
    ].join("");
  }

  return `
    <div class="settings-grid">
      ${settingsField("xMin", "x minimum")}
      ${settingsField("xMax", "x maximum")}
      ${settingsField("xPoints", "x points")}
      ${settingsField("yMin", "y minimum")}
      ${settingsField("yMax", "y maximum")}
      ${settingsField("yPoints", "y points")}
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

function mathEditor(field, value, label, small = false) {
  const latex = latexSourceFromExpression(value);
  return `
    <div class="mathquill-editor ${small ? "mathquill-editor-small" : ""}">
      <div class="latex-preview latex-render ${small ? "latex-editor-small" : ""}" aria-hidden="true">${renderLatexExpression(latex)}</div>
      <textarea class="latex-input" data-field="${field}" data-source="${escapeHtml(latex)}" aria-label="${escapeHtml(label)}" spellcheck="false">${escapeHtml(latex)}</textarea>
    </div>
    <textarea class="math-box math-source" data-source-field="${field}" tabindex="-1" aria-hidden="true">${escapeHtml(latex)}</textarea>
  `;
}

function expressionRow(status, message, content) {
  return `
    <div class="expression-row" title="${escapeHtml(message)}">
      <span class="entry-status ${status}" aria-label="${escapeHtml(message || status)}"></span>
      <div class="entry-content">${content}</div>
      <button class="row-action" title="More options" aria-label="More options">⋯</button>
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
  return entries.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === selected ? "selected" : ""}>${escapeHtml(entry.id)}</option>`).join("");
}

function bindEvents() {
  bindSidebarResize();

  root.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      renderApp();
    });
  });

  root.querySelector('[data-action="render"]')?.addEventListener("click", () => {
    syncFields();
    renderApp();
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

  root.querySelectorAll(".latex-input[data-field]").forEach((field) => {
    field.addEventListener("focus", () => {
      field.dataset.editing = "true";
      renderMathEditor(field);
    });
    field.addEventListener("beforeinput", (event) => {
      handleLatexBeforeInput(field, event);
    });
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        field.blur();
      }
    });
    field.addEventListener("input", () => {
      expandLatexShortcut(field);
      updateMathSource(field);
      updateField(field);
      renderMathEditor(field);
      const diagnostics = validateScene();
      updateStatusLights(diagnostics);
      renderScene(diagnostics);
    });
    field.addEventListener("blur", () => {
      field.dataset.editing = "false";
      renderMathEditor(field);
    });
    field.addEventListener("copy", (event) => {
      event.preventDefault();
      event.clipboardData?.setData("text/plain", field.value);
    });
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
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const unitsX = (drag.start.xMax - drag.start.xMin) * (dx / Math.max(1, rect.width));
    const unitsY = (drag.start.yMax - drag.start.yMin) * (dy / Math.max(1, rect.height));
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
      const xRatio = (event.clientX - rect.left) / Math.max(1, rect.width);
      const yRatio = 1 - (event.clientY - rect.top) / Math.max(1, rect.height);
      const width = viewport.xMax - viewport.xMin;
      const height = viewport.yMax - viewport.yMin;
      const centerX = viewport.xMin + width * xRatio;
      const centerY = viewport.yMin + height * yRatio;
      const zoom = Math.max(0.2, Math.min(5, Math.exp(event.deltaY * 0.001)));
      viewport = {
        xMin: centerX - (centerX - viewport.xMin) * zoom,
        xMax: centerX + (viewport.xMax - centerX) * zoom,
        yMin: centerY - (centerY - viewport.yMin) * zoom,
        yMax: centerY + (viewport.yMax - centerY) * zoom
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
  if (field.classList?.contains("latex-input")) {
    field.dataset.source = value;
  }
}

function readFieldValue(field) {
  if (field.type === "checkbox") return field.checked;
  if (field.classList?.contains("latex-input")) {
    return sourceFromLatexText(field.value);
  }
  return stripChannelPrefix(field.value);
}

function syncFields() {
  root.querySelectorAll("[data-field]").forEach((field) => updateField(field));
}

function addEntry(kind) {
  if (kind === "functions") scene.functions.push({ id: `f${scene.functions.length + 1}`, expression: "x+y" });
  if (kind === "colors") scene.colors.push({ id: `c${scene.colors.length + 1}`, red: "255", green: "255", blue: "255" });
  if (kind === "restrictions") scene.restrictions.push({ id: `r${scene.restrictions.length + 1}`, expression: "1", checkSmaller: false });
  if (kind === "draws") {
    scene.draws.push({
      equationId: scene.functions[0]?.id ?? "",
      colorId: scene.colors[0]?.id ?? "",
      restrictionId: scene.restrictions[0]?.id ?? ""
    });
  }
}

function renderScene(diagnostics = validateScene()) {
  try {
    window.__leptonRenderHit = (window.__leptonRenderHit ?? 0) + 1;
    const canvas = root.querySelector(".grid-canvas");
    if (!canvas) return;

    if (diagnostics.hasErrors) {
      drawErrorState(canvas, diagnostics.summary);
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
  drawGrid(ctx, rect.width, rect.height);

  const env = Object.fromEntries(scene.functions.map((entry) => [entry.id, compileExpression(entry.expression)]));
  attachRuntimeGuard(env);
  const xPoints = axis(viewport.xMin, viewport.xMax, scene.settings.xPoints);
  const yPoints = axis(viewport.yMin, viewport.yMax, scene.settings.yPoints);
  const pixelWidth = rect.width / Math.max(1, xPoints.length - 1);
  const pixelHeight = rect.height / Math.max(1, yPoints.length - 1);

  for (const draw of scene.draws) {
    const fn = scene.functions.find((entry) => entry.id === draw.equationId);
    const color = scene.colors.find((entry) => entry.id === draw.colorId);
    const restriction = scene.restrictions.find((entry) => entry.id === draw.restrictionId);
    if (!fn || !color || !restriction) continue;

    const evaluate = compileExpression(fn.expression);
    const red = compileExpression(color.red);
    const green = compileExpression(color.green);
    const blue = compileExpression(color.blue);
    const boundary = compileExpression(restriction.expression);

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
    viewport.xMin,
    viewport.xMax,
    viewport.yMin,
    viewport.yMax
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

  const draw = scene.draws[0];
  const fn = scene.functions.find((entry) => entry.id === draw?.equationId) ?? scene.functions[0];
  const color = scene.colors.find((entry) => entry.id === draw?.colorId) ?? scene.colors[0];
  const restriction = scene.restrictions.find((entry) => entry.id === draw?.restrictionId) ?? scene.restrictions[0];
  const env = Object.fromEntries(scene.functions.map((entry) => [entry.id, entry.expression]));
  const expr = expressionToGlsl(fn?.expression ?? "0", env);
  const red = expressionToGlsl(color?.red ?? "0", env, "z");
  const green = expressionToGlsl(color?.green ?? "0", env, "z");
  const blue = expressionToGlsl(color?.blue ?? "0", env, "z");
  const bound = expressionToGlsl(restriction?.expression ?? "1", env);
  const boundCheck = restriction?.checkSmaller ? "boundValue <= 0.0" : "boundValue >= 0.0";

  return `
    precision highp float;
    uniform vec2 u_resolution;
    uniform vec4 u_bounds;

    float frac(float a, float b) { return b == 0.0 ? 0.0 : a / b; }
    float ln(float value) { return value > 0.0 ? log(value) : 0.0; }
    float sec(float value) { return 1.0 / cos(value); }
    float csc(float value) { return 1.0 / sin(value); }
    float cot(float value) { return 1.0 / tan(value); }
    float clamp3(float value, float low, float high) { return clamp(value, low, high); }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float x = mix(u_bounds.x, u_bounds.y, uv.x);
      float y = mix(u_bounds.z, u_bounds.w, uv.y);
      float boundValue = ${bound};
      if (!(${boundCheck})) {
        gl_FragColor = vec4(0.97, 0.98, 0.99, 1.0);
        return;
      }
      float z = ${expr};
      vec3 color = clamp(vec3(${red}, ${green}, ${blue}) / 255.0, 0.0, 1.0);
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
  try {
    let js = normalizeExpressionText(source)
      .replaceAll(/~([A-Za-z]\w*)~/g, 'ref("$1", x, y)')
      .replaceAll("^", "**")
      .replaceAll("pi", "Math.PI")
      .replaceAll(/\be\b/g, "Math.E")
      .replaceAll(/\b(sin|cos|tan|asin|acos|atan|sqrt|abs|floor|ceil|round|min|max|exp|log)\b/g, "Math.$1")
      .replaceAll(/\barc(sin|cos|tan)\b/g, "Math.a$1");

    js = js.replaceAll(/(\d)([xy])/g, "$1*$2");
    js = js.replaceAll(/([xy])(\d)/g, "$1*$2");
    js = js.replaceAll(/(\d)\(/g, "$1*(");
    js = js.replaceAll(/\)(\d|[xy])/g, ")*$1");
    js = rewriteBareIdentifiers(js, (name) => `ref("${name}", x, y)`, new Set(["Math"]));

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
        const runtime = env.__runtime ?? { depth: 0, maxDepth: ${recursionLimit()} };
        const ref = (name, rx, ry) => {
          if (!env[name]) return NaN;
          if (runtime.depth >= runtime.maxDepth) return rx + ry;
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
  } catch {
    return () => NaN;
  }
}

function expressionToGlsl(source, env = {}, zName = null, stack = []) {
  if (stack.length > recursionLimit()) {
    return recursionBaseGlsl(zName);
  }
  let expression = normalizeExpressionText(source);
  expression = inlineCustomVariables(expression, env, stack, zName);
  expression = inlineBareVariables(expression, env, stack, zName);
  expression = expression
    .replaceAll(/\barcsin\b/g, "asin")
    .replaceAll(/\barccos\b/g, "acos")
    .replaceAll(/\barctan\b/g, "atan")
    .replaceAll(/\bln\b/g, "log")
    .replaceAll(/\blog\b/g, "log")
    .replaceAll(/\bmin\b/g, "min")
    .replaceAll(/\bmax\b/g, "max")
    .replaceAll(/\bclamp\b/g, "clamp3")
    .replaceAll(/\bpi\b/g, "3.141592653589793")
    .replaceAll(/\be\b/g, "2.718281828459045")
    .replaceAll(/(\d)([xy])/g, "$1*$2")
    .replaceAll(/([xy])(\d)/g, "$1*$2")
    .replaceAll(/(\d)\(/g, "$1*(")
    .replaceAll(/\)(\d|[xy])/g, ")*$1");

  if (zName) {
    expression = expression.replaceAll(/\bx\b/g, zName);
  }

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

function normalizeGlslNumbers(expression) {
  return expression.replaceAll(/\b\d+(?:\.\d+)?\b/g, (match) => (match.includes(".") ? match : `${match}.0`));
}

function recursionBaseGlsl(zName) {
  return zName ? `(${zName}+y)` : "(x+y)";
}

function inlineCustomVariables(expression, env, stack, zName) {
  return expression.replaceAll(/~([A-Za-z]\w*)~/g, (_, name) => {
    if (!env[name]) {
      throw new Error(`Unknown reference ~${name}~`);
    }
    if (stack.length >= recursionLimit()) {
      return `(${recursionBaseGlsl(zName)})`;
    }
    return `(${expressionToGlsl(env[name], env, zName, [...stack, name])})`;
  });
}

function inlineBareVariables(expression, env, stack, zName) {
  return rewriteBareIdentifiers(
    expression,
    (name) => {
      if (!env[name]) {
        throw new Error(`Unknown variable: ${name}`);
      }
      if (stack.length >= recursionLimit()) {
        return `(${recursionBaseGlsl(zName)})`;
      }
      return `(${expressionToGlsl(env[name], env, zName, [...stack, name])})`;
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
  const powerPattern = /([A-Za-z_]\w*|\d+(?:\.\d+)?|\([^()]+\))\s*\^\s*([A-Za-z_]\w*|\d+(?:\.\d+)?|\([^()]+\))/;
  while (powerPattern.test(output)) {
    output = output.replace(powerPattern, "pow($1,$2)");
  }
  return output;
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
    const idResult = validateEntryId(entry.id, "Function");
    if (idResult.status === "invalid") return idResult;
    const result = validateExpression(entry.expression, env, [entry.id]);
    if (result.status === "valid" && RESERVED_FUNCTION_NAMES.has(entry.id)) {
      return { status: "warning", message: `"${entry.id}" shadows a built-in function name` };
    }
    return result;
  });
  diagnostics.colors = scene.colors.map((entry) => {
    const idResult = validateEntryId(entry.id, "Color");
    if (idResult.status === "invalid") return idResult;
    return combineDiagnostics([
      validateExpression(entry.red, env),
      validateExpression(entry.green, env),
      validateExpression(entry.blue, env)
    ]);
  });
  diagnostics.restrictions = scene.restrictions.map((entry) => {
    const idResult = validateEntryId(entry.id, "Boundary");
    return idResult.status === "invalid" ? idResult : validateExpression(entry.expression, env);
  });
  diagnostics.draws = scene.draws.map((entry) => {
    const missing = [];
    if (!scene.functions.some((candidate) => candidate.id === entry.equationId)) missing.push("function");
    if (!scene.colors.some((candidate) => candidate.id === entry.colorId)) missing.push("color");
    if (!scene.restrictions.some((candidate) => candidate.id === entry.restrictionId)) missing.push("boundary");
    return missing.length
      ? { status: "invalid", message: `Missing ${missing.join(", ")}` }
      : { status: "valid", message: "Draw layer is valid" };
  });

  const all = [...diagnostics.functions, ...diagnostics.colors, ...diagnostics.restrictions, ...diagnostics.draws];
  const firstError = all.find((item) => item.status === "invalid");
  const firstWarning = all.find((item) => item.status === "warning");
  diagnostics.hasErrors = Boolean(firstError);
  diagnostics.summary = firstError ? firstError.message : firstWarning ? firstWarning.message : "GLSL ready";
  return diagnostics;
}

function validateEntryId(id, label) {
  if (!id.trim()) {
    return { status: "invalid", message: `${label} name cannot be blank` };
  }
  if (!/^[A-Za-z_]\w*$/.test(id)) {
    return { status: "invalid", message: `${label} name must start with a letter or underscore` };
  }
  return { status: "valid", message: `${label} name is valid` };
}

function validateExpression(source, env, stack = []) {
  try {
    if (/\b[A-Za-z]\w*\(\s*\)/.test(normalizeExpressionText(source))) {
      throw new Error("Empty function argument");
    }
    expressionToGlsl(source, env, null, stack);
    const runtimeEnv = Object.fromEntries(Object.entries(env).map(([id, expr]) => [id, compileExpression(expr)]));
    attachRuntimeGuard(runtimeEnv);
    compileExpression(source)(1, 1, runtimeEnv);
    return { status: "valid", message: "Expression is valid" };
  } catch (error) {
    return { status: "invalid", message: error.message };
  }
}

function updateStatusLights(diagnostics) {
  const group = diagnostics[activeTab] ?? [];
  root.querySelectorAll(".expression-row").forEach((row, index) => {
    const status = row.querySelector(".entry-status");
    const item = group[index];
    if (!status || !item) return;
    status.classList.toggle("valid", item.status === "valid");
    status.classList.toggle("invalid", item.status === "invalid");
    status.classList.toggle("warning", item.status === "warning");
    status.setAttribute("aria-label", item.message);
    row.setAttribute("title", item.message);
  });

  const overlay = root.querySelector(".render-overlay");
  if (overlay) {
    overlay.textContent = diagnostics.hasErrors
      ? `Expression error: ${diagnostics.summary}`
      : `${scene.settings.xPoints} x ${scene.settings.yPoints} · ${scene.settings.angleMode} · depth ${scene.settings.maxRecursion} · ${diagnostics.summary}`;
  }
}

function combineDiagnostics(items) {
  return items.find((item) => item.status === "invalid") ?? { status: "valid", message: "Color is valid" };
}

function handleLatexBeforeInput(field, event) {
  if (!["/", "÷"].includes(event.data)) return;
  const cursor = field.selectionStart;
  const text = field.value;
  const before = text.slice(0, cursor);
  const division = before.match(/([A-Za-z_]\w*|\d+(?:\.\d+)?|\([^()]*\)|\{[^{}]*\})$/);
  if (!division) return;

  event.preventDefault();
  const numerator = division[1].replace(/^\{|\}$/g, "");
  const start = cursor - division[1].length;
  const replacement = `\\frac{${numerator}}{}`;
  field.value = `${text.slice(0, start)}${replacement}${text.slice(cursor)}`;
  field.dataset.source = field.value;
  renderMathEditor(field);
  field.setSelectionRange(start + replacement.length - 1, start + replacement.length - 1);
  field.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function expandLatexShortcut(field) {
  const cursor = field.selectionStart;
  const text = field.value;
  const before = text.slice(0, cursor);
  const division = before.match(/([A-Za-z_]\w*|\d+(?:\.\d+)?|\([^()]*\))(\/|÷)$/);
  if (division) {
    const numerator = division[1];
    const start = cursor - division[0].length;
    const replacement = `\\frac{${numerator}}{}`;
    field.value = `${text.slice(0, start)}${replacement}${text.slice(cursor)}`;
    field.dataset.source = field.value;
    renderMathEditor(field);
    field.setSelectionRange(start + replacement.length - 1, start + replacement.length - 1);
    return;
  }

  const shortcut = before.match(/(?:^|[^A-Za-z\\])([A-Za-z]+)$/);
  if (!shortcut) return;

  const name = shortcut[1];
  if (!LATEX_SHORTCUTS.has(name)) return;
  const start = cursor - name.length;
  const replacement = `\\${name}{}`;
  field.value = `${text.slice(0, start)}${replacement}${text.slice(cursor)}`;
  field.dataset.source = field.value;
  renderMathEditor(field);
  field.setSelectionRange(start + replacement.length - 1, start + replacement.length - 1);
}

function updateMathSource(field) {
  const source = sourceFromLatexText(field.value);
  field.dataset.source = source;
  const raw = root.querySelector(`textarea[data-source-field="${cssEscape(field.dataset.field)}"]`);
  if (raw) raw.value = latexSourceFromExpression(source);
}

function renderMathEditor(field) {
  const source = field.value ?? field.dataset.source ?? "";
  const render = field.closest(".mathquill-editor")?.querySelector(".latex-render");
  if (render) render.innerHTML = renderLatexExpression(source);
  updateMathSourceDisplay(field, source);
}

function rerenderSupportedLatex(field) {
  const source = field.dataset.source ?? "";
  if (!hasRenderableLatex(source) && !hasInternalRenderableCall(source)) return;
  renderMathEditor(field);
  placeCaretAtEnd(field);
}

function hasRenderableLatex(source) {
  return /\\(?:frac|sqrt|left\||lvert|lfloor|lceil|abs|floor|ceil|sin|cos|tan|asin|acos|atan|arcsin|arccos|arctan|log|ln|min|max|exp|sec|csc|cot|round|clamp)\b/.test(source);
}

function hasInternalRenderableCall(source) {
  return /\b(?:frac|sqrt|abs|floor|ceil|sin|cos|tan|asin|acos|atan|arcsin|arccos|arctan|log|ln|min|max|exp|sec|csc|cot|round|clamp)\(/.test(source);
}

function updateMathSourceDisplay(field, source) {
  const raw = root.querySelector(`textarea[data-source-field="${cssEscape(field.dataset.field)}"]`);
  if (raw) raw.value = latexSourceFromExpression(source);
}

function toLatexPreview(source) {
  const normalized = normalizeExpressionDisplayText(source);
  return renderLatexExpression(normalized);
}

function latexSourceFromExpression(source) {
  const normalized = normalizeExpressionDisplayText(source).trim();
  if (normalized.startsWith("\\")) return normalized;
  const fraction = splitTopLevel(normalized, "/");
  if (fraction) {
    return `\\frac{${latexSourceFromExpression(fraction[0])}}{${latexSourceFromExpression(fraction[1])}}`;
  }

  const fracCall = parseFunctionCall(normalized, "frac");
  if (fracCall && fracCall.length === 2) {
    return `\\frac{${latexSourceFromExpression(fracCall[0])}}{${latexSourceFromExpression(fracCall[1])}}`;
  }

  const sqrtCall = parseFunctionCall(normalized, "sqrt");
  if (sqrtCall && sqrtCall.length === 1) {
    return `\\sqrt{${latexSourceFromExpression(sqrtCall[0])}}`;
  }

  const absCall = parseFunctionCall(normalized, "abs");
  if (absCall && absCall.length === 1) {
    return `\\left|${latexSourceFromExpression(absCall[0])}\\right|`;
  }

  const floorCall = parseFunctionCall(normalized, "floor");
  if (floorCall && floorCall.length === 1) {
    return `\\lfloor${latexSourceFromExpression(floorCall[0])}\\rfloor`;
  }

  const ceilCall = parseFunctionCall(normalized, "ceil");
  if (ceilCall && ceilCall.length === 1) {
    return `\\lceil${latexSourceFromExpression(ceilCall[0])}\\rceil`;
  }

  for (const [name, config] of Object.entries(LATEX_FUNCTIONS)) {
    if (["frac", "sqrt", "abs", "floor", "ceil"].includes(name)) continue;
    const call = parseFunctionCall(normalized, config.internal);
    if (call && call.length === config.args) {
      return `\\${name}${call.map((arg) => `{${latexSourceFromExpression(arg)}}`).join("")}`;
    }
  }

  return normalized
    .replaceAll(/\bpi\b/g, "\\pi")
    .replaceAll(/\b(sin|cos|tan|log|ln)\(/g, "\\$1{")
    .replaceAll(/\)/g, "}");
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
  const trimmed = source.trim();
  if (!trimmed) return "";

  const commandIndex = nextLatexCommandIndex(trimmed);
  if (commandIndex !== -1) {
    const parsed = parseLatexCommandAt(trimmed, commandIndex);
    if (parsed) {
      return `${renderLatexExpression(trimmed.slice(0, commandIndex))}${parsed.html}${renderLatexExpression(trimmed.slice(parsed.end))}`;
    }
  }

  const internalIndex = nextInternalCallIndex(trimmed);
  if (internalIndex !== -1) {
    const parsed = parseInternalCallAt(trimmed, internalIndex);
    if (parsed) {
      return `${renderLatexExpression(trimmed.slice(0, internalIndex))}${parsed.html}${renderLatexExpression(trimmed.slice(parsed.end))}`;
    }
  }

  const latexFrac = parseLatexCommand(trimmed, "frac", 2);
  if (latexFrac) {
    return renderLatexFunction("frac", latexFrac);
  }

  const latexSqrt = parseLatexCommand(trimmed, "sqrt", 1);
  if (latexSqrt) {
    return renderLatexFunction("sqrt", latexSqrt);
  }

  const fraction = splitTopLevel(trimmed, "/");
  if (fraction) {
    return fractionHtml(renderLatexExpression(fraction[0]), renderLatexExpression(fraction[1]), `\\frac{${fraction[0]}}{${fraction[1]}}`);
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
  for (let i = source.length - 1; i >= 0; i -= 1) {
    const char = source[i];
    if (char === ")") depth += 1;
    if (char === "(") depth -= 1;
    if (depth === 0 && char === operator) {
      return [source.slice(0, i), source.slice(i + 1)];
    }
  }
  return null;
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
  let start = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
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
    ...scene.functions.map((entry) => `F:${entry.id}~${entry.expression}`),
    "~~~~~",
    ...scene.colors.map((entry) => `C:${entry.id}~${entry.red}~${entry.green}~${entry.blue}`),
    "~~~~~",
    ...scene.restrictions.map((entry) => `R:${entry.id}~${entry.expression}~${entry.checkSmaller ? 1 : 0}`),
    "~~~~~",
    ...scene.draws.map((entry) => `D~${entry.equationId}~${entry.colorId}~${entry.restrictionId}`),
    "~~~~~",
    `S:x_min~${scene.settings.xMin}`,
    `S:x_points~${scene.settings.xPoints}`,
    `S:x_max~${scene.settings.xMax}`,
    `S:y_min~${scene.settings.yMin}`,
    `S:y_points~${scene.settings.yPoints}`,
    `S:y_max~${scene.settings.yMax}`,
    `S:max_recursion~${scene.settings.maxRecursion}`,
    `S:angle_mode~${scene.settings.angleMode}`
  ].join("\n");
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
      next.functions.push({ id, expression });
    } else if (line.startsWith("C:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [red = "0", green = "0", blue = "0"] = rest.split("~");
      next.colors.push({ id, red, green, blue });
    } else if (line.startsWith("R:")) {
      const [id, rest] = splitFirst(line.slice(2), "~");
      const [expression = "1", flag = "0"] = rest.split("~");
      next.restrictions.push({ id, expression, checkSmaller: flag === "1" });
    } else if (line.startsWith("D~")) {
      const [, equationId, colorId, restrictionId] = line.split("~");
      next.draws.push({ equationId, colorId, restrictionId });
    } else if (line.startsWith("S:")) {
      const [key, value] = splitFirst(line.slice(2), "~");
      const settingMap = { x_min: "xMin", x_points: "xPoints", x_max: "xMax", y_min: "yMin", y_points: "yPoints", y_max: "yMax", max_recursion: "maxRecursion", angle_mode: "angleMode" };
      const mapped = settingMap[key];
      if (mapped) next.settings[mapped] = mapped === "angleMode" ? value : Number(value);
    }
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
  const stripped = stripChannelPrefix(value);
  const assignment = parseAssignment(stripped);
  return assignment ? assignment.expression : stripped;
}

function latexToExpression(value) {
  let source = String(value)
    .replace(/\u00a0/g, " ")
    .replaceAll("π", "pi")
    .trim();

  source = replaceLatexDelimited(source, "\\left|", "\\right|", (inner) => `abs(${latexToExpression(inner)})`);
  source = replaceLatexDelimited(source, "|", "|", (inner) => `abs(${latexToExpression(inner)})`);
  source = replaceLatexDelimited(source, "\\lvert", "\\rvert", (inner) => `abs(${latexToExpression(inner)})`);
  source = replaceLatexDelimited(source, "\\lfloor", "\\rfloor", (inner) => `floor(${latexToExpression(inner)})`);
  source = replaceLatexDelimited(source, "\\lceil", "\\rceil", (inner) => `ceil(${latexToExpression(inner)})`);

  for (const [command, config] of Object.entries(LATEX_FUNCTIONS)) {
    source = replaceLatexCommand(source, command, (args) => `${config.internal}(${args.map((arg) => latexToExpression(arg)).join(",")})`);
  }
  return source.replaceAll(/\\left|\\right/g, "").replaceAll(/\\pi\b/g, "pi");
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

window.addEventListener("resize", renderScene);
renderApp();
