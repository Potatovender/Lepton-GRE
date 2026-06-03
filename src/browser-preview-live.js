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

let scene = structuredClone(DEFAULT_SCENE);
let activeTab = "functions";
let sidebarWidth = Number(localStorage.getItem("lepton-sidebar-width") ?? "380");

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
  renderScene(diagnostics);
}

function renderPanel() {
  const diagnostics = validateScene();

  if (activeTab === "functions") {
    return [
      ...scene.functions.map(
        (entry, index) => expressionRow(diagnostics.functions[index]?.status ?? "invalid", diagnostics.functions[index]?.message ?? "", `
          <input class="entry-id" data-field="functions.${index}.id" value="${escapeHtml(entry.id)}" aria-label="Function id" />
          <textarea class="math-box" data-field="functions.${index}.expression" aria-label="Function expression">${escapeHtml(entry.expression)}</textarea>
          <div class="latex-preview">${toLatexPreview(entry.expression)}</div>
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
          <textarea class="math-box math-box-small" data-field="colors.${index}.red" aria-label="Red expression">r = ${escapeHtml(entry.red)}</textarea>
          <div class="latex-preview">${toLatexPreview(entry.red)}</div>
          <textarea class="math-box math-box-small" data-field="colors.${index}.green" aria-label="Green expression">g = ${escapeHtml(entry.green)}</textarea>
          <div class="latex-preview">${toLatexPreview(entry.green)}</div>
          <textarea class="math-box math-box-small" data-field="colors.${index}.blue" aria-label="Blue expression">b = ${escapeHtml(entry.blue)}</textarea>
          <div class="latex-preview">${toLatexPreview(entry.blue)}</div>
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
          <textarea class="math-box" data-field="restrictions.${index}.expression" aria-label="Restriction expression">${escapeHtml(entry.expression)}</textarea>
          <div class="latex-preview">${toLatexPreview(entry.expression)}</div>
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

  root.querySelectorAll("textarea[data-field]").forEach((field) => {
    field.addEventListener("input", () => {
      expandMathShortcut(field);
      updateField(field);
      updateLatexPreview(field);
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
      addEntry(button.dataset.add);
      renderApp();
    });
  });
}

function bindSidebarResize() {
  const resizer = root.querySelector(".sidebar-resizer");
  if (!resizer) return;

  const onMove = (event) => {
    sidebarWidth = Math.max(280, Math.min(620, event.clientX));
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

function updateField(field) {
  const [collection, rawIndex, property] = field.dataset.field.split(".");
  const value = field.type === "checkbox" ? field.checked : stripChannelPrefix(field.value);

  if (collection === "settings") {
    scene.settings[rawIndex] = rawIndex === "angleMode" ? value : Number(value);
    return;
  }

  scene[collection][Number(rawIndex)][property] = value;
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
  const xPoints = axis(scene.settings.xMin, scene.settings.xMax, scene.settings.xPoints);
  const yPoints = axis(scene.settings.yMin, scene.settings.yMax, scene.settings.yPoints);
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
    scene.settings.xMin,
    scene.settings.xMax,
    scene.settings.yMin,
    scene.settings.yMax
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
    let js = stripChannelPrefix(source)
      .replaceAll("^", "**")
      .replaceAll("pi", "Math.PI")
      .replaceAll(/\be\b/g, "Math.E")
      .replaceAll(/\b(sin|cos|tan|asin|acos|atan|sqrt|abs|floor|ceil|round|min|max|exp|log)\b/g, "Math.$1")
      .replaceAll(/\barc(sin|cos|tan)\b/g, "Math.a$1")
      .replaceAll(/~([A-Za-z]\w*)~/g, 'ref("$1", x, y)');

    js = js.replaceAll(/(\d)([xy])/g, "$1*$2");
    js = js.replaceAll(/([xy])(\d)/g, "$1*$2");
    js = js.replaceAll(/(\d)\(/g, "$1*(");
    js = js.replaceAll(/\)(\d|[xy])/g, ")*$1");

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
        const ref = (name, rx, ry) => env[name] ? env[name](rx, ry, env) : NaN;
        return ${js};
      `
    );
  } catch {
    return () => NaN;
  }
}

function expressionToGlsl(source, env = {}, zName = null, stack = []) {
  let expression = stripChannelPrefix(source);
  expression = inlineCustomVariables(expression, env, stack, zName);
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
  if (!/^[\dA-Za-z_+\-*/().,\s~]+$/.test(expression)) {
    throw new Error(`Unsupported GLSL expression: ${source}`);
  }
  return expression;
}

function normalizeGlslNumbers(expression) {
  return expression.replaceAll(/\b\d+(?:\.\d+)?\b/g, (match) => (match.includes(".") ? match : `${match}.0`));
}

function inlineCustomVariables(expression, env, stack, zName) {
  return expression.replaceAll(/~([A-Za-z]\w*)~/g, (_, name) => {
    if (!env[name]) {
      throw new Error(`Unknown reference ~${name}~`);
    }
    if (stack.includes(name)) {
      throw new Error(`Recursive reference: ${[...stack, name].join(" -> ")}`);
    }
    if (stack.length >= scene.settings.maxRecursion) {
      throw new Error(`Recursion depth exceeded at ~${name}~`);
    }
    return `(${expressionToGlsl(env[name], env, zName, [...stack, name])})`;
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
  const env = Object.fromEntries(scene.functions.map((entry) => [entry.id, entry.expression]));
  const diagnostics = {
    functions: [],
    colors: [],
    restrictions: [],
    draws: [],
    hasErrors: false,
    summary: "GLSL ready"
  };

  diagnostics.functions = scene.functions.map((entry) => validateExpression(entry.expression, env, [entry.id]));
  diagnostics.colors = scene.colors.map((entry) =>
    combineDiagnostics([
      validateExpression(entry.red, env),
      validateExpression(entry.green, env),
      validateExpression(entry.blue, env)
    ])
  );
  diagnostics.restrictions = scene.restrictions.map((entry) => validateExpression(entry.expression, env));
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
  diagnostics.hasErrors = Boolean(firstError);
  diagnostics.summary = firstError ? firstError.message : "GLSL ready";
  return diagnostics;
}

function validateExpression(source, env, stack = []) {
  try {
    if (/\b[A-Za-z]\w*\(\s*\)/.test(stripChannelPrefix(source))) {
      throw new Error("Empty function argument");
    }
    expressionToGlsl(source, env, null, stack.slice(0, -1));
    compileExpression(source)(1, 1, Object.fromEntries(Object.entries(env).map(([id, expr]) => [id, compileExpression(expr)])));
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

function expandMathShortcut(field) {
  const cursor = field.selectionStart;
  const before = field.value.slice(0, cursor);
  const shortcut = before.match(/(?:^|[^A-Za-z])(sqrt|sin|cos|tan|log|ln)$/);
  if (!shortcut) return;

  const name = shortcut[1];
  const start = cursor - name.length;
  const replacement = `${name}()`;
  field.value = `${field.value.slice(0, start)}${replacement}${field.value.slice(cursor)}`;
  const nextCursor = start + name.length + 1;
  field.setSelectionRange(nextCursor, nextCursor);
}

function updateLatexPreview(field) {
  const preview = field.nextElementSibling?.classList.contains("latex-preview") ? field.nextElementSibling : null;
  if (preview) {
    preview.innerHTML = toLatexPreview(stripChannelPrefix(field.value));
  }
}

function toLatexPreview(source) {
  const text = stripChannelPrefix(source)
    .replaceAll(/sqrt\(([^()]*)\)/g, "√($1)")
    .replaceAll(/sin/g, "sin")
    .replaceAll(/cos/g, "cos")
    .replaceAll(/tan/g, "tan")
    .replaceAll(/pi/g, "π")
    .replaceAll(/\^2/g, "²")
    .replaceAll(/\^3/g, "³")
    .replaceAll(/~([A-Za-z]\w*)~/g, "<span class=\"latex-ref\">$1</span>");
  return escapeHtml(text).replaceAll("&lt;span class=&quot;latex-ref&quot;&gt;", "<span class=\"latex-ref\">").replaceAll("&lt;/span&gt;", "</span>");
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

window.addEventListener("resize", renderScene);
renderApp();
