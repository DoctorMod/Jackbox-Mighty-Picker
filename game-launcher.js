const filters = document.querySelector("#filters");
const gameGrid = document.querySelector("#game-grid");
const launchButton = document.querySelector("#launch");
const status = document.querySelector("#status");
const catalogFallback = document.querySelector("#catalog-fallback");
const catalogFile = document.querySelector("#catalog-file");
const search = document.querySelector("#search");
const gameCount = document.querySelector("#game-count");
const detailArt = document.querySelector("#detail-art");
const detailTitle = document.querySelector("#detail-title");
const detailDescription = document.querySelector("#detail-description");
const detailTags = document.querySelector("#detail-tags");
const controllerStatus = document.querySelector("#controller-status");
const sourceModal = document.querySelector("#source-modal");
const sourceModalTitle = document.querySelector("#source-modal-title");
const sourceModalDescription = document.querySelector("#source-modal-description");
const sourceList = document.querySelector("#source-list");
const sourceModalClose = document.querySelector("#source-modal-close");
const advancedModal = document.querySelector("#advanced-modal");
const advancedFields = document.querySelector("#advanced-fields");
const advancedFilterButton = document.querySelector("#advanced-filter-button");
const advancedModalClose = document.querySelector("#advanced-modal-close");
const advancedClear = document.querySelector("#advanced-clear");
const advancedApply = document.querySelector("#advanced-apply");
const sortButton = document.querySelector("#sort-button");
let catalog;
let allGames = [];
let visibleGames = [];
let selectedGameIndex = 0;
let activeFilter = "All games";
let sortDirection = "catalog";
let advancedFilters = {};
const metadataByKey = new Map();
const artworkCache = new Map();
const backgroundCache = new Map();
let lastFocusedElement;
let gamepads = [];
let previousButtons = [];
let previousAxes = [0, 0];

function currentGame() { return visibleGames[selectedGameIndex]; }
function artworkKey(game) { return `${game.packId}:${game.id}`; }
function fallbackArtwork(game) { return backgroundCache.get(artworkKey(game)) || ""; }

function filterList() {
  const iconByCategory = { "All games": "▦", Drawing: "✎", Trivia: "?", Writing: "✍", Knowledge: "◎", Talking: "◉", Deduction: "◇", Sound: "♫", Puzzle: "✣" };
  const categories = ["All games", ...new Set(allGames.flatMap((game) => [game.gameType, ...(game.features || [])])
    .filter((category) => category && !["Unknown", "Family friendly", "Audience", "Moderation", "Stream friendly", "Subtitles"].includes(category) && !category.startsWith("Audience mode")))].map((label) => [label, iconByCategory[label] || "•"]);
  filters.replaceChildren(...categories.map(([label, icon]) => {
    const button = document.createElement("button");
    button.className = `filter${label === activeFilter ? " active" : ""}`;
    button.type = "button";
    button.dataset.filter = label;
    button.innerHTML = `<span aria-hidden="true">${icon}</span>${label}`;
    button.setAttribute("aria-pressed", label === activeFilter);
    button.addEventListener("click", () => { activeFilter = label; selectedGameIndex = 0; filterList(); renderGames(); });
    return button;
  }));
}

function cycleQuickFilter(direction) {
  const labels = [...filters.querySelectorAll("button")];
  if (!labels.length) return;
  const current = labels.findIndex((button) => button.dataset.filter === activeFilter);
  const next = labels[(current + direction + labels.length) % labels.length];
  activeFilter = next.dataset.filter;
  selectedGameIndex = 0;
  filterList();
  renderGames();
}

function uniqueValues(field) {
  return [...new Set(allGames.flatMap((game) => Array.isArray(game[field]) ? game[field] : [game[field]]).filter(Boolean))].sort();
}

function addToggleField(label, field, values) {
  const wrapper = document.createElement("fieldset");
  wrapper.className = "advanced-field";
  const legend = document.createElement("legend");
  legend.textContent = label;
  wrapper.append(legend);
  const options = document.createElement("div");
  options.className = "toggle-options";
  const selected = advancedFilters[field] || [];
  values.forEach((value) => {
    const option = document.createElement("label");
    option.className = "toggle-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.dataset.field = field;
    input.checked = selected.includes(value);
    const text = document.createElement("span");
    text.textContent = value;
    option.append(input, text);
    options.append(option);
  });
  wrapper.append(options);
  advancedFields.append(wrapper);
}

function addTextField(label, field) {
  const wrapper = document.createElement("label");
  wrapper.className = "advanced-field";
  wrapper.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.dataset.field = field;
  input.value = advancedFilters[field] || "";
  input.placeholder = "Contains...";
  wrapper.append(input);
  advancedFields.append(wrapper);
}

function numericRange(value) {
  const numbers = String(value || "").match(/\d+/g)?.map(Number) || [];
  return numbers.length ? [numbers[0], numbers[1] ?? numbers[0]] : null;
}

function addRangeField(label, field, suffix) {
  const ranges = allGames.map((game) => numericRange(game[field])).filter(Boolean);
  if (!ranges.length) return;
  const minimum = Math.min(...ranges.map(([low]) => low));
  const maximum = Math.max(...ranges.map(([, high]) => high));
  const filterField = `${field}Range`;
  const current = advancedFilters[filterField] || { min: minimum, max: maximum };
  const wrapper = document.createElement("label");
  wrapper.className = "advanced-field";
  wrapper.textContent = label;
  const values = document.createElement("div");
  values.className = "range-values";
  const rangePair = document.createElement("div");
  rangePair.className = "range-pair";
  rangePair.dataset.field = filterField;
  rangePair.innerHTML = `<input type="range" min="${minimum}" max="${maximum}" value="${current.min}" data-bound="min"><input type="range" min="${minimum}" max="${maximum}" value="${current.max}" data-bound="max">`;
  const update = () => {
    const inputs = [...rangePair.querySelectorAll("input")];
    if (Number(inputs[0].value) > Number(inputs[1].value)) [inputs[0].value, inputs[1].value] = [inputs[1].value, inputs[0].value];
    const span = maximum - minimum || 1;
    rangePair.style.setProperty("--range-start", `${((Number(inputs[0].value) - minimum) / span) * 100}%`);
    rangePair.style.setProperty("--range-end", `${((Number(inputs[1].value) - minimum) / span) * 100}%`);
    values.textContent = `${inputs[0].value} - ${inputs[1].value} ${suffix}`;
  };
  rangePair.querySelectorAll("input").forEach((input) => input.addEventListener("input", update));
  update();
  wrapper.append(values, rangePair);
  advancedFields.append(wrapper);
}

function renderAdvancedFields() {
  advancedFields.replaceChildren();
  addToggleField("Pack", "packTitle", uniqueValues("packTitle"));
  addToggleField("Game type", "gameType", uniqueValues("gameType"));
  addToggleField("Game mode", "gameMode", uniqueValues("gameMode"));
  addRangeField("Player count", "playerCount", "players");
  addRangeField("Duration", "duration", "minutes");
  addTextField("Description", "description");
  addToggleField("Features", "feature", uniqueValues("features"));
}

function openAdvancedModal() { renderAdvancedFields(); advancedModal.hidden = false; advancedModalClose.focus(); }
function closeAdvancedModal() { advancedModal.hidden = true; }
function modalControls(modal) { return [...modal.querySelectorAll("button, select, input[type=text], input[type=range], input[type=checkbox]")].filter((control) => !control.disabled); }
function moveModalFocus(modal, direction) {
  const controls = modalControls(modal);
  if (!controls.length) return;
  const current = controls.indexOf(document.activeElement);
  controls[(current + direction + controls.length) % controls.length].focus();
}

function applyAdvancedFilters() {
  const next = {};
  advancedFields.querySelectorAll("input[type=text]").forEach((field) => { if (field.value) next[field.dataset.field] = field.value; });
  advancedFields.querySelectorAll(".range-pair").forEach((pair) => {
    const inputs = [...pair.querySelectorAll("input")];
    next[pair.dataset.field] = { min: Number(inputs[0].value), max: Number(inputs[1].value) };
  });
  ["packTitle", "gameType", "gameMode", "feature"].forEach((field) => {
    const values = [...advancedFields.querySelectorAll(`input[type=checkbox][data-field="${field}"]:checked`)].map((input) => input.value);
    if (values.length) next[field] = values;
  });
  advancedFilters = next;
  selectedGameIndex = 0;
  closeAdvancedModal();
  renderGames();
}

function cycleSort() {
  sortDirection = sortDirection === "catalog" ? "az" : sortDirection === "az" ? "za" : "catalog";
  sortButton.textContent = `Sort: ${sortDirection === "catalog" ? "catalog" : sortDirection.toUpperCase()}`;
  selectedGameIndex = 0;
  renderGames();
}

function applyFilters() {
  const term = search.value.trim().toLowerCase();
  visibleGames = allGames.filter((game) => {
    const tags = [game.gameType, ...(game.features || [])].map((value) => value.toLowerCase());
    const matchesFilter = activeFilter === "All games" || tags.includes(activeFilter.toLowerCase());
    const matchesAdvanced = Object.entries(advancedFilters).every(([field, value]) => {
      if (!value || (Array.isArray(value) && !value.length)) return true;
      if (["packTitle", "gameType", "gameMode"].includes(field)) return value.includes(game[field]);
      if (field === "feature") return value.some((feature) => (game.features || []).includes(feature));
      if (field === "description") return String(game.description || "").toLowerCase().includes(value.toLowerCase());
      if (field === "playerCountRange" || field === "durationRange") {
        const range = numericRange(game[field.replace("Range", "")]);
        return range && range[0] <= value.max && range[1] >= value.min;
      }
      return String(game[field] || "") === value;
    });
    return matchesFilter && matchesAdvanced && (!term || `${game.title} ${game.packTitle} ${game.description || ""}`.toLowerCase().includes(term));
  });
  if (sortDirection !== "catalog") visibleGames.sort((left, right) => {
    const result = left.packTitle.localeCompare(right.packTitle) || left.title.localeCompare(right.title);
    return sortDirection === "az" ? result : -result;
  });
  if (selectedGameIndex >= visibleGames.length) selectedGameIndex = Math.max(0, visibleGames.length - 1);
}

function renderGames() {
  applyFilters();
  gameCount.textContent = `${visibleGames.length} of ${allGames.length} games`;
  gameGrid.replaceChildren(...visibleGames.map((game, index) => {
    const card = document.createElement("button");
    card.className = `game-card${index === selectedGameIndex ? " selected" : ""}`;
    card.type = "button";
    card.setAttribute("aria-label", `Select ${game.title}`);
    card.innerHTML = `<div class="game-art"><span class="game-number">${String(index + 1).padStart(2, "0")}</span><span class="game-title"></span></div>`;
    card.querySelector(".game-title").textContent = game.title;
    card.querySelector(".game-art").style.backgroundImage = `url("${fallbackArtwork(game)}")`;
    card.addEventListener("click", () => selectGame(index));
    return card;
  }));
  launchButton.disabled = !visibleGames.length;
  renderDetail();
  requestAnimationFrame(() => gameGrid.querySelector(".selected")?.scrollIntoView({ block: "nearest", inline: "nearest" }));
}

async function loadAssetManifest() {
  try {
    const response = await fetch("./assets/manifest.json");
    if (!response.ok) return;
    const manifest = await response.json();
    Object.entries(manifest).forEach(([key, asset]) => {
      artworkCache.set(key, asset.path);
      if (asset.backgroundPath) backgroundCache.set(key, asset.backgroundPath);
    });
  } catch { }
}

async function loadMetadata() {
  try {
    const response = await fetch("./game-metadata.json");
    if (!response.ok) return;
    const metadata = await response.json();
    metadata.forEach((record) => metadataByKey.set(`${record.packId}:${record.id}`, record));
  } catch { }
}

function useCatalog(value) {
  if (!Array.isArray(value?.packs)) throw new Error("Invalid catalog");
  catalog = value;
  const entries = catalog.packs.flatMap((pack) => pack.games.map((game) => {
    const metadata = metadataByKey.get(`${pack.id}:${game.id}`) || {};
    return { ...game, ...metadata, packTitle: pack.title, packId: pack.id, steamAppId: pack.steamAppId, type: (metadata.gameType || "party").toLowerCase() };
  }));
  allGames = [...new Map(entries.map((game) => [game.title.toLowerCase(), game])).values()];
  allGames.forEach((game) => { game.sources = entries.filter((entry) => entry.title.toLowerCase() === game.title.toLowerCase()); });
  catalogFallback.hidden = true;
  status.textContent = "";
  filterList();
  renderGames();
}

function renderDetail() {
  const game = currentGame();
  if (!game) return;
  detailTitle.textContent = game.title;
  detailDescription.textContent = `${game.description || "Description unavailable"} ${game.playerCount || "Player count unavailable"} | ${game.duration || "Duration unavailable"} | ${(game.language || ["Language unavailable"]).join(", ")}`;
  const tags = [game.gameType || game.type, game.packTitle.replace("Jackbox ", ""), ...(game.features || []), "Steam"];
  detailTags.replaceChildren(...tags.map((tag) => { const element = document.createElement("span"); element.className = "detail-tag"; element.textContent = tag; return element; }));
  detailArt.style.backgroundImage = `url("${backgroundCache.get(artworkKey(game)) || fallbackArtwork(game)}")`;
}

function selectGame(index) { if (!visibleGames.length) return; selectedGameIndex = (index + visibleGames.length) % visibleGames.length; renderGames(); }
function launchGame() { const game = currentGame(); if (!game) return; if (game.sources.length > 1) openSourceModal(game); else launchSource(game.sources[0]); }
function launchSource(game) {
  const windowsPath = game.path.replaceAll("/", "\\");
  const launchUrl = `steam://run/${game.steamAppId}// -launchTo ${windowsPath} -jbg.config isBundle=false`;
  status.textContent = `Opening ${game.title} in Steam...`;
  window.location.href = launchUrl;
}
function openSourceModal(game) {
  lastFocusedElement = document.activeElement;
  sourceModalTitle.textContent = game.title;
  sourceModalDescription.textContent = "This game is included in multiple packs. Choose which Steam pack to open.";
  sourceList.replaceChildren(...game.sources.map((source) => {
    const button = document.createElement("button");
    button.className = "source-button";
    button.type = "button";
    button.innerHTML = `<span></span><small>Open in Steam -></small>`;
    button.querySelector("span").textContent = source.packTitle;
    button.addEventListener("click", () => { closeSourceModal(); launchSource(source); });
    return button;
  }));
  sourceModal.hidden = false;
  sourceList.querySelector("button")?.focus();
}
function closeSourceModal() { sourceModal.hidden = true; lastFocusedElement?.focus(); }

async function loadCatalog() {
  try {
    const response = await fetch("./pack-games.json");
    if (!response.ok) throw new Error("Catalog request failed");
    useCatalog(await response.json());
  } catch {
    status.textContent = "Choose the catalog JSON file to continue.";
    catalogFallback.hidden = false;
  }
}

catalogFile.addEventListener("change", async () => {
  const file = catalogFile.files[0];
  if (!file) return;
  try { useCatalog(JSON.parse(await file.text())); } catch { status.textContent = "That is not a valid pack catalog."; }
});
search.addEventListener("input", () => { selectedGameIndex = 0; renderGames(); });
launchButton.addEventListener("click", launchGame);
advancedFilterButton.addEventListener("click", openAdvancedModal);
advancedModalClose.addEventListener("click", closeAdvancedModal);
advancedApply.addEventListener("click", applyAdvancedFilters);
advancedClear.addEventListener("click", () => { advancedFilters = {}; renderAdvancedFields(); });
advancedModal.addEventListener("click", (event) => { if (event.target === advancedModal) closeAdvancedModal(); });
sortButton.addEventListener("click", cycleSort);
sourceModalClose.addEventListener("click", closeSourceModal);
sourceModal.addEventListener("click", (event) => { if (event.target === sourceModal) closeSourceModal(); });

document.addEventListener("keydown", (event) => {
  if (!catalog) return;
  if (!sourceModal.hidden) {
    if (event.key === "Escape" || event.key === "Backspace") closeSourceModal();
    if (event.key === "ArrowDown" || event.key === "ArrowRight") moveModalFocus(sourceModal, 1);
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") moveModalFocus(sourceModal, -1);
    return;
  }
  if (!advancedModal.hidden) {
    if (event.key === "Escape" || event.key === "Backspace") closeAdvancedModal();
    if (event.key === "ArrowDown" || event.key === "ArrowRight") moveModalFocus(advancedModal, 1);
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") moveModalFocus(advancedModal, -1);
    return;
  }
  if (event.target.matches("input, select, button")) return;
  if (["ArrowLeft", "a", "A"].includes(event.key)) selectGame(selectedGameIndex - 1);
  if (["ArrowRight", "d", "D"].includes(event.key)) selectGame(selectedGameIndex + 1);
  if (["ArrowUp", "w", "W"].includes(event.key)) selectGame(selectedGameIndex - 4);
  if (["ArrowDown", "s", "S"].includes(event.key)) selectGame(selectedGameIndex + 4);
  if (event.key === "f" || event.key === "F") openAdvancedModal();
  if (event.key === "r" || event.key === "R") cycleSort();
  if (["Enter", " "].includes(event.key)) launchGame();
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
});

window.addEventListener("gamepadconnected", (event) => {
  gamepads[event.gamepad.index] = event.gamepad;
  controllerStatus.textContent = `${event.gamepad.id.slice(0, 28)} connected`;
  controllerStatus.classList.add("connected");
});
window.addEventListener("gamepaddisconnected", (event) => {
  delete gamepads[event.gamepad.index];
  if (!gamepads.some(Boolean)) { controllerStatus.textContent = "Controller not detected"; controllerStatus.classList.remove("connected"); }
});
function pollController() {
  const connected = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (connected) {
    gamepads[connected.index] = connected;
    const buttons = connected.buttons.map((button) => button.pressed);
    const pressed = (index) => buttons[index] && !previousButtons[index];
    const axisPressed = (axis, direction) => connected.axes[axis] * direction > .6 && previousAxes[axis] * direction <= .6;
    const left = pressed(14) || axisPressed(0, -1);
    const right = pressed(15) || axisPressed(0, 1);
    const up = pressed(12) || axisPressed(1, -1);
    const down = pressed(13) || axisPressed(1, 1);
    if (!sourceModal.hidden) {
      if (up || left) moveModalFocus(sourceModal, -1);
      if (down || right) moveModalFocus(sourceModal, 1);
      if (pressed(0)) document.activeElement?.click();
      if (pressed(1)) closeSourceModal();
    } else if (!advancedModal.hidden) {
      if (up || left) moveModalFocus(advancedModal, -1);
      if (down || right) moveModalFocus(advancedModal, 1);
      if (pressed(0)) document.activeElement?.click();
      if (pressed(1)) closeAdvancedModal();
    } else {
      if (left) selectGame(selectedGameIndex - 1);
      if (right) selectGame(selectedGameIndex + 1);
      if (up) selectGame(selectedGameIndex - 4);
      if (down) selectGame(selectedGameIndex + 4);
      if (pressed(0)) launchGame();
      if (pressed(1)) selectGame(selectedGameIndex - 1);
      if (pressed(4)) cycleQuickFilter(-1);
      if (pressed(5)) cycleQuickFilter(1);
      if (pressed(2)) openAdvancedModal();
      if (pressed(3)) cycleSort();
    }
    previousButtons = buttons;
    previousAxes = [connected.axes[0] || 0, connected.axes[1] || 0];
  }
  requestAnimationFrame(pollController);
}

pollController();
Promise.all([loadAssetManifest(), loadMetadata()]).then(loadCatalog);
