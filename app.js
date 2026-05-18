const LANGUAGES = ["Portuguese", "Haitian Creole", "Spanish", "French"];
const LANGUAGE_FLAGS = {
  Portuguese: {
    label: "Brazil",
    emoji: "\uD83C\uDDE7\uD83C\uDDF7",
  },
  "Haitian Creole": {
    label: "Haiti",
    emoji: "\uD83C\uDDED\uD83C\uDDF9",
  },
  Spanish: {
    label: "Venezuela",
    emoji: "\uD83C\uDDFB\uD83C\uDDEA",
  },
  French: {
    label: "Benin",
    emoji: "\uD83C\uDDE7\uD83C\uDDEF",
  },
};
const DAILY_TASKS = ["Read BoM", "Pray", "Flash cards"];
const SUPPLEMENTARY_TASKS = [
  "Podcast",
  "Journal",
  "Shadowing",
  "Poetry",
  "News article",
  "Grammar exercise",
  "Show/movie",
  "Text friend",
  "Send voicemail",
  "Tutoring",
];
const STORAGE_KEY = "language-practice-pwa:v1";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const state = loadState();

const setupPanel = document.querySelector("#setupPanel");
const appPanel = document.querySelector("#appPanel");
const setupLanguages = document.querySelector("#setupLanguages");
const weekRange = document.querySelector("#weekRange");
const targetLanguage = document.querySelector("#targetLanguage");
const resetAnchorButton = document.querySelector("#resetAnchorButton");
const todayDate = document.querySelector("#todayDate");
const dailyTasks = document.querySelector("#dailyTasks");
const dailySummary = document.querySelector("#dailySummary");
const supplementTask = document.querySelector("#supplementTask");
const supplementLanguage = document.querySelector("#supplementLanguage");
const supplementForm = document.querySelector("#supplementForm");
const supplementList = document.querySelector("#supplementList");
const calendarFilter = document.querySelector("#calendarFilter");
const calendarGrid = document.querySelector("#calendarGrid");
const calendarMonths = document.querySelector("#calendarMonths");
const exportButton = document.querySelector("#exportButton");
const importFile = document.querySelector("#importFile");
const backupStatus = document.querySelector("#backupStatus");
const manifestLink = document.querySelector("link[rel='manifest']");
const faviconLink = document.querySelector("link[rel='icon']");
const appleTouchIconLink = document.querySelector("link[rel='apple-touch-icon']");

init();

function init() {
  populateSetup();
  populateSelects();
  bindEvents();
  render();
  registerServiceWorker();
}

function loadState() {
  const fallback = { anchorWeekStart: null, anchorLanguage: null, entries: [] };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateAppIcon(language) {
  const flag = LANGUAGE_FLAGS[language] || LANGUAGE_FLAGS.Portuguese;
  const svg = [
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>",
    "<rect width='512' height='512' rx='96' fill='#1f6f5b'/>",
    "<circle cx='256' cy='256' r='168' fill='#ffffff'/>",
    `<text x='256' y='306' text-anchor='middle' font-size='218' font-family='Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif'>${flag.emoji}</text>`,
    "</svg>",
  ].join("");
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const manifest = {
    name: "Language Practice",
    short_name: "Practice",
    description: "Track rotating daily language practice and supplementary activities.",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#eef2f1",
    theme_color: "#1f6f5b",
    icons: [
      {
        src: url,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
  const manifestUrl = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;
  document.title = `${flag.emoji} Language Practice`;
  manifestLink.href = manifestUrl;
  faviconLink.href = url;
  appleTouchIconLink.href = url;
  appleTouchIconLink.setAttribute("aria-label", `${flag.label} flag icon`);
}

function bindEvents() {
  resetAnchorButton.addEventListener("click", () => {
    state.anchorWeekStart = null;
    state.anchorLanguage = null;
    saveState();
    render();
  });

  supplementForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addEntry({
      kind: "supplementary",
      task: supplementTask.value,
      language: supplementLanguage.value,
      date: todayKey(),
    });
    supplementForm.reset();
    supplementLanguage.value = currentTargetLanguage();
    render();
  });

  calendarFilter.addEventListener("change", renderCalendar);
  exportButton.addEventListener("click", exportCsv);
  importFile.addEventListener("change", importCsv);
}

function populateSetup() {
  setupLanguages.innerHTML = "";
  LANGUAGES.forEach((language) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = language;
    button.addEventListener("click", () => {
      state.anchorWeekStart = weekStartKey(new Date());
      state.anchorLanguage = language;
      saveState();
      render();
    });
    setupLanguages.append(button);
  });
}

function populateSelects() {
  supplementTask.innerHTML = optionList(SUPPLEMENTARY_TASKS);
  supplementLanguage.innerHTML = optionList(LANGUAGES);
  calendarFilter.innerHTML = optionList(["All activities", ...LANGUAGES]);
}

function optionList(values) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

function render() {
  if (!state.anchorWeekStart || !state.anchorLanguage) {
    setupPanel.hidden = false;
    appPanel.hidden = true;
    return;
  }

  setupPanel.hidden = true;
  appPanel.hidden = false;
  const target = currentTargetLanguage();
  updateAppIcon(target);
  targetLanguage.textContent = target;
  weekRange.textContent = formatWeekRange(currentWeekStart());
  todayDate.textContent = formatLongDate(new Date());
  supplementLanguage.value = target;
  renderDailyTasks();
  renderSupplementList();
  renderCalendar();
}

function renderDailyTasks() {
  dailyTasks.innerHTML = "";
  const date = todayKey();
  const target = currentTargetLanguage();
  const completed = DAILY_TASKS.filter((task) => hasDailyEntry(date, task, target));
  dailySummary.textContent = `${completed.length}/${DAILY_TASKS.length}`;

  DAILY_TASKS.forEach((task) => {
    const label = document.createElement("label");
    label.className = "daily-task";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = hasDailyEntry(date, task, target);
    input.addEventListener("change", () => toggleDailyTask(date, task, target, input.checked));
    label.append(input, document.createTextNode(task));
    dailyTasks.append(label);
  });
}

function renderSupplementList() {
  const entries = state.entries.filter((entry) => entry.kind === "supplementary" && entry.date === todayKey());
  supplementList.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "backup-status";
    empty.textContent = "No supplementary practice logged today.";
    supplementList.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const chip = document.createElement("span");
    chip.className = "entry-chip";
    chip.textContent = `${entry.task} - ${entry.language}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.title = "Remove entry";
    remove.setAttribute("aria-label", `Remove ${entry.task} in ${entry.language}`);
    remove.textContent = "x";
    remove.addEventListener("click", () => {
      state.entries = state.entries.filter((candidate) => candidate.id !== entry.id);
      saveState();
      render();
    });
    chip.append(remove);
    supplementList.append(chip);
  });
}

function renderCalendar() {
  const today = startOfDay(new Date());
  const firstVisible = addDays(today, -364);
  const gridStart = addDays(firstVisible, -firstVisible.getDay());
  const gridEnd = addDays(today, 6 - today.getDay());
  const filter = calendarFilter.value || "All activities";

  calendarGrid.innerHTML = "";
  calendarMonths.innerHTML = "";

  for (let date = new Date(gridStart); date <= gridEnd; date = addDays(date, 1)) {
    const key = dateKey(date);
    const count = activityCount(key, filter);
    const cell = document.createElement("div");
    cell.className = `day-cell level-${intensityLevel(count)}`;
    cell.title = `${formatLongDate(date)}: ${count} ${count === 1 ? "activity" : "activities"}`;
    cell.setAttribute("role", "img");
    cell.setAttribute("aria-label", cell.title);
    calendarGrid.append(cell);
  }

  for (let week = new Date(gridStart); week <= gridEnd; week = addDays(week, 7)) {
    const month = document.createElement("div");
    month.textContent = week.getDate() <= 7 ? week.toLocaleDateString(undefined, { month: "short" }) : "";
    calendarMonths.append(month);
  }
}

function toggleDailyTask(date, task, language, checked) {
  const existing = state.entries.find((entry) => (
    entry.kind === "daily" && entry.date === date && entry.task === task && entry.language === language
  ));
  if (checked && !existing) {
    addEntry({ kind: "daily", task, language, date });
  }
  if (!checked && existing) {
    state.entries = state.entries.filter((entry) => entry.id !== existing.id);
    saveState();
  }
  render();
}

function addEntry(entry) {
  state.entries.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
    ...entry,
  });
  saveState();
}

function hasDailyEntry(date, task, language) {
  return state.entries.some((entry) => (
    entry.kind === "daily" && entry.date === date && entry.task === task && entry.language === language
  ));
}

function activityCount(date, filter) {
  return state.entries.filter((entry) => (
    entry.date === date && (filter === "All activities" || entry.language === filter)
  )).length;
}

function intensityLevel(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function currentTargetLanguage() {
  const anchorIndex = LANGUAGES.indexOf(state.anchorLanguage);
  const weeks = Math.floor((parseLocalDate(weekStartKey(new Date())) - parseLocalDate(state.anchorWeekStart)) / (7 * MS_PER_DAY));
  return LANGUAGES[((anchorIndex + weeks) % LANGUAGES.length + LANGUAGES.length) % LANGUAGES.length];
}

function currentWeekStart() {
  return parseLocalDate(weekStartKey(new Date()));
}

function weekStartKey(date) {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return dateKey(start);
}

function todayKey() {
  return dateKey(new Date());
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatLongDate(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatWeekRange(start) {
  const end = addDays(start, 6);
  const options = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
}

function exportCsv() {
  const rows = [
    ["record_type", "id", "date", "kind", "task", "language", "created_at", "anchor_week_start", "anchor_language"],
    ["meta", "", "", "", "", "", new Date().toISOString(), state.anchorWeekStart, state.anchorLanguage],
    ...state.entries.map((entry) => [
      "entry",
      entry.id,
      entry.date,
      entry.kind,
      entry.task,
      entry.language,
      entry.createdAt,
      "",
      "",
    ]),
  ];
  const blob = new Blob([rows.map(csvRow).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `language-practice-${todayKey()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  backupStatus.textContent = "CSV backup exported.";
}

function importCsv(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = parseCsv(String(reader.result));
      const header = imported.shift();
      const rows = imported.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] || ""])));
      const meta = rows.find((row) => row.record_type === "meta");
      const entries = rows.filter((row) => row.record_type === "entry").map((row) => ({
        id: row.id || `${Date.now()}-${Math.random()}`,
        date: row.date,
        kind: row.kind,
        task: row.task,
        language: row.language,
        createdAt: row.created_at || new Date().toISOString(),
      })).filter(isValidEntry);

      if (!meta || !meta.anchor_week_start || !LANGUAGES.includes(meta.anchor_language)) {
        throw new Error("Backup metadata is missing or invalid.");
      }

      state.anchorWeekStart = meta.anchor_week_start;
      state.anchorLanguage = meta.anchor_language;
      state.entries = entries;
      saveState();
      backupStatus.textContent = `Imported ${entries.length} activities.`;
      importFile.value = "";
      render();
    } catch (error) {
      backupStatus.textContent = `Import failed: ${error.message}`;
    }
  });
  reader.readAsText(file);
}

function isValidEntry(entry) {
  const validTask = entry.kind === "daily" ? DAILY_TASKS.includes(entry.task) : SUPPLEMENTARY_TASKS.includes(entry.task);
  return /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && ["daily", "supplementary"].includes(entry.kind)
    && validTask
    && LANGUAGES.includes(entry.language);
}

function csvRow(values) {
  return values.map((value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(",");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}
