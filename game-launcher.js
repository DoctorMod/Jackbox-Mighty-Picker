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
const openingModal = document.querySelector("#opening-modal");
const openingModalClose = document.querySelector("#opening-modal-close");
const openingDismiss = document.querySelector("#opening-dismiss");
const openingGameTitle = document.querySelector("#opening-game-title");
const openingPackTitle = document.querySelector("#opening-pack-title");
const openingArt = document.querySelector("#opening-art");
const openingStatusText = document.querySelector("#opening-status-text");
let openingTimeoutId = null;
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

let rawManifest = {};
let rawMetadata = [];

async function loadAssetManifest() {
  try {
    const response = await fetch("./assets/manifest.json");
    if (!response.ok) return;
    rawManifest = await response.json();
    Object.entries(rawManifest).forEach(([key, asset]) => {
      artworkCache.set(key, asset.path);
      if (asset.backgroundPath) backgroundCache.set(key, asset.backgroundPath);
    });
  } catch { }
}

async function loadMetadata() {
  try {
    const response = await fetch("./game-metadata.json");
    if (!response.ok) return;
    rawMetadata = await response.json();
    rawMetadata.forEach((record) => metadataByKey.set(`${record.packId}:${record.id}`, record));
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

function openOpeningModal(game) {
  lastFocusedElement = document.activeElement;
  openingGameTitle.textContent = game.title;
  openingPackTitle.textContent = game.packTitle;
  const artUrl = backgroundCache.get(artworkKey(game)) || fallbackArtwork(game);
  if (artUrl) {
    openingArt.style.backgroundImage = `url("${artUrl}")`;
    openingArt.hidden = false;
  } else {
    openingArt.hidden = true;
  }
  openingStatusText.textContent = `Opening ${game.title} in Steam...`;
  openingModal.hidden = false;
  openingDismiss.focus();

  if (openingTimeoutId) clearTimeout(openingTimeoutId);
  openingTimeoutId = setTimeout(() => {
    closeOpeningModal();
  }, 4000);
}

function closeOpeningModal() {
  if (openingTimeoutId) {
    clearTimeout(openingTimeoutId);
    openingTimeoutId = null;
  }
  openingModal.hidden = true;
  lastFocusedElement?.focus();
}

function selectGame(index) { if (!visibleGames.length) return; selectedGameIndex = (index + visibleGames.length) % visibleGames.length; renderGames(); }
function launchGame() { const game = currentGame(); if (!game) return; if (game.sources.length > 1) openSourceModal(game); else launchSource(game.sources[0]); }
function launchSource(game) {
  const windowsPath = game.path.replaceAll("/", "\\");
  const launchUrl = `steam://run/${game.steamAppId}// -launchTo ${windowsPath} -jbg.config isBundle=false`;
  status.textContent = `Opening ${game.title} in Steam...`;
  openOpeningModal(game);
  if (window.__TAURI__?.core?.invoke) {
    window.__TAURI__.core.invoke("open_steam", { url: launchUrl }).catch((err) => {
      console.error("Tauri steam launch error:", err);
      window.location.href = launchUrl;
    });
  } else if (window.__TAURI_INTERNALS__?.invoke) {
    window.__TAURI_INTERNALS__.invoke("open_steam", { url: launchUrl }).catch((err) => {
      console.error("Tauri steam launch error:", err);
      window.location.href = launchUrl;
    });
  } else {
    window.location.href = launchUrl;
  }
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
openingModalClose.addEventListener("click", closeOpeningModal);
openingDismiss.addEventListener("click", closeOpeningModal);
openingModal.addEventListener("click", (event) => { if (event.target === openingModal) closeOpeningModal(); });

document.addEventListener("keydown", (event) => {
  if (!catalog) return;
  if (!openingModal.hidden) {
    if (["Escape", "Backspace", "Enter", " "].includes(event.key)) {
      closeOpeningModal();
      event.preventDefault();
    }
    return;
  }
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
    if (!openingModal.hidden) {
      if (pressed(0) || pressed(1)) closeOpeningModal();
    } else if (!sourceModal.hidden) {
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

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeTitle(title) {
  return normalize(title).replace("thejackboxpartystarter", "");
}

function labelFor(value) {
  return String(value || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rangeLabel(range, suffix) {
  if (!range?.min || !range?.max) return "Unknown";
  return range.min === range.max ? `${range.min} ${suffix}` : `${range.min} - ${range.max} ${suffix}`;
}

function extractUtilityMetadata(game, pack, utilityGame) {
  const info = utilityGame?.game_info;
  if (!info) return {
    id: game.id,
    title: game.title,
    packId: pack.id,
    pack: pack.title,
    playerCount: "Unknown",
    duration: "Unknown",
    features: [],
    gameType: "Unknown",
    language: ["Unknown"],
    description: "Unknown",
    gameMode: "Unknown"
  };
  const tags = Array.isArray(info.tags) ? info.tags : [];
  const features = tags.map(labelFor);
  if (info.family_friendly === "FAMILY_FRIENDLY") features.push("Family friendly");
  if (info.audience) features.push("Audience");
  if (info.moderation && info.moderation !== "NO_MODERATION") features.push("Moderation");
  if (info.stream_friendly === "PLAYABLE") features.push("Stream friendly");
  if (info.subtitles) features.push("Subtitles");
  const gameType = tags.length ? labelFor(tags[0]) : "Unknown";
  return {
    id: game.id,
    title: game.title,
    packId: pack.id,
    pack: pack.title,
    playerCount: rangeLabel(info.players, "Players"),
    duration: rangeLabel(info.playtime, "Minutes"),
    features: [...new Set(features)],
    gameType,
    language: [info.translation === "NATIVELY_TRANSLATED" ? "English (translated)" : "English"],
    description: info.description || info.small_description || info.tagline || "Unknown",
    gameMode: info.type ? labelFor(info.type) : "Unknown"
  };
}

function findUtilityGame(utilityPacks, game, pack) {
  const utilityPack = utilityPacks.find((candidate) => String(candidate.launchers_id?.steam) === String(pack.steamAppId));
  if (!utilityPack) return null;
  const pathKey = normalize(game.path);
  const titleKey = normalizeTitle(game.title);
  return utilityPack.games.find((candidate) => normalize(candidate.path) === pathKey)
    || utilityPack.games.find((candidate) => normalizeTitle(candidate.name) === titleKey)
    || null;
}

function findUtilityBackground(utilityGame) {
  const utilityAssetsUrl = "https://raw.githubusercontent.com/AkiraArtuhaxis/JackboxUtility-Server-en/main/assets/";
  return utilityGame?.background ? new URL(utilityGame.background, utilityAssetsUrl).toString() : null;
}

async function checkAndUpdateAssets() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch("https://raw.githubusercontent.com/AkiraArtuhaxis/JackboxUtility-Server-en/main/api/v2/packs.json", {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) return;

    const data = await response.json();
    const utilityPacks = data?.packs;
    if (!Array.isArray(utilityPacks) || !catalog?.packs) return;

    let updatedAssets = 0;
    let updatedMetadata = 0;
    const itemsToUpdate = [];

    catalog.packs.forEach((pack) => {
      pack.games.forEach((game) => {
        const key = `${pack.id}:${game.id}`;
        const hasBackground = backgroundCache.has(key) && Boolean(backgroundCache.get(key));
        const meta = metadataByKey.get(key);
        const needsMeta = !meta || meta.playerCount === "Unknown" || meta.gameType === "Unknown";

        if (!hasBackground || needsMeta) {
          const uGame = findUtilityGame(utilityPacks, game, pack);
          if (uGame) {
            itemsToUpdate.push({ game, pack, key, uGame, needsBackground: !hasBackground, needsMeta });
          }
        }
      });
    });

    if (!itemsToUpdate.length) return;

    status.textContent = `Checking for game updates (${itemsToUpdate.length} item(s))...`;

    for (const item of itemsToUpdate) {
      const { game, pack, key, uGame, needsBackground, needsMeta } = item;

      if (needsMeta && uGame.game_info) {
        const newMeta = extractUtilityMetadata(game, pack, uGame);
        metadataByKey.set(key, newMeta);
        const metaIndex = rawMetadata.findIndex((r) => `${r.packId}:${r.id}` === key);
        if (metaIndex >= 0) rawMetadata[metaIndex] = newMeta;
        else rawMetadata.push(newMeta);

        allGames.forEach((g) => {
          if (g.packId === pack.id && g.id === game.id) Object.assign(g, newMeta);
        });
        updatedMetadata++;
      }

      if (needsBackground) {
        const bgUrl = findUtilityBackground(uGame);
        if (bgUrl) {
          try {
            const imgRes = await fetch(bgUrl);
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              const objectUrl = URL.createObjectURL(blob);
              backgroundCache.set(key, objectUrl);
              artworkCache.set(key, objectUrl);

              const ext = bgUrl.endsWith(".png") ? ".png" : bgUrl.endsWith(".jpg") ? ".jpg" : ".webp";
              const relPath = `assets/${pack.id}-${game.id}-background${ext}`;
              rawManifest[key] = {
                path: relPath,
                source: bgUrl,
                backgroundPath: relPath,
                backgroundSource: bgUrl
              };

              if (window.__TAURI__?.core?.invoke) {
                const arrayBuffer = await blob.arrayBuffer();
                const bytes = Array.from(new Uint8Array(arrayBuffer));
                window.__TAURI__.core.invoke("save_asset_file", { relativePath: relPath, data: bytes }).catch(console.error);
              }
              updatedAssets++;
            }
          } catch (e) {
            console.warn(`Failed to fetch artwork for ${game.title}:`, e);
          }
        }
      }
    }

    if (updatedAssets > 0 || updatedMetadata > 0) {
      status.textContent = `Updated ${updatedAssets} asset(s) and ${updatedMetadata} metadata entry(s).`;
      setTimeout(() => { if (status.textContent.startsWith("Updated")) status.textContent = ""; }, 4000);
      renderGames();

      if (window.__TAURI__?.core?.invoke) {
        if (updatedAssets > 0) {
          window.__TAURI__.core.invoke("save_metadata_file", {
            filename: "assets/manifest.json",
            content: `${JSON.stringify(rawManifest, null, 2)}\n`
          }).catch(console.error);
        }
        if (updatedMetadata > 0) {
          window.__TAURI__.core.invoke("save_metadata_file", {
            filename: "game-metadata.json",
            content: `${JSON.stringify(rawMetadata, null, 2)}\n`
          }).catch(console.error);
        }
      }
    } else {
      status.textContent = "";
    }
  } catch (err) {
    console.warn("Asset update check skipped:", err);
  }
}

pollController();
Promise.all([loadAssetManifest(), loadMetadata()])
  .then(loadCatalog)
  .then(() => {
    setTimeout(checkAndUpdateAssets, 1200);
  });
