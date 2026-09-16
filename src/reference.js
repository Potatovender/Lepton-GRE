import { renderFunctionReference } from "./reference-data.js?v=20260916-click-status";

const catalogue = document.querySelector("[data-function-catalogue]");
// The release build includes the complete catalogue in HTML for offline reading
// and indexing. The dev server renders the same metadata on demand.
if (!catalogue.querySelector(".function-entry")) catalogue.innerHTML = renderFunctionReference();
const search = document.querySelector("[data-function-search]");
const count = document.querySelector("[data-function-count]");
function filterFunctions() {
  const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let visible = 0;
  for (const entry of catalogue.querySelectorAll(".function-entry")) {
    const text = `${entry.textContent} ${entry.closest(".function-group").getAttribute("aria-label")}`.toLowerCase();
    entry.hidden = !words.every((word) => text.includes(word));
    if (!entry.hidden) visible += 1;
  }
  for (const group of catalogue.querySelectorAll(".function-group")) {
    group.hidden = !group.querySelector(".function-entry:not([hidden])");
  }
  count.textContent = `${visible} function${visible === 1 ? "" : "s"}`;
  document.querySelector("[data-no-functions]").hidden = visible !== 0;
}
search.addEventListener("input", filterFunctions);
document.querySelector("[data-clear-search]").addEventListener("click", () => {
  search.value = "";
  filterFunctions();
  search.focus();
});
filterFunctions();
