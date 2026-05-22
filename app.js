const LANGUAGES = ["Portuguese", "Haitian Creole", "Spanish", "French"];
const TASKS = [
  { name: "Read BoM", kind: "daily", points: 5 },
  { name: "Pray", kind: "daily", points: 5 },
  { name: "Flash cards", kind: "daily", points: 5 },
  { name: "Podcast", kind: "supplementary", points: 5 },
  { name: "Journal", kind: "supplementary", points: 13 },
  { name: "Shadowing", kind: "supplementary", points: 10 },
  { name: "Poetry", kind: "supplementary", points: 10 },
  { name: "News article", kind: "supplementary", points: 9 },
  { name: "Grammar exercise", kind: "supplementary", points: 8 },
  { name: "Show/movie", kind: "supplementary", points: 6 },
  { name: "Text friend", kind: "supplementary", points: 6 },
  { name: "Send voicemail", kind: "supplementary", points: 12 },
  { name: "AI Convo", kind: "supplementary", points: 12 },
  { name: "Tutoring", kind: "supplementary", points: 15 },
];
const DAILY_TASKS = TASKS.filter((task) => task.kind === "daily");
const SUPPLEMENTARY_TASKS = TASKS.filter((task) => task.kind === "supplementary");
const TASK_BY_NAME = Object.fromEntries(TASKS.map((task) => [task.name, task]));
const DAILY_BONUS = 5;
const BACKDATE_DEDUCTION = 10;
const STORAGE_KEY = "language-practice-pwa:v1";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const state = loadState();
let selectedDate = todayKey();

const setupPanel = document.querySelector("#setupPanel");
const appPanel = document.querySelector("#appPanel");
const setupLanguages = document.querySelector("#setupLanguages");
const weekRange = document.querySelector("#weekRange");
const targetLanguage = document.querySelector("#targetLanguage");
const resetAnchorButton = document.querySelector("#resetAnchorButton");
const todayDate = document.querySelector("#todayDate");
const recordingDate = document.querySelector("#recordingDate");
const dailyTasks = document.querySelector("#dailyTasks");
const dailySummary = document.querySelector("#dailySummary");
const dailyPoints = document.querySelector("#dailyPoints");
const weeklyPoints = document.querySelector("#weeklyPoints");
const totalPoints = document.querySelector("#totalPoints");
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
      date: selectedDate,
    });
    supplementForm.reset();
    supplementLanguage.value = targetLanguageForDate(selectedDate);
    render();
  });

  recordingDate.addEventListener("change", () => {
    selectedDate = isRecordableDate(recordingDate.value) ? recordingDate.value : todayKey();
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
  supplementTask.innerHTML = taskOptionList(SUPPLEMENTARY_TASKS);
  supplementLanguage.innerHTML = optionList(LANGUAGES);
  calendarFilter.innerHTML = optionList(["All activities", ...LANGUAGES]);
}

function optionList(values) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

function taskOptionList(tasks) {
  return tasks.map((task) => (
    `<option value="${escapeHtml(task.name)}">${escapeHtml(taskLabel(task))}</option>`
  )).join("");
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
  targetLanguage.textContent = target;
  weekRange.textContent = formatWeekRange(currentWeekStart());
  recordingDate.max = todayKey();
  recordingDate.value = selectedDate;
  todayDate.textContent = formatLongDate(parseLocalDate(selectedDate));
  supplementLanguage.value = targetLanguageForDate(selectedDate);
  renderDailyTasks();
  renderSupplementList();
  renderScoreDashboard();
  renderCalendar();
}

function renderDailyTasks() {
  dailyTasks.innerHTML = "";
  const date = selectedDate;
  const target = targetLanguageForDate(date);
  const completed = DAILY_TASKS.filter((task) => hasDailyEntry(date, task.name, target));
  dailySummary.textContent = `${completed.length}/${DAILY_TASKS.length}`;

  DAILY_TASKS.forEach((task) => {
    const label = document.createElement("label");
    label.className = "daily-task";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = hasDailyEntry(date, task.name, target);
    input.addEventListener("change", () => toggleDailyTask(date, task.name, target, input.checked));
    label.append(input, document.createTextNode(taskLabel(task)));
    dailyTasks.append(label);
  });
}

function renderSupplementList() {
  const entries = state.entries.filter((entry) => entry.kind === "supplementary" && entry.date === selectedDate);
  supplementList.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "backup-status";
    empty.textContent = "No supplementary practice logged for this date.";
    supplementList.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const chip = document.createElement("span");
    chip.className = "entry-chip";
    chip.textContent = `${taskLabel(TASK_BY_NAME[entry.task])} - ${entry.language}`;
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

function renderScoreDashboard() {
  const weekStart = weekStartKey(parseLocalDate(selectedDate));
  dailyPoints.textContent = scoreDate(selectedDate);
  weeklyPoints.textContent = scoreRange(weekStart, addDays(parseLocalDate(weekStart), 6));
  totalPoints.textContent = scoreAllDates();
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
    const points = scoreDate(key, filter);
    const cell = document.createElement("div");
    cell.className = `day-cell level-${intensityLevel(points)}`;
    cell.title = `${formatLongDate(date)}: ${pointText(points)}`;
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
    backdated: entry.date < todayKey(),
    ...entry,
  });
  saveState();
}

function hasDailyEntry(date, task, language) {
  return state.entries.some((entry) => (
    entry.kind === "daily" && entry.date === date && entry.task === task && entry.language === language
  ));
}

function taskLabel(task) {
  return `${task.name} (${task.points})`;
}

function pointText(points) {
  return `${points} ${points === 1 ? "point" : "points"}`;
}

function scoreDate(date, filter = "All activities") {
  const entries = entriesForDate(date, filter);
  const taskPoints = entries.reduce((sum, entry) => sum + TASK_BY_NAME[entry.task].points, 0);
  const dailyBonus = completeDailyLanguages(entries).length * DAILY_BONUS;
  const backdateDeduction = entries.some((entry) => entry.backdated) ? BACKDATE_DEDUCTION : 0;
  return taskPoints + dailyBonus - backdateDeduction;
}

function scoreRange(startKey, endDate) {
  let total = 0;
  for (let date = parseLocalDate(startKey); date <= endDate; date = addDays(date, 1)) {
    total += scoreDate(dateKey(date));
  }
  return total;
}

function scoreAllDates() {
  return [...new Set(state.entries.map((entry) => entry.date))]
    .reduce((sum, date) => sum + scoreDate(date), 0);
}

function entriesForDate(date, filter) {
  return state.entries.filter((entry) => (
    entry.date === date && (filter === "All activities" || entry.language === filter)
  ));
}

function completeDailyLanguages(entries) {
  const dailyByLanguage = new Map();
  entries.filter((entry) => entry.kind === "daily").forEach((entry) => {
    const tasks = dailyByLanguage.get(entry.language) || new Set();
    tasks.add(entry.task);
    dailyByLanguage.set(entry.language, tasks);
  });
  return [...dailyByLanguage.entries()]
    .filter(([, tasks]) => DAILY_TASKS.every((task) => tasks.has(task.name)))
    .map(([language]) => language);
}

function intensityLevel(points) {
  if (points <= 0) return 0;
  if (points <= 5) return 1;
  if (points <= 15) return 2;
  if (points <= 30) return 3;
  return 4;
}

function currentTargetLanguage() {
  return targetLanguageForDate(todayKey());
}

function targetLanguageForDate(date) {
  const anchorIndex = LANGUAGES.indexOf(state.anchorLanguage);
  const weeks = Math.floor((parseLocalDate(weekStartKey(parseLocalDate(date))) - parseLocalDate(state.anchorWeekStart)) / (7 * MS_PER_DAY));
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

function isRecordableDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= todayKey();
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
    ["record_type", "id", "date", "kind", "task", "language", "created_at", "backdated", "anchor_week_start", "anchor_language"],
    ["meta", "", "", "", "", "", new Date().toISOString(), "", state.anchorWeekStart, state.anchorLanguage],
    ...state.entries.map((entry) => [
      "entry",
      entry.id,
      entry.date,
      entry.kind,
      entry.task,
      entry.language,
      entry.createdAt,
      entry.backdated ? "true" : "",
      "",
      "",
    ]),
  ];
  const blob = new Blob([rows.map(csvRow).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `polyglot-${todayKey()}.csv`;
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
        backdated: row.backdated === "true",
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
  const task = TASK_BY_NAME[entry.task];
  return /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && ["daily", "supplementary"].includes(entry.kind)
    && task?.kind === entry.kind
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
