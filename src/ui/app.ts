export function createApp(root: HTMLDivElement): void {
  root.innerHTML = `
    <main class="app-shell">
      <section class="expression-panel" aria-label="Expression editor">
        <header class="panel-header">
          <strong>Lepton-GRE</strong>
        </header>
        <nav class="tab-row" aria-label="Editor sections">
          <button class="tab-button" aria-selected="true">Functions</button>
          <button class="tab-button" aria-selected="false">Colors</button>
          <button class="tab-button" aria-selected="false">Bounds</button>
          <button class="tab-button" aria-selected="false">Draw</button>
        </nav>
        <div class="entry-list">
          <div class="expression-row">
            <span class="entry-status valid"></span>
            <textarea class="math-box" aria-label="Expression">eq = sin(x) + cos(y)</textarea>
          </div>
        </div>
        <footer class="panel-footer">
          <button class="toolbar-button primary">Render</button>
        </footer>
      </section>
      <section class="renderer-pane" aria-label="Grid renderer">
        <canvas class="grid-canvas"></canvas>
        <div class="render-overlay">Scaffold ready</div>
      </section>
    </main>
  `;
}
