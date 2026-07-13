const STORAGE_KEY = "nexo-v2";
const STORAGE_FALLBACK_KEYS = ["mi-futuro-v2", "gasto-claro-v1"];
const THEME_KEY = "nexo-theme";
const THEME_FALLBACK_KEYS = ["mi-futuro-theme"];
const SYNC_LOCAL_UPDATED_KEY = "nexo-local-updated-at";
const SYNC_LOCAL_UPDATED_FALLBACK_KEYS = ["mi-futuro-local-updated-at"];
const SYNC_AUTO_KEY = "nexo-auto-sync-wifi";
const SYNC_AUTO_FALLBACK_KEYS = ["mi-futuro-auto-sync-wifi"];
const WELCOME_KEY = "nexo-v1.17-welcome-seen";
const WELCOME_FALLBACK_KEYS = ["mi-futuro-v1.17-welcome-seen"];
const DEMO_KEY = "nexo-demo-mode";
const DEMO_FALLBACK_KEYS = ["mi-futuro-demo-mode"];
const ACTIVE_SCREEN_KEY = "nexo-active-screen";
const ACTIVE_SCREEN_FALLBACK_KEYS = ["mi-futuro-active-screen"];

const recurringIcons = {
  "Casa": "⌂", "Coche": "◇", "Agua": "≈", "Luz": "ϟ", "Gas": "♨",
  "Parking": "Ⓟ", "Internet y móvil": "⌁", "Suscripción": "▶",
  "Seguro": "♢", "Gimnasio": "●", "Comunidad": "▦", "Otro": "+"
};

const brandClasses = {
  netflix: "netflix-logo", disney: "disney-logo", spotify: "spotify-logo",
  prime: "prime-logo", max: "max-logo", youtube: "youtube-logo", apple: "apple-logo"
};

const brandAssets = {
  netflix: "netflix.svg", disney: "disneyplus.svg", spotify: "spotify.svg",
  prime: "primevideo.svg", max: "max.svg", youtube: "youtube.svg", apple: "apple.svg"
};

const templateIcons = {
  "Casa": "house", "Coche": "car", "Agua": "water", "Luz": "bolt",
  "Gas": "flame", "Parking": "parking", "Internet y móvil": "wifi",
  "Seguro": "shield", "Gimnasio": "gym", "Comunidad": "building",
  "Otro": "plus", "Otra suscripción": "play", "Suscripción": "play"
};

const defaultCategoryIcons = {
  "Vivienda": "🏠", "Alimentación": "🛒", "Transporte": "⛽", "Ocio": "🎬",
  "Salud": "💊", "Compras": "🛍️", "Suscripciones": "🔁", "Otros": "✨",
  "Bizum recibido": "💸", "Devolución": "↩️", "Nómina": "💶", "Otros ingresos": "➕"
};

const defaultExpenseCategories = ["Vivienda", "Alimentación", "Transporte", "Ocio", "Salud", "Compras", "Suscripciones", "Otros"];
const defaultIncomeCategories = ["Bizum recibido", "Devolución", "Nómina", "Otros ingresos"];

const categoryEmojiPresets = ["✨", "🎮", "🍔", "🍽️", "☕", "🎁", "🐶", "🐱", "👕", "📚", "✈️", "🏖️", "🚗", "⛽", "🏠", "💡", "📶", "🧾", "💊", "🎬", "🎵", "🏋️", "🛒", "🛍️", "💸", "💶", "📦", "🛠️", "🧼", "🚬"];

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function ensureStateShape() {
  state.rules = state.rules || [];
  state.categoryBudgets = state.categoryBudgets || {};
  state.goals = state.goals || [];
  state.customCategories = state.customCategories || [];
  state.categoryIcons = state.categoryIcons || {};
  state.hiddenDefaultCategories = state.hiddenDefaultCategories || [];
  state.importHistory = state.importHistory || [];
  state.bank = state.bank || { provider: "demo", connected: false, lastSyncAt: "", candidates: [] };
  state.bank.selectedCandidateIds = state.bank.selectedCandidateIds || [];
}

function customCategoriesByType(type) {
  ensureStateShape();
  return state.customCategories.filter((category) => (category.type || "expense") === type);
}

function expenseCategories() {
  ensureStateShape();
  return uniqueValues([
    ...defaultExpenseCategories.filter((name) => !state.hiddenDefaultCategories.includes(name)),
    ...customCategoriesByType("expense").map((category) => category.name)
  ]);
}

function incomeCategories() {
  ensureStateShape();
  return uniqueValues([
    ...defaultIncomeCategories.filter((name) => !state.hiddenDefaultCategories.includes(name)),
    ...customCategoriesByType("income").map((category) => category.name)
  ]);
}

function categoryIcon(name) {
  ensureStateShape();
  const custom = state.customCategories.find((category) => category.name === name);
  return state.categoryIcons[name] || custom?.icon || defaultCategoryIcons[name] || "✨";
}

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
let state = loadState();
let selectedMonth = currentMonth;
let activeTheme = loadTheme();
let pendingCsvItems = [];
let pendingImportFile = null;
let pendingImportIncludeDuplicates = false;
let pendingImportResetData = false;
let pendingConvertedCsvText = "";
let pendingConvertedCsvName = "";
let pendingCsvMappingContext = null;
let pendingCsvProfileInfo = "";
let lastImportSummary = null;
const movementFilters = { search: "", type: "all", category: "all", importBatchId: "all" };
const selectedMovementIds = new Set();
let suppressSyncMark = false;
let autoSyncTimer = null;
let lastWifiSyncMeta = null;

const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const shortDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const longMonth = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
const monthNamesShort = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];
let monthDialogYear = Number(selectedMonth.split("-")[0]);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || STORAGE_FALLBACK_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    const stored = JSON.parse(raw);
    return { months: {}, expenses: [], recurring: [], rules: [], categoryBudgets: {}, goals: [], customCategories: [], categoryIcons: {}, hiddenDefaultCategories: [], importHistory: [], ...(stored || {}) };
  } catch {
    return { months: {}, expenses: [], recurring: [], rules: [], categoryBudgets: {}, goals: [], customCategories: [], categoryIcons: {}, hiddenDefaultCategories: [], importHistory: [] };
  }
}


function emptyState() {
  return { months: {}, expenses: [], recurring: [], rules: [], categoryBudgets: {}, goals: [], customCategories: [], categoryIcons: {}, hiddenDefaultCategories: [], importHistory: [] };
}

function demoDate(day) {
  return `${selectedMonth}-${String(day).padStart(2, "0")}`;
}

function createDemoState() {
  const demoBatchId = `demo-${Date.now()}`;
  const movements = [
    { name: "Nómina demo", amount: 1850, date: demoDate(1), category: "Nómina", type: "income", originalDescription: "ABONO DE NOMINA DEMO", source: "demo" },
    { name: "Alquiler", amount: 650, date: demoDate(2), category: "Vivienda", type: "expense", originalDescription: "RECIBO ALQUILER DEMO", source: "demo" },
    { name: "Mercadona", amount: 54.35, date: demoDate(4), category: "Alimentación", type: "expense", originalDescription: "SUPERMERCADO MERCADONA DEMO", source: "demo" },
    { name: "Netflix", amount: 6.99, date: demoDate(5), category: "Suscripciones", type: "expense", originalDescription: "PAYPAL *NETFLIX DEMO", source: "demo" },
    { name: "Repsol Waylet", amount: 48.2, date: demoDate(8), category: "Transporte", type: "expense", originalDescription: "REPSOL WAYLET DEMO", source: "demo" },
    { name: "Amazon", amount: 29.99, date: demoDate(11), category: "Compras", type: "expense", originalDescription: "WWW.AMAZON DEMO", source: "demo" },
    { name: "Restaurante", amount: 42.5, date: demoDate(14), category: "Alimentación", type: "expense", originalDescription: "RESTAURANTE DEMO", source: "demo" },
    { name: "Basic-Fit", amount: 24.99, date: demoDate(20), category: "Salud", type: "expense", originalDescription: "BASIC-FIT DEMO", source: "demo" },
    { name: "PlayStation", amount: 9.99, date: demoDate(22), category: "Ocio", type: "expense", originalDescription: "PLAYSTATION DEMO", source: "demo" },
    { name: "Bizum recibido", amount: 35, date: demoDate(24), category: "Bizum recibido", type: "income", originalDescription: "BIZUM RECIBIDO DEMO", source: "demo" }
  ].map((item) => ({
    ...item,
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
    importBatchId: demoBatchId,
    importBatchName: "Modo demo",
    importedAt: new Date().toISOString()
  }));
  return {
    months: { [selectedMonth]: { income: 1885, savings: 300 } },
    expenses: movements,
    recurring: [
      { id: crypto.randomUUID ? crypto.randomUUID() : `rec-${Date.now()}`, name: "Netflix", amount: 6.99, category: "Suscripciones", template: "Netflix", brand: "netflix", createdAt: new Date().toISOString() },
      { id: crypto.randomUUID ? crypto.randomUUID() : `rec-${Date.now()+1}`, name: "Gimnasio", amount: 24.99, category: "Salud", template: "Gimnasio", createdAt: new Date().toISOString() }
    ],
    rules: [
      { id: crypto.randomUUID ? crypto.randomUUID() : `rule-${Date.now()}`, keyword: "NETFLIX", name: "Netflix", category: "Suscripciones", type: "expense", createdAt: new Date().toISOString() },
      { id: crypto.randomUUID ? crypto.randomUUID() : `rule-${Date.now()+1}`, keyword: "REPSOL", name: "Repsol Waylet", category: "Transporte", type: "expense", createdAt: new Date().toISOString() }
    ],
    categoryBudgets: { Alimentación: 260, Ocio: 120, Suscripciones: 45, Transporte: 160 },
    goals: [
      { id: crypto.randomUUID ? crypto.randomUUID() : `goal-${Date.now()}`, name: "Vacaciones demo", target: 1200, current: 350, date: `${Number(selectedMonth.slice(0,4)) + 1}-08-01`, icon: "🏖️", createdAt: new Date().toISOString() },
      { id: crypto.randomUUID ? crypto.randomUUID() : `goal-${Date.now()+1}`, name: "Colchón de seguridad", target: 3000, current: 900, date: `${Number(selectedMonth.slice(0,4)) + 1}-12-31`, icon: "🛡️", createdAt: new Date().toISOString() }
    ],
    customCategories: [],
    categoryIcons: {},
    hiddenDefaultCategories: [],
    importHistory: [{ id: demoBatchId, name: "Modo demo", importedAt: new Date().toISOString(), count: movements.length, months: monthBreakdown(movements) }]
  };
}

function saveState() {
  ensureStateShape();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!suppressSyncMark) {
    markLocalChange();
  }
}

function markLocalChange() {
  localStorage.setItem(SYNC_LOCAL_UPDATED_KEY, new Date().toISOString());
  scheduleAutoWifiSync();
}

function localUpdatedAt() {
  return localStorage.getItem(SYNC_LOCAL_UPDATED_KEY) || SYNC_LOCAL_UPDATED_FALLBACK_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) || "";
}

function formatSyncDate(iso) {
  if (!iso) return "Nunca";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function autoSyncEnabled() {
  const raw = localStorage.getItem(SYNC_AUTO_KEY) || SYNC_AUTO_FALLBACK_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  return raw === "1";
}

function setAutoSyncEnabled(enabled) {
  localStorage.setItem(SYNC_AUTO_KEY, enabled ? "1" : "0");
}

function scheduleAutoWifiSync() {
  if (!autoSyncEnabled()) return;
  if (!window.location.protocol.startsWith("http")) return;
  clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => pushWifiSync({ silent: true, skipConfirm: true }), 1200);
}

function serializableState() {
  ensureStateShape();
  return JSON.parse(JSON.stringify(state));
}

function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY) || THEME_FALLBACK_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

function applyTheme(theme) {
  activeTheme = theme;
  document.body.dataset.theme = theme;
  const isDark = theme === "dark";
  $("themeToggleIcon").textContent = isDark ? "☀" : "☾";
  $("themeToggleText").textContent = isDark ? "Claro" : "Oscuro";
  $("themeToggleBtn").setAttribute("aria-label", isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  syncThemeMetaColor();
}

function syncThemeMetaColor() {
  const risk = document.body.dataset.risk || "safe";
  const palette = {
    light: { safe: "#f5f2ea", watch: "#efe4d3", danger: "#efdcd7" },
    dark: { safe: "#101715", watch: "#1b1713", danger: "#181314" }
  };
  document.querySelector('meta[name="theme-color"]').content = palette[activeTheme][risk];
}

function monthPlan(month = selectedMonth) {
  return state.months[month] || { income: 0, savings: 0 };
}

function monthExpenses(month = selectedMonth) {
  return state.expenses.filter((expense) => expense.date.startsWith(month));
}

function getCalendarInfo(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const totalDays = new Date(year, monthNumber, 0).getDate();
  if (month === currentMonth) {
    return { elapsed: now.getDate(), remaining: totalDays - now.getDate() + 1, totalDays };
  }
  if (month < currentMonth) return { elapsed: totalDays, remaining: 0, totalDays };
  return { elapsed: 0, remaining: totalDays, totalDays };
}

function formatMonthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1, 12, 0, 0);
  const text = longMonth.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}


function formatMonth(month) {
  return formatMonthLabel(month);
}

function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function renderMonthDialog() {
  $("monthDialogYear").textContent = String(monthDialogYear);
  $("monthDialogGrid").innerHTML = monthNamesShort.map((label, index) => {
    const value = `${monthDialogYear}-${String(index + 1).padStart(2, "0")}`;
    const isActive = value === selectedMonth;
    const isCurrent = value === currentMonth;
    return `<button type="button" class="month-chip${isActive ? " active" : ""}${isCurrent ? " current" : ""}" data-month-value="${value}" aria-pressed="${isActive}">${label}</button>`;
  }).join("");
}

function openMonthPicker() {
  monthDialogYear = Number(selectedMonth.split("-")[0]);
  renderMonthDialog();
  $("monthDialog").showModal();
}


function buildMonthStats(month) {
  const plan = monthPlan(month);
  const transactions = monthExpenses(month);
  const expenses = transactions.filter((item) => item.type !== "income");
  const incoming = transactions.filter((item) => item.type === "income");
  const incomingTotal = incoming.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = plan.income + incomingTotal;
  const variableSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const recurringSpent = state.recurring.reduce((sum, item) => sum + item.amount, 0);
  const spent = variableSpent + recurringSpent;
  const available = totalIncome - plan.savings - spent;
  const spendable = Math.max(0, totalIncome - plan.savings);
  const calendar = getCalendarInfo(month);
  const projectedVariableSpend = calendar.elapsed ? (variableSpent / Math.max(1, calendar.elapsed)) * calendar.totalDays : variableSpent;
  const projectedMonthlySpend = recurringSpent + projectedVariableSpend;
  const projectedSavings = Math.max(0, totalIncome - projectedMonthlySpend);
  const categorySums = categoryTotals(expenses, true);
  const recurringCategorySums = state.recurring.reduce((result, item) => {
    const category = item.category || "Otros";
    result[category] = (result[category] || 0) + item.amount;
    return result;
  }, {});
  Object.entries(recurringCategorySums).forEach(([category, amount]) => {
    categorySums[category] = (categorySums[category] || 0) + amount;
  });

  return { month, plan, transactions, expenses, incoming, incomingTotal, totalIncome, variableSpent, recurringSpent, spent, available, spendable, calendar, projectedMonthlySpend, projectedSavings, categorySums };
}

function categoryTotals(entries, expensesOnly = false) {
  return entries.reduce((result, item) => {
    if (expensesOnly && item.type === "income") return result;
    const category = item.category || "Otros";
    result[category] = (result[category] || 0) + item.amount;
    return result;
  }, {});
}

function diffText(current, previous) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return "igual que antes";
  return `${diff > 0 ? "+" : "−"}${money.format(Math.abs(diff))}`;
}

function diffClass(current, previous, invert = false) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return "neutral";
  const better = invert ? diff < 0 : diff > 0;
  return better ? "good" : "bad";
}

function renderSmartPanel(current) {
  const previousMonth = shiftMonth(selectedMonth, -1);
  const previous = buildMonthStats(previousMonth);
  const hasData = current.totalIncome || current.spent || previous.spent;

  if (!hasData) {
    $("smartScore").textContent = "—";
    $("smartSummary").textContent = "Importa movimientos o añade gastos para ver un análisis útil.";
    $("monthComparison").innerHTML = comparisonPlaceholder();
    $("smartAlerts").innerHTML = emptySmartState("Aún no hay señales. Cuando metas movimientos, te diré dónde se va el dinero.");
    $("topExpensesList").innerHTML = emptySmartState("Tus gastos más grandes aparecerán aquí.");
    $("categoryCompareList").innerHTML = emptySmartState("Aquí compararé categorías contra el mes anterior.");
    return;
  }

  const savingsGap = current.projectedSavings - current.plan.savings;
  const bestCategory = Object.entries(current.categorySums).sort((a, b) => b[1] - a[1])[0];
  const spendableRatio = current.spendable ? current.projectedMonthlySpend / current.spendable : 0;
  const score = current.available < 0 || spendableRatio > 1 ? "RIESGO" : spendableRatio > .82 ? "JUSTO" : "BIEN";
  $("smartScore").textContent = score;
  $("smartScore").className = `smart-score ${score === "BIEN" ? "good" : score === "JUSTO" ? "watch" : "bad"}`;

  if (current.totalIncome && savingsGap >= 0) {
    $("smartSummary").textContent = `A este ritmo llegarías al ahorro objetivo y te sobrarían ${money.format(savingsGap)} de margen.`;
  } else if (current.totalIncome) {
    $("smartSummary").textContent = `A este ritmo te faltarían ${money.format(Math.abs(savingsGap))} para tu ahorro objetivo.`;
  } else {
    $("smartSummary").textContent = "Todavía falta configurar ingresos para que la proyección sea completa.";
  }

  $("monthComparison").innerHTML = [
    comparisonCard("Gasto total", current.spent, previous.spent, true),
    comparisonCard("Ingresos", current.totalIncome, previous.totalIncome, false),
    comparisonCard("Ahorro previsto", current.projectedSavings, previous.projectedSavings, false),
    comparisonCard("Disponible", current.available, previous.available, false)
  ].join("");

  renderSmartAlerts(current, previous, bestCategory, savingsGap, spendableRatio);
  renderTopExpenses(current);
  renderCategoryComparison(current, previous);
}

function comparisonPlaceholder() {
  return ["Gasto total", "Ingresos", "Ahorro previsto", "Disponible"].map((title) => `
    <div class="comparison-card neutral">
      <span>${title}</span>
      <strong>—</strong>
      <small>Sin datos todavía</small>
    </div>
  `).join("");
}

function comparisonCard(title, current, previous, lowerIsBetter) {
  const klass = diffClass(current, previous, lowerIsBetter);
  return `
    <div class="comparison-card ${klass}">
      <span>${title}</span>
      <strong>${money.format(current)}</strong>
      <small>${previous ? `${diffText(current, previous)} vs mes anterior` : "Sin datos del mes anterior"}</small>
    </div>
  `;
}

function emptySmartState(text) {
  return `<p class="muted smart-empty">${escapeHtml(text)}</p>`;
}

function renderSmartAlerts(current, previous, bestCategory, savingsGap, spendableRatio) {
  const alerts = [];
  if (current.available < 0) {
    alerts.push({ tone: "bad", icon: "!", title: "Margen superado", text: `Te has pasado ${money.format(Math.abs(current.available))} del margen del mes.` });
  } else if (current.calendar.remaining > 0) {
    const dailyLimit = Math.max(0, current.available / current.calendar.remaining);
    alerts.push({ tone: dailyLimit < 10 ? "watch" : "good", icon: "€", title: "Ritmo diario", text: `Para mantener el objetivo, gasta máximo ${money.format(dailyLimit)} al día.` });
  }

  if (spendableRatio > 1) {
    alerts.push({ tone: "bad", icon: "↘", title: "Ahorro en riesgo", text: `La proyección supera tu presupuesto gastable en ${money.format(current.projectedMonthlySpend - current.spendable)}.` });
  } else if (spendableRatio > .82) {
    alerts.push({ tone: "watch", icon: "◐", title: "Vas algo justo", text: "Todavía llegas, pero no hay mucho margen para gastos grandes." });
  } else if (current.totalIncome) {
    alerts.push({ tone: "good", icon: "✓", title: "Buen ritmo", text: "La proyección actual respeta tu ahorro objetivo." });
  }

  if (bestCategory && current.spent && bestCategory[1] / current.spent >= .32) {
    alerts.push({ tone: "watch", icon: categoryIcon(bestCategory[0]), title: `${bestCategory[0]} destaca`, text: `Suma ${money.format(bestCategory[1])}, un ${Math.round(bestCategory[1] / current.spent * 100)}% del gasto.` });
  }

  const subscriptions = current.categorySums["Suscripciones"] || 0;
  if (subscriptions >= 50) {
    alerts.push({ tone: "watch", icon: "↻", title: "Suscripciones altas", text: `Tienes ${money.format(subscriptions)} al mes en suscripciones/recurrentes.` });
  }

  categoryBudgetAlerts(current).forEach((alert) => alerts.push(alert));

  if (previous.spent && current.spent < previous.spent) {
    alerts.push({ tone: "good", icon: "↓", title: "Mejor que el mes pasado", text: `Llevas ${money.format(previous.spent - current.spent)} menos de gasto total.` });
  }

  $("smartAlerts").innerHTML = alerts.slice(0, 4).map((alert) => `
    <div class="smart-alert ${alert.tone}">
      <span>${alert.icon}</span>
      <div><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.text)}</small></div>
    </div>
  `).join("") || emptySmartState("Sin avisos importantes. Todo tranquilo por ahora.");
}

function renderTopExpenses(current) {
  const recurringEntries = state.recurring.map((item) => ({
    id: `rec-${item.id}`,
    name: item.name,
    amount: item.amount,
    category: item.category || "Otros",
    type: "recurring"
  }));
  const top = [...current.expenses, ...recurringEntries]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  if (!top.length) {
    $("topExpensesList").innerHTML = emptySmartState("Tus gastos más grandes aparecerán aquí.");
    return;
  }

  const max = Math.max(...top.map((item) => item.amount), 1);
  $("topExpensesList").innerHTML = top.map((item, index) => `
    <div class="top-expense-row">
      <span class="top-expense-rank">${index + 1}</span>
      <div class="top-expense-main">
        <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type === "recurring" ? `${item.category} · recurrente` : item.category)}</small></div>
        <div class="top-expense-track"><span style="width:${Math.max(7, item.amount / max * 100)}%"></span></div>
      </div>
      <strong>${money.format(item.amount)}</strong>
    </div>
  `).join("");
}

function renderCategoryComparison(current, previous) {
  const names = [...new Set([...Object.keys(current.categorySums), ...Object.keys(previous.categorySums)])];
  const rows = names
    .map((name) => ({ name, current: current.categorySums[name] || 0, previous: previous.categorySums[name] || 0 }))
    .sort((a, b) => b.current - a.current)
    .slice(0, 6);

  if (!rows.length) {
    $("categoryCompareList").innerHTML = emptySmartState("Aquí compararé categorías contra el mes anterior.");
    return;
  }

  $("categoryCompareList").innerHTML = rows.map((row) => {
    const klass = diffClass(row.current, row.previous, false);
    const diff = row.current - row.previous;
    const label = !row.previous ? "nuevo este mes" : `${diff >= 0 ? "+" : "−"}${money.format(Math.abs(diff))}`;
    return `
      <div class="category-compare-row ${klass}">
        <span>${categoryIcon(row.name)}</span>
        <div><strong>${escapeHtml(row.name)}</strong><small>${label}</small></div>
        <b>${money.format(row.current)}</b>
      </div>
    `;
  }).join("");
}

function categoryBudgetValue(category) {
  state.categoryBudgets = state.categoryBudgets || {};
  return Number(state.categoryBudgets[category]) || 0;
}

function projectedCategorySpend(category, current) {
  const spent = current.categorySums[category] || 0;
  const recurringForCategory = state.recurring
    .filter((item) => (item.category || "Otros") === category)
    .reduce((sum, item) => sum + item.amount, 0);
  const variableSpent = Math.max(0, spent - recurringForCategory);
  if (!current.calendar.elapsed) return spent;
  return recurringForCategory + (variableSpent / Math.max(1, current.calendar.elapsed)) * current.calendar.totalDays;
}

function budgetStatus(ratio) {
  if (ratio >= 1) return "bad";
  if (ratio >= .85) return "watch";
  return "good";
}

function renderCategoryBudgets(current) {
  const configured = expenseCategories().filter((category) => categoryBudgetValue(category) > 0);
  if (!configured.length) {
    $("categoryBudgetList").innerHTML = `
      <div class="category-budget-empty">
        <span>◎</span>
        <div><strong>Aún no has puesto límites</strong><small>Ejemplo: Alimentación 250 €, Ocio 100 €, Suscripciones 50 €.</small></div>
      </div>
    `;
    return;
  }

  $("categoryBudgetList").innerHTML = configured.map((category) => {
    const limit = categoryBudgetValue(category);
    const spent = current.categorySums[category] || 0;
    const projected = projectedCategorySpend(category, current);
    const ratio = limit ? spent / limit : 0;
    const projectedRatio = limit ? projected / limit : 0;
    const tone = budgetStatus(Math.max(ratio, projectedRatio));
    const remaining = limit - spent;
    const projectedOver = projected - limit;
    const text = remaining >= 0
      ? `Quedan ${money.format(remaining)} · proyección ${money.format(projected)}`
      : `Pasado ${money.format(Math.abs(remaining))} · proyección ${money.format(projected)}`;
    return `
      <div class="category-budget-row ${tone}">
        <span class="category-budget-icon">${categoryIcon(category)}</span>
        <div class="category-budget-main">
          <div class="category-budget-head"><strong>${escapeHtml(category)}</strong><b>${money.format(spent)} / ${money.format(limit)}</b></div>
          <div class="category-budget-track"><span style="width:${Math.min(100, Math.max(4, ratio * 100))}%"></span></div>
          <small>${escapeHtml(text)}${projectedOver > 0 ? ` · riesgo +${money.format(projectedOver)}` : ""}</small>
        </div>
        <em>${Math.round(Math.max(ratio, projectedRatio) * 100)}%</em>
      </div>
    `;
  }).join("");
}

function openCategoryBudgetDialog() {
  state.categoryBudgets = state.categoryBudgets || {};
  $("categoryBudgetFormRows").innerHTML = expenseCategories().map((category) => `
    <label class="category-budget-input-row">
      <span><i>${categoryIcon(category)}</i>${escapeHtml(category)}</span>
      <div class="input-money"><input data-category-budget-input="${escapeHtml(category)}" type="number" min="0" step="0.01" placeholder="0" value="${categoryBudgetValue(category) || ""}"><span>€</span></div>
    </label>
  `).join("");
  $("categoryBudgetDialog").showModal();
}

function saveCategoryBudgetDialog() {
  const next = {};
  document.querySelectorAll("[data-category-budget-input]").forEach((input) => {
    const value = Number(input.value) || 0;
    if (value > 0) next[input.dataset.categoryBudgetInput] = value;
  });
  state.categoryBudgets = next;
  saveState();
  $("categoryBudgetDialog").close();
  render();
  toast("Presupuestos por categoría guardados", "success");
}

function categoryBudgetAlerts(current) {
  const configured = expenseCategories().filter((category) => categoryBudgetValue(category) > 0);
  return configured.map((category) => {
    const limit = categoryBudgetValue(category);
    const spent = current.categorySums[category] || 0;
    const projected = projectedCategorySpend(category, current);
    const ratio = Math.max(spent / limit, projected / limit);
    if (ratio < .85) return null;
    const tone = ratio >= 1 ? "bad" : "watch";
    const text = projected > limit
      ? `A este ritmo ${category} acabaría en ${money.format(projected)}, ${money.format(projected - limit)} por encima del límite.`
      : `${category} ya va por ${Math.round(spent / limit * 100)}% de su límite mensual.`;
    return { tone, icon: categoryIcon(category), title: `Límite de ${category}`, text };
  }).filter(Boolean);
}


function monthsUntil(deadline) {
  if (!deadline) return 0;
  const target = new Date(`${deadline}T12:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(1, months + (target.getDate() >= now.getDate() ? 1 : 0));
}

function goalTone(goal) {
  const target = Number(goal.target) || 0;
  const saved = Number(goal.saved) || 0;
  const ratio = target ? saved / target : 0;
  if (ratio >= 1) return "done";
  if (!goal.deadline) return "watch";
  const perMonth = (target - saved) / monthsUntil(goal.deadline);
  const plan = monthPlan();
  if (plan.savings && perMonth > plan.savings * 0.7) return "bad";
  return ratio >= 0.65 ? "good" : "watch";
}

function goalMonthlyNeed(goal) {
  const missing = Math.max(0, (Number(goal.target) || 0) - (Number(goal.saved) || 0));
  if (!goal.deadline) return 0;
  return missing / monthsUntil(goal.deadline);
}

function goalPriorityScore(goal) {
  const missing = Math.max(0, (Number(goal.target) || 0) - (Number(goal.saved) || 0));
  if (!missing) return 0;
  const monthlyNeed = goalMonthlyNeed(goal);
  if (monthlyNeed) return monthlyNeed;
  return missing / 12;
}

function suggestedGoalAllocations(goals, monthlyBudget) {
  const pending = goals
    .map((goal) => ({ goal, missing: Math.max(0, (Number(goal.target) || 0) - (Number(goal.saved) || 0)), weight: goalPriorityScore(goal) }))
    .filter((item) => item.missing > 0);
  if (!pending.length || monthlyBudget <= 0) return [];
  const totalWeight = pending.reduce((sum, item) => sum + item.weight, 0) || pending.length;
  return pending.map((item) => {
    const raw = totalWeight ? monthlyBudget * (item.weight / totalWeight) : monthlyBudget / pending.length;
    const amount = Math.min(item.missing, Math.max(0, Math.round(raw * 100) / 100));
    return { goal: item.goal, amount };
  }).filter((item) => item.amount > 0.01);
}

function renderGoalsActionPanel(goals, totalMissing, monthlyNeeded) {
  const panel = $("goalsActionPanel");
  if (!panel) return;
  const plan = monthPlan();
  const monthlyBudget = Math.max(0, Number(plan.savings) || 0);
  if (!goals.length) {
    panel.innerHTML = "";
    return;
  }
  const allocations = suggestedGoalAllocations(goals, monthlyBudget);
  const gap = monthlyBudget - monthlyNeeded;
  let tone = "good";
  let title = "Plan de ahorro encajado";
  let text = `Tu plan del mes reserva ${money.format(monthlyBudget)} para ahorro.`;
  if (!monthlyBudget) {
    tone = "watch";
    title = "Sin ahorro mensual configurado";
    text = "Edita el plan del mes para reservar una cantidad fija para tus objetivos.";
  } else if (monthlyNeeded > monthlyBudget) {
    tone = "bad";
    title = "Objetivos exigentes";
    text = `Para llegar a todas las fechas necesitarías ${money.format(monthlyNeeded)} al mes, ${money.format(Math.abs(gap))} más que tu ahorro objetivo.`;
  } else if (monthlyNeeded > 0) {
    title = "Vas bien con tus metas";
    text = `Necesitas aprox. ${money.format(monthlyNeeded)} al mes. Te quedarían ${money.format(gap)} de margen dentro del ahorro objetivo.`;
  }
  panel.innerHTML = `
    <div class="goals-plan-card ${tone}">
      <div>
        <p class="eyebrow">PLAN DE AHORRO</p>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
      </div>
      <div class="goals-plan-metrics">
        <span><b>${money.format(monthlyBudget)}</b><small>Ahorro objetivo</small></span>
        <span><b>${money.format(monthlyNeeded)}</b><small>Necesario/mes</small></span>
        <span><b>${money.format(totalMissing)}</b><small>Total pendiente</small></span>
      </div>
    </div>
    ${allocations.length ? `
      <div class="goal-allocation-box">
        <div class="goal-allocation-head"><strong>Reparto recomendado de este mes</strong><small>Botón rápido para sumar la aportación sugerida</small></div>
        <div class="goal-allocation-list">
          ${allocations.map(({ goal, amount }) => `
            <button class="goal-allocation-chip" type="button" data-goal-contribution="${goal.id}" data-goal-amount="${amount}">
              <span>${escapeHtml(goal.icon || "◎")} ${escapeHtml(goal.name)}</span><b>+${money.format(amount)}</b>
            </button>`).join("")}
        </div>
      </div>` : ""}
  `;
}

function renderGoals() {
  state.goals = state.goals || [];
  const goals = state.goals;
  const totalTarget = goals.reduce((sum, goal) => sum + (Number(goal.target) || 0), 0);
  const totalSaved = goals.reduce((sum, goal) => sum + (Number(goal.saved) || 0), 0);
  const totalMissing = Math.max(0, totalTarget - totalSaved);
  const monthlyNeeded = goals.reduce((sum, goal) => sum + goalMonthlyNeed(goal), 0);

  if (!goals.length) {
    $("goalsSummary").innerHTML = `
      <div class="goals-empty">
        <span>◎</span>
        <div><strong>Aún no tienes objetivos</strong><p>Crea una meta para ver cuánto falta, el progreso y la aportación mensual recomendada.</p></div>
      </div>`;
    if ($("goalsActionPanel")) $("goalsActionPanel").innerHTML = "";
    $("goalsList").innerHTML = "";
    return;
  }

  $("goalsSummary").innerHTML = `
    <div class="goal-summary-pill"><span>Total objetivo</span><strong>${money.format(totalTarget)}</strong></div>
    <div class="goal-summary-pill"><span>Ahorrado</span><strong>${money.format(totalSaved)}</strong></div>
    <div class="goal-summary-pill"><span>Falta</span><strong>${money.format(totalMissing)}</strong></div>
    <div class="goal-summary-pill"><span>Necesario/mes</span><strong>${money.format(monthlyNeeded)}</strong></div>
  `;

  renderGoalsActionPanel(goals, totalMissing, monthlyNeeded);

  $("goalsList").innerHTML = goals.map((goal) => {
    const target = Number(goal.target) || 0;
    const saved = Number(goal.saved) || 0;
    const missing = Math.max(0, target - saved);
    const ratio = target ? saved / target : 0;
    const percent = Math.min(100, Math.round(ratio * 100));
    const tone = goalTone(goal);
    const perMonth = goalMonthlyNeed(goal);
    const deadlineText = goal.deadline ? shortDate.format(new Date(`${goal.deadline}T12:00:00`)) : "Sin fecha";
    const advice = ratio >= 1
      ? "Objetivo completado. Puedes mantenerlo o crear otro."
      : goal.deadline
        ? `Para llegar, aparta aprox. ${money.format(perMonth)} al mes.`
        : `Faltan ${money.format(missing)}. Añade una fecha para calcular aportación mensual.`;
    return `
      <div class="goal-item ${tone}">
        <div class="goal-icon">${escapeHtml(goal.icon || "◎")}</div>
        <div class="goal-main">
          <div class="goal-head"><strong>${escapeHtml(goal.name)}</strong><b>${percent}%</b></div>
          <div class="goal-track"><span style="width:${Math.max(4, percent)}%"></span></div>
          <div class="goal-meta"><span>${money.format(saved)} / ${money.format(target)}</span><span>${deadlineText}</span></div>
          <p>${escapeHtml(advice)}</p>
          <div class="goal-quick-actions">
            <button type="button" data-goal-contribution="${goal.id}" data-goal-amount="10">+10 €</button>
            <button type="button" data-goal-contribution="${goal.id}" data-goal-amount="25">+25 €</button>
            <button type="button" data-goal-contribution="${goal.id}" data-goal-custom="${goal.id}">Otra cantidad</button>
          </div>
        </div>
        <div class="goal-actions">
          <button class="edit-mini-btn" type="button" data-edit-goal="${goal.id}" aria-label="Editar objetivo">✎</button>
          <button class="delete-btn" type="button" data-delete-goal="${goal.id}" aria-label="Eliminar objetivo">×</button>
        </div>
      </div>`;
  }).join("");
}

function openGoalDialog(goal = null) {
  $("goalForm").reset();
  $("goalId").value = goal?.id || "";
  $("goalDialogTitle").textContent = goal ? "Editar objetivo" : "Nuevo objetivo";
  $("goalName").value = goal?.name || "";
  $("goalTarget").value = goal?.target || "";
  $("goalSaved").value = goal?.saved || "";
  $("goalDeadline").value = goal?.deadline || "";
  $("goalIcon").value = goal?.icon || "";
  $("goalDialog").showModal();
}

function saveGoalFromDialog() {
  const id = $("goalId").value;
  const goal = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    name: $("goalName").value.trim(),
    target: Number($("goalTarget").value),
    saved: Number($("goalSaved").value) || 0,
    deadline: $("goalDeadline").value,
    icon: $("goalIcon").value.trim() || "◎",
    createdAt: id ? ((state.goals || []).find((item) => item.id === id)?.createdAt || Date.now()) : Date.now()
  };
  state.goals = state.goals || [];
  if (id) state.goals = state.goals.map((item) => item.id === id ? goal : item);
  else state.goals.push(goal);
  saveState();
  $("goalDialog").close();
  render();
  toast(id ? "Objetivo actualizado" : "Objetivo creado", "success");
}

function addGoalContribution(goalId, amount) {
  const numeric = Number(amount);
  if (!goalId || !Number.isFinite(numeric) || numeric <= 0) return;
  let updatedName = "objetivo";
  state.goals = (state.goals || []).map((goal) => {
    if (goal.id !== goalId) return goal;
    updatedName = goal.name;
    const target = Number(goal.target) || 0;
    const saved = Number(goal.saved) || 0;
    return { ...goal, saved: target ? Math.min(target, saved + numeric) : saved + numeric };
  });
  saveState();
  render();
  toast(`Aportación añadida a ${updatedName}`, "success");
}

function downloadGoalsPlan() {
  const goals = state.goals || [];
  if (!goals.length) {
    toast("No hay objetivos para exportar", "info");
    return;
  }
  const plan = monthPlan();
  const allocations = suggestedGoalAllocations(goals, Number(plan.savings) || 0);
  const allocationMap = new Map(allocations.map((item) => [item.goal.id, item.amount]));
  const rows = [["Objetivo", "Ahorrado", "Objetivo total", "Falta", "Fecha", "Necesario al mes", "Aportacion sugerida"]];
  goals.forEach((goal) => {
    const target = Number(goal.target) || 0;
    const saved = Number(goal.saved) || 0;
    rows.push([goal.name, saved, target, Math.max(0, target - saved), goal.deadline || "", goalMonthlyNeed(goal), allocationMap.get(goal.id) || 0]);
  });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nexo-objetivos-${selectedMonth}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Plan de objetivos descargado", "success");
}


function renderEmojiSuggestions() {
  document.querySelectorAll("[data-emoji-target]").forEach((box) => {
    const targetId = box.dataset.emojiTarget;
    box.innerHTML = categoryEmojiPresets.map((emoji) => `<button class="emoji-chip" type="button" data-emoji="${emoji}" data-target-input="${targetId}" aria-label="Usar ${emoji}">${emoji}</button>`).join("");
  });
}

function migrateCategoryName(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  state.expenses = state.expenses.map((item) => item.category === oldName ? { ...item, category: newName } : item);
  state.recurring = state.recurring.map((item) => item.category === oldName ? { ...item, category: newName } : item);
  state.rules = (state.rules || []).map((rule) => rule.category === oldName ? { ...rule, category: newName } : rule);
  if (state.categoryBudgets?.[oldName]) {
    state.categoryBudgets[newName] = state.categoryBudgets[oldName];
    delete state.categoryBudgets[oldName];
  }
  if (state.categoryIcons?.[oldName] && !state.categoryIcons[newName]) {
    state.categoryIcons[newName] = state.categoryIcons[oldName];
    delete state.categoryIcons[oldName];
  }
}

function openCategoryDialog(category = null) {
  ensureStateShape();
  $("categoryForm").reset();
  const name = category?.name || "";
  $("categoryDialogTitle").textContent = name ? `Editar ${name}` : "Nueva categoría";
  $("categoryEditOriginal").value = name;
  $("categoryEditBuiltIn").value = category?.builtIn ? "1" : "";
  $("categoryType").value = category?.type || "expense";
  $("categoryType").disabled = Boolean(name);
  $("categoryNameInput").value = name;
  $("categoryIconInput").value = category?.icon || (name ? categoryIcon(name) : "✨");
  $("categoryDialog").showModal();
}

function saveCategoryFromDialog() {
  ensureStateShape();
  const original = $("categoryEditOriginal").value.trim();
  const builtIn = $("categoryEditBuiltIn").value === "1";
  const type = $("categoryType").value;
  const name = $("categoryNameInput").value.trim();
  const icon = $("categoryIconInput").value.trim() || "✨";
  if (!name) return;

  const currentOptions = type === "income" ? incomeCategories() : expenseCategories();
  if (!original && currentOptions.some((item) => item.toLowerCase() === name.toLowerCase())) {
    toast("Esa categoría ya existe", "info");
    return;
  }

  if (original && original !== name) migrateCategoryName(original, name);
  state.categoryIcons[name] = icon;

  if (builtIn && original !== name) {
    state.hiddenDefaultCategories = uniqueValues([...(state.hiddenDefaultCategories || []), original]);
    state.customCategories.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, icon, type, originalDefault: builtIn ? original : "" });
  } else if (original) {
    state.customCategories = state.customCategories.map((category) => category.name === original ? { ...category, name, icon, type } : category);
  } else if (!defaultExpenseCategories.includes(name) && !defaultIncomeCategories.includes(name)) {
    state.customCategories.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, icon, type });
  }

  saveState();
  $("categoryType").disabled = false;
  $("categoryDialog").close();
  fillRuleCategoryOptions($("ruleCategory")?.value || "");
  render();
  toast(original ? "Categoría actualizada" : "Categoría creada", "success");
}

async function deleteCustomCategory(name) {
  ensureStateShape();
  const current = state.customCategories.find((category) => category.name === name);
  const fallback = current?.originalDefault || "Otros";
  const ok = await confirmAction({ title: "Eliminar categoría", text: `Los movimientos de “${name}” pasarán a “${fallback}”.`, confirmLabel: "Eliminar" });
  if (!ok) return;
  if (current?.originalDefault) {
    state.hiddenDefaultCategories = state.hiddenDefaultCategories.filter((item) => item !== current.originalDefault);
  }
  migrateCategoryName(name, fallback);
  state.customCategories = state.customCategories.filter((category) => category.name !== name);
  delete state.categoryIcons[name];
  saveState();
  render();
  toast("Categoría eliminada", "danger");
}

function renderCustomCategories() {
  ensureStateShape();
  const builtIns = [
    ...defaultExpenseCategories.filter((name) => !state.hiddenDefaultCategories.includes(name)).map((name) => ({ name, type: "expense", builtIn: true, icon: categoryIcon(name) })),
    ...defaultIncomeCategories.filter((name) => !state.hiddenDefaultCategories.includes(name)).map((name) => ({ name, type: "income", builtIn: true, icon: categoryIcon(name) }))
  ];
  const customs = state.customCategories.map((category) => ({ ...category, builtIn: false, icon: categoryIcon(category.name) }));
  const all = [...builtIns, ...customs];
  $("customCategoryList").innerHTML = all.map((category) => `
    <div class="custom-category-item">
      <span class="custom-category-icon">${escapeHtml(category.icon)}</span>
      <div>
        <strong>${escapeHtml(category.name)}</strong>
        <small>${category.type === "income" ? "Ingreso" : "Gasto"}${category.builtIn ? " · base" : " · personalizada"}</small>
      </div>
      <div class="custom-category-actions">
        <button class="edit-mini-btn" type="button" data-edit-category="${escapeHtml(category.name)}" data-category-type="${category.type}" data-category-built-in="${category.builtIn ? "1" : ""}" aria-label="Editar categoría">✎</button>
        ${category.builtIn ? "" : `<button class="delete-btn" type="button" data-delete-category="${escapeHtml(category.name)}" aria-label="Eliminar categoría">×</button>`}
      </div>
    </div>
  `).join("");
}


function reportRow(label, value, detail = "", tone = "neutral") {
  return `
    <div class="monthly-report-row ${tone}">
      <div><strong>${escapeHtml(label)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</div>
      <b>${escapeHtml(value)}</b>
    </div>
  `;
}

function renderMonthlyReport(current) {
  const hero = $("monthlyReportHero");
  if (!hero) return;
  const previous = buildMonthStats(shiftMonth(selectedMonth, -1));
  const monthTitle = formatMonthLabel(selectedMonth);
  const savingsReal = current.totalIncome - current.spent;
  const savingsAfterTarget = current.available;
  const avgDaily = current.calendar.elapsed ? current.variableSpent / Math.max(1, current.calendar.elapsed) : 0;
  const expenseCount = current.expenses.length;
  const incomeCount = current.incoming.length;
  const topCategory = Object.entries(current.categorySums).sort((a, b) => b[1] - a[1])[0];
  const biggestExpense = current.expenses.slice().sort((a, b) => b.amount - a.amount)[0];
  const subscriptions = current.categorySums["Suscripciones"] || 0;
  const recurrent = current.recurringSpent || 0;
  const previousDiff = current.spent - previous.spent;
  const projectedDiff = current.projectedMonthlySpend - current.spent;

  hero.innerHTML = `
    <div>
      <span>${escapeHtml(monthTitle)}</span>
      <strong>${money.format(savingsReal)}</strong>
      <small>Ahorro real del mes: ingresos menos gastos. Margen tras objetivo: ${money.format(savingsAfterTarget)}.</small>
    </div>
    <div class="monthly-report-pill ${savingsAfterTarget >= 0 ? "good" : "bad"}">${savingsAfterTarget >= 0 ? "Objetivo protegido" : "Objetivo en riesgo"}</div>
  `;

  $("monthlyReportStats").innerHTML = [
    { label: "Ingresos", value: current.totalIncome, detail: `${incomeCount} movimientos de ingreso` },
    { label: "Gastos", value: current.spent, detail: `${expenseCount} gastos + recurrentes` },
    { label: "Ahorro objetivo", value: current.plan.savings, detail: "Apartado en el plan" },
    { label: "Proyección fin de mes", value: current.projectedMonthlySpend, detail: `${money.format(avgDaily)} al día de media` }
  ].map((item) => `
    <div class="monthly-report-stat">
      <span>${escapeHtml(item.label)}</span>
      <strong>${money.format(item.value)}</strong>
      <small>${escapeHtml(item.detail)}</small>
    </div>
  `).join("");

  const categories = Object.entries(current.categorySums).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const categoryMax = Math.max(1, ...categories.map(([, value]) => value));
  $("monthlyReportCategories").innerHTML = categories.length ? categories.map(([name, value]) => `
    <div class="report-category-line">
      <div><span>${categoryIcon(name)}</span><strong>${escapeHtml(name)}</strong><b>${money.format(value)}</b></div>
      <em><i style="width:${Math.max(4, value / categoryMax * 100)}%"></i></em>
    </div>
  `).join("") : emptySmartState("Aún no hay gastos para analizar.");

  const top = current.expenses.slice().sort((a, b) => b.amount - a.amount).slice(0, 8);
  $("monthlyReportTop").innerHTML = top.length ? top.map((item) => reportRow(item.name, money.format(item.amount), `${item.category} · ${shortDate.format(new Date(`${item.date}T12:00:00`))}`)).join("") : emptySmartState("No hay gastos todavía.");

  const comparisonRows = [
    ["Gasto total", current.spent, previous.spent, true],
    ["Ingresos", current.totalIncome, previous.totalIncome, false],
    ["Ahorro real", savingsReal, previous.totalIncome - previous.spent, false],
    ["Suscripciones", subscriptions, previous.categorySums["Suscripciones"] || 0, true],
    ["Recurrentes", recurrent, previous.recurringSpent || 0, true]
  ];
  $("monthlyReportComparison").innerHTML = comparisonRows.map(([label, currentValue, previousValue, lowerIsBetter]) => {
    const klass = diffClass(currentValue, previousValue, lowerIsBetter);
    const detail = previousValue ? `${diffText(currentValue, previousValue)} vs ${formatMonthLabel(previous.month)}` : "Sin datos del mes anterior";
    return reportRow(label, money.format(currentValue), detail, klass);
  }).join("");

  const alerts = [];
  if (topCategory) alerts.push(`${topCategory[0]} es la categoría que más pesa: ${money.format(topCategory[1])}.`);
  if (biggestExpense) alerts.push(`Mayor gasto: ${biggestExpense.name} por ${money.format(biggestExpense.amount)}.`);
  if (current.available < 0) alerts.push(`Te has pasado ${money.format(Math.abs(current.available))} del margen después del ahorro objetivo.`);
  else alerts.push(`Te quedan ${money.format(current.available)} de margen después del ahorro objetivo.`);
  if (projectedDiff > 10 && selectedMonth === currentMonth) alerts.push(`A este ritmo todavía sumarías ${money.format(projectedDiff)} más en gastos este mes.`);
  if (subscriptions > 0) alerts.push(`Suscripciones/recurrentes detectadas: ${money.format(subscriptions)} en el mes.`);
  if (previous.spent) alerts.push(previousDiff > 0 ? `Has gastado ${money.format(previousDiff)} más que el mes anterior.` : `Has gastado ${money.format(Math.abs(previousDiff))} menos que el mes anterior.`);

  $("monthlyReportAlerts").innerHTML = alerts.slice(0, 6).map((text, index) => `
    <div class="report-alert-line"><span>${index + 1}</span><p>${escapeHtml(text)}</p></div>
  `).join("");
}

function downloadMonthlyReport() {
  const current = buildMonthStats(selectedMonth);
  const previous = buildMonthStats(shiftMonth(selectedMonth, -1));
  const rows = [];
  rows.push(["Informe", formatMonthLabel(selectedMonth)]);
  rows.push(["Ingresos", current.totalIncome]);
  rows.push(["Gastos", current.spent]);
  rows.push(["Ahorro real", current.totalIncome - current.spent]);
  rows.push(["Ahorro objetivo", current.plan.savings]);
  rows.push(["Disponible tras objetivo", current.available]);
  rows.push(["Gasto previsto fin de mes", current.projectedMonthlySpend]);
  rows.push(["Gasto mes anterior", previous.spent]);
  rows.push([]);
  rows.push(["Categoria", "Importe"]);
  Object.entries(current.categorySums).sort((a,b)=>b[1]-a[1]).forEach(([category, amount]) => rows.push([category, amount]));
  rows.push([]);
  rows.push(["Fecha", "Nombre", "Categoria", "Importe", "Original"]);
  current.transactions.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((item) => rows.push([item.date, item.name, item.category, item.type === "income" ? item.amount : -item.amount, item.raw || item.original || ""]));
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nexo-informe-${selectedMonth}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Informe descargado", "success");
}

function render() {
  $("monthPicker").value = selectedMonth;
  $("monthLabel").textContent = formatMonthLabel(selectedMonth);

  const plan = monthPlan();
  const transactions = monthExpenses().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const expenses = transactions.filter((item) => item.type !== "income");
  const incoming = transactions.filter((item) => item.type === "income");
  const incomingTotal = incoming.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = plan.income + incomingTotal;
  const variableSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const recurringSpent = state.recurring.reduce((sum, item) => sum + item.amount, 0);
  const spent = variableSpent + recurringSpent;
  const available = totalIncome - plan.savings - spent;
  const calendar = getCalendarInfo(selectedMonth);
  const daily = calendar.remaining ? Math.max(0, available / calendar.remaining) : 0;
  const weekly = daily * Math.min(7, calendar.remaining);
  const spentPercent = totalIncome ? Math.min(100, spent / totalIncome * 100) : 0;
  const savedPercent = totalIncome ? Math.min(100 - spentPercent, plan.savings / totalIncome * 100) : 0;
  const projectedVariableSpend = calendar.elapsed ? (variableSpent / Math.max(1, calendar.elapsed)) * calendar.totalDays : variableSpent;
  const projectedMonthlySpend = recurringSpent + projectedVariableSpend;
  const projectedSavings = Math.max(0, totalIncome - projectedMonthlySpend);
  const spendable = Math.max(0, totalIncome - plan.savings);
  const budgetRatio = spendable ? spent / spendable : 0;
  const projectedRatio = spendable ? projectedMonthlySpend / spendable : 0;
  const riskRatio = Math.max(budgetRatio, projectedRatio);

  $("mainBalance").textContent = money.format(available);
  $("incomeValue").textContent = money.format(totalIncome);
  $("expensesValue").textContent = money.format(spent);
  $("savingsValue").textContent = money.format(plan.savings);
  $("dailyBudget").textContent = money.format(daily);
  $("weeklyBudget").textContent = money.format(weekly);
  $("daysLeft").textContent = calendar.remaining;
  $("projectedSavings").textContent = money.format(projectedSavings);
  $("spentBar").style.width = `${spentPercent}%`;
  $("savedBar").style.width = `${savedPercent}%`;

  if (!totalIncome) {
    $("balanceMessage").textContent = "Configura tus ingresos y tu ahorro para empezar.";
  } else if (available >= 0) {
    $("balanceMessage").textContent = `Después de apartar ${money.format(plan.savings)}, esto es lo que aún puedes gastar.`;
  } else {
    $("balanceMessage").textContent = `Has superado tu margen en ${money.format(Math.abs(available))}. Toca ajustar un poco.`;
  }

  const expectedVariableSpend = Math.max(0, totalIncome - plan.savings - recurringSpent);
  const expectedByToday = calendar.totalDays ? (expectedVariableSpend * calendar.elapsed) / calendar.totalDays : 0;
  const ahead = expectedByToday - variableSpent;

  if (!totalIncome || (!expenses.length && !state.recurring.length)) {
    setPace("✓", "Todo bajo control", "Añade tu primer gasto y aquí te diré si vas por buen camino.");
  } else if (available < 0) {
    setPace("!", "Hora de frenar", "Has agotado el margen de este mes. Revisa tus últimos gastos.");
  } else if (ahead >= 0) {
    setPace("✓", "Vas por buen camino", `Llevas ${money.format(ahead)} menos gastado de lo previsto a estas alturas.`);
  } else {
    setPace("↘", "Un poco por encima", `Llevas ${money.format(Math.abs(ahead))} más gastado de lo previsto. Aún puedes corregirlo.`);
  }

  syncMovementFilterOptions(transactions);
  renderImportReviewSummary();
  const visibleTransactions = filterTransactions(transactions);
  renderBulkToolbar(visibleTransactions);
  renderTransactions(visibleTransactions);
  renderCategories([
    ...expenses,
    ...state.recurring.map((item) => ({ ...item, category: item.category || "Otros" }))
  ], spent);
  renderRecurring();
  renderRules();
  renderAnalytics(expenses, { spendable, spent, projectedMonthlySpend, budgetRatio, projectedRatio, income: totalIncome });
  const currentStats = {
    month: selectedMonth,
    plan,
    transactions,
    expenses,
    incoming,
    incomingTotal,
    totalIncome,
    variableSpent,
    recurringSpent,
    spent,
    available,
    spendable,
    calendar,
    projectedMonthlySpend,
    projectedSavings,
    categorySums: categoryTotals([
      ...expenses,
      ...state.recurring.map((item) => ({ ...item, category: item.category || "Otros", type: "expense" }))
    ], true)
  };
  renderMonthlyReport(currentStats);
  renderSmartPanel(currentStats);
  renderCategoryBudgets(currentStats);
  renderGoals();
  renderCustomCategories();
  renderBankScreen();
  applyRiskTheme(totalIncome ? riskRatio : 0, available);
}

function setPace(icon, title, text) {
  $("paceIcon").textContent = icon;
  $("paceTitle").textContent = title;
  $("paceText").textContent = text;
}


function latestImportBatch() {
  ensureStateShape();
  return (state.importHistory || []).slice().sort((a, b) => String(b.importedAt || "").localeCompare(String(a.importedAt || "")))[0] || null;
}

function monthEntriesAll() {
  return state.expenses.filter((item) => String(item.date || "").startsWith(selectedMonth));
}

function renderBulkToolbar(entries) {
  const bar = $("bulkToolbar");
  if (!bar) return;
  const selected = [...selectedMovementIds].filter((id) => entries.some((item) => item.id === id));
  selectedMovementIds.clear();
  selected.forEach((id) => selectedMovementIds.add(id));
  bar.hidden = entries.length === 0;
  const categories = uniqueValues([...expenseCategories(), ...incomeCategories()]);
  const selectedCount = selected.length;
  const visibleCount = entries.length;

  if (!selectedCount) {
    bar.classList.remove("bulk-toolbar-active");
    bar.innerHTML = `
      <button id="selectVisibleMovementsBtn" class="secondary-btn compact-filter-btn" type="button">Seleccionar visibles (${visibleCount})</button>
      <span class="bulk-help">Usa filtros primero y luego selecciona solo esos movimientos para cambiarlos en lote.</span>`;
    return;
  }

  bar.classList.add("bulk-toolbar-active");
  bar.innerHTML = `
    <strong>${selectedCount} seleccionados</strong>
    <button id="selectVisibleMovementsBtn" class="secondary-btn compact-filter-btn" type="button">Seleccionar visibles (${visibleCount})</button>
    <button id="clearBulkSelectionBtn" class="secondary-btn compact-filter-btn danger-mini" type="button">Limpiar selección</button>
    <select id="bulkCategorySelect">
      <option value="">Cambiar categoría...</option>
      ${categories.map((category) => `<option>${escapeHtml(category)}</option>`).join("")}
    </select>
    <label class="bulk-learn-rule"><input id="bulkLearnRulesCheck" type="checkbox"> Aprender reglas</label>
    <button id="applyBulkCategoryBtn" class="primary-btn compact-filter-btn" type="button">Aplicar categoría</button>`;
}

function deleteImportBatch(batchId) {
  if (!batchId) return 0;
  const before = state.expenses.length;
  state.expenses = state.expenses.filter((item) => item.importBatchId !== batchId);
  state.importHistory = (state.importHistory || []).filter((batch) => batch.id !== batchId);
  selectedMovementIds.clear();
  if (movementFilters.importBatchId === batchId) movementFilters.importBatchId = "all";
  if (lastImportSummary?.batchId === batchId) lastImportSummary = null;
  return before - state.expenses.length;
}

function renderTransactions(entries) {
  const hasFilters = movementFilters.search || movementFilters.type !== "all" || movementFilters.category !== "all" || movementFilters.importBatchId !== "all";
  $("emptyState").hidden = entries.length > 0;
  $("transactionList").hidden = entries.length === 0;
  if (!entries.length && hasFilters) {
    $("emptyState").innerHTML = `<div class="empty-icon">⌕</div><h3>No hay resultados</h3><p>Prueba a quitar filtros o buscar otro texto.</p>`;
  } else if (!entries.length) {
    $("emptyState").innerHTML = `<div class="empty-icon">↘</div><h3>Aún no hay movimientos</h3><p>Añade un gasto, una devolución o un ingreso para ver tu margen real.</p>`;
  }
  $("transactionList").innerHTML = entries.map((expense) => {
    const original = expense.raw?.description || expense.originalDescription || "";
    const showOriginal = original && normalizeHeader(original) !== normalizeHeader(expense.name);
    return `
    <div class="transaction ${expense.type === "income" ? "income" : "expense"}">
      <label class="transaction-check" title="Seleccionar movimiento"><input type="checkbox" data-select-transaction="${expense.id}" ${selectedMovementIds.has(expense.id) ? "checked" : ""}></label>
      <span class="transaction-icon">${categoryIcon(expense.category)}</span>
      <button class="transaction-title" type="button" data-edit-transaction="${expense.id}" aria-label="Editar ${escapeHtml(expense.name)}">
        <strong>${escapeHtml(expense.name)}</strong>
        <span>${escapeHtml(expense.category)} · ${shortDate.format(new Date(`${expense.date}T12:00:00`))}</span>
        ${showOriginal ? `<small title="${escapeHtml(original)}">${escapeHtml(original)}</small>` : ""}
      </button>
      <span class="transaction-amount">${expense.type === "income" ? "+" : "−"}${money.format(expense.amount)}</span>
      <button class="edit-mini-btn" type="button" data-edit-transaction="${expense.id}" aria-label="Editar ${escapeHtml(expense.name)}">✎</button>
      <button class="delete-btn" type="button" data-delete="${expense.id}" aria-label="Eliminar ${escapeHtml(expense.name)}">×</button>
    </div>`;
  }).join("");
}

function filterTransactions(entries) {
  const query = normalizeHeader(movementFilters.search);
  return entries.filter((item) => {
    if (movementFilters.type !== "all" && item.type !== movementFilters.type) return false;
    if (movementFilters.category !== "all" && item.category !== movementFilters.category) return false;
    if (movementFilters.importBatchId !== "all" && item.importBatchId !== movementFilters.importBatchId) return false;
    if (!query) return true;
    const haystack = normalizeHeader(`${item.name || ""} ${item.category || ""} ${item.raw?.description || ""} ${item.originalDescription || ""}`);
    return haystack.includes(query);
  });
}

function syncMovementFilterOptions(entries) {
  const select = $("movementCategoryFilter");
  if (!select) return;
  const current = movementFilters.category;
  const categories = uniqueValues(entries.map((item) => item.category)).sort((a, b) => a.localeCompare(b, "es"));
  select.innerHTML = `<option value="all">Todas</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
  movementFilters.category = current === "all" || categories.includes(current) ? current : "all";
  select.value = movementFilters.category;
  const search = $("movementSearchInput");
  const type = $("movementTypeFilter");
  if (search && search.value !== movementFilters.search) search.value = movementFilters.search;
  if (type) type.value = movementFilters.type;
  const lastBtn = $("lastImportFilterBtn");
  const last = latestImportBatch();
  if (lastBtn) {
    lastBtn.hidden = !last;
    lastBtn.textContent = movementFilters.importBatchId !== "all" ? "Viendo última importación" : "Ver última importación";
    lastBtn.classList.toggle("active-filter", movementFilters.importBatchId !== "all");
  }
}

function renderImportReviewSummary() {
  const box = $("importReviewSummary");
  if (!box) return;
  if (!lastImportSummary) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const categoryText = Object.entries(lastImportSummary.categories || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => `${category}: ${count}`)
    .join(" · ");
  box.hidden = false;
  box.innerHTML = `<strong>${lastImportSummary.count} movimientos importados</strong><span>${escapeHtml(lastImportSummary.months || "")}</span>${categoryText ? `<small>${escapeHtml(categoryText)}</small>` : ""}<div class="import-summary-actions"><button id="viewLastImportBtn" class="secondary-btn compact-filter-btn" type="button">Ver solo esta importación</button><button id="deleteLastImportBtn" class="secondary-btn compact-filter-btn danger-mini" type="button">Borrar importación</button></div><button id="dismissImportSummaryBtn" type="button" aria-label="Ocultar resumen">×</button>`;
}

function buildImportSummary(items) {
  const categories = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  const batchId = items.find((item) => item.importBatchId)?.importBatchId || "";
  return { count: items.length, months: monthBreakdown(items), categories, batchId };
}

function renderRules() {
  const rules = state.rules || [];
  $("rulesEmpty").hidden = rules.length > 0;
  $("rulesList").hidden = rules.length === 0;
  $("rulesList").innerHTML = rules.map((rule) => `
    <div class="rule-item">
      <span class="rule-icon">${categoryIcon(rule.category)}</span>
      <div>
        <strong>Si contiene “${escapeHtml(rule.keyword)}”</strong>
        <small>${rule.type === "income" ? "Ingreso" : "Gasto"} · ${rule.name ? `${escapeHtml(rule.name)} · ` : ""}${escapeHtml(rule.category)}</small>
      </div>
      <button class="delete-btn" type="button" data-delete-rule="${rule.id}" aria-label="Eliminar regla">×</button>
    </div>
  `).join("");
}

function renderCategories(entries, total) {
  if (!entries.length || !total) {
    $("categoryList").innerHTML = '<p class="muted">Tus categorías aparecerán aquí.</p>';
    return;
  }
  const sums = entries.reduce((result, expense) => {
    result[expense.category] = (result[expense.category] || 0) + expense.amount;
    return result;
  }, {});

  $("categoryList").innerHTML = Object.entries(sums)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => `
      <div class="category-row">
        <div class="category-meta"><span>${categoryIcon(name)} &nbsp;${escapeHtml(name)}</span><span>${money.format(value)}</span></div>
        <div class="category-track"><div class="category-fill" style="width:${Math.min(100, (value / total) * 100)}%"></div></div>
      </div>
    `).join("");
}

function renderRecurring() {
  const total = state.recurring.reduce((sum, item) => sum + item.amount, 0);
  $("recurringTotal").textContent = money.format(total);
  $("recurringEmpty").hidden = state.recurring.length > 0;
  $("recurringList").hidden = state.recurring.length === 0;
  $("recurringList").innerHTML = state.recurring.map((item) => `
    <div class="recurring-item">
      <span class="recurring-item-icon">${visualForRecurring(item)}</span>
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${money.format(item.amount)} / mes</small>
      </div>
      <div class="recurring-menu">
        <button class="recurring-action" type="button" data-edit-recurring="${item.id}" aria-label="Editar ${escapeHtml(item.name)}">✎</button>
        <button class="recurring-action" type="button" data-delete-recurring="${item.id}" aria-label="Eliminar ${escapeHtml(item.name)}">×</button>
      </div>
    </div>
  `).join("");
}

function visualForRecurring(item) {
  const inferredBrand = item.brand || Object.keys(brandAssets).find((brand) =>
    item.template?.toLowerCase().startsWith(brand === "prime" ? "prime" : brand)
  );
  if (inferredBrand) {
    return `<span class="brand-logo ${brandClasses[inferredBrand]}"><img src="assets/brands/${brandAssets[inferredBrand]}" alt=""></span>`;
  }
  const icon = templateIcons[item.template];
  return icon ? iconSvg(icon) : recurringIcons[item.template] || categoryIcon(item.category);
}

function iconSvg(name) {
  const paths = {
    house: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/>',
    car: '<path d="m5 16-1.5-1.5L5.5 9h13l2 5.5L19 16"/><path d="M3.5 14.5h17v4h-17zM7 18.5v1.5m10-1.5v1.5M7 12h.01M17 12h.01"/>',
    water: '<path d="M12 3S6.5 9.2 6.5 14a5.5 5.5 0 0 0 11 0C17.5 9.2 12 3 12 3Z"/><path d="M9.2 15.5c.6 1.2 1.5 1.8 2.8 1.9"/>',
    bolt: '<path d="m13.5 2-8 12h6l-1 8 8-12h-6l1-8Z"/>',
    flame: '<path d="M13 2c1 5-3 6-1 10 1-2 3-3 4-5 2 2.2 3 4.2 3 6.5a7 7 0 0 1-14 0C5 9 9 6 13 2Z"/><path d="M12 13c2 2 2 4 0 6-2-2-2-4 0-6Z"/>',
    parking: '<circle cx="12" cy="12" r="9"/><path d="M10 17V7h3a3 3 0 0 1 0 6h-3"/>',
    wifi: '<path d="M3 9a14 14 0 0 1 18 0M6.5 12.5a9 9 0 0 1 11 0M10 16a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r=".7" fill="currentColor"/>',
    shield: '<path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    gym: '<path d="M3 10v4m3-7v10m12-10v10m3-7v4M6 12h12"/>',
    building: '<path d="M5 21V4h14v17M9 8h2m2 0h2m-6 4h2m2 0h2m-6 4h2m2 0h2M3 21h18"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8m-4-4h8"/>',
    play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.plus}</svg>`;
}

function renderAnalytics(expenses, metrics) {
  const calendar = getCalendarInfo(selectedMonth);
  const [, monthNumber] = selectedMonth.split("-").map(Number);
  const endDay = selectedMonth === currentMonth ? now.getDate() : calendar.totalDays;
  const startDay = Math.max(1, endDay - 6);
  const days = [];

  for (let day = startDay; day <= endDay; day += 1) {
    const dateKey = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    days.push({
      day,
      value: expenses.filter((item) => item.date === dateKey).reduce((sum, item) => sum + item.amount, 0)
    });
  }
  while (days.length < 7) days.unshift({ day: "", value: 0 });

  const max = Math.max(1, ...days.map((item) => item.value));
  const average = days.reduce((sum, item) => sum + item.value, 0) / 7;

  $("spendingChart").innerHTML = `
    <svg viewBox="0 0 700 190" preserveAspectRatio="none" role="img" aria-label="Gasto de los últimos siete días">
      <line class="chart-grid-line" x1="20" y1="35" x2="685" y2="35"/>
      <line class="chart-grid-line" x1="20" y1="90" x2="685" y2="90"/>
      <line class="chart-grid-line" x1="20" y1="145" x2="685" y2="145"/>
      ${days.map((item, index) => {
        const height = Math.max(item.value ? 8 : 2, (item.value / max) * 112);
        const x = 38 + index * 94;
        const isToday = selectedMonth === currentMonth && item.day === now.getDate();
        return `<rect class="chart-bar${isToday ? " today" : ""}" x="${x}" y="${148 - height}" width="50" height="${height}" rx="7"/>
          ${item.value ? `<text class="chart-value" x="${x + 25}" y="${135 - height}">${compactMoney(item.value)}</text>` : ""}
          <text class="chart-label" x="${x + 25}" y="174">${item.day ? `${item.day}/${monthNumber}` : ""}</text>`;
      }).join("")}
    </svg>
  `;

  $("chartAverage").textContent = `Media: ${money.format(average)} / día`;

  const displayPercent = metrics.spendable ? Math.round(metrics.budgetRatio * 100) : 0;
  const ringPercent = Math.min(100, Math.max(0, displayPercent));
  $("budgetPercent").textContent = `${displayPercent}%`;
  $("ringProgress").style.strokeDashoffset = String(308 - (308 * ringPercent) / 100);
  $("forecastSpend").textContent = money.format(metrics.projectedMonthlySpend);

  if (!metrics.income) {
    $("forecastMessage").textContent = "Configura tu plan para ver una proyección.";
  } else if (metrics.projectedRatio <= 0.75) {
    $("forecastMessage").textContent = "Vas con aire. Manteniendo este ritmo llegarás bien a tu objetivo.";
  } else if (metrics.projectedRatio <= 1) {
    $("forecastMessage").textContent = "Vas algo justo. Vigila los próximos gastos para proteger tu ahorro.";
  } else {
    $("forecastMessage").textContent = `A este ritmo superarías tu presupuesto en ${money.format(metrics.projectedMonthlySpend - metrics.spendable)}.`;
  }
}

function compactMoney(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")}k €`;
  return `${Math.round(value)} €`;
}

function applyRiskTheme(ratio, available) {
  let risk = "safe";
  if (ratio >= 1 || available < 0) risk = "danger";
  else if (ratio >= 0.78) risk = "watch";

  document.body.dataset.risk = risk;
  $("riskSignal").hidden = risk === "safe";
  if (risk === "watch") {
    $("riskSignalTitle").textContent = "Terreno delicado";
    $("riskSignalText").textContent = "Tu proyección se acerca al límite. Conviene bajar un poco el ritmo.";
  } else if (risk === "danger") {
    $("riskSignalTitle").textContent = "Presupuesto en riesgo";
    $("riskSignalText").textContent = available < 0
      ? `Has superado tu margen en ${money.format(Math.abs(available))}.`
      : "A este ritmo podrías terminar el mes por encima de tu margen.";
  }
  syncThemeMetaColor();
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function openPlan() {
  const plan = monthPlan();
  $("incomeInput").value = plan.income || "";
  $("savingsInput").value = plan.savings || "";
  updatePlanPreview();
  $("planDialog").showModal();
}

function updatePlanPreview() {
  const income = Number($("incomeInput").value) || 0;
  const savings = Number($("savingsInput").value) || 0;
  const recurring = state.recurring.reduce((sum, item) => sum + item.amount, 0);
  $("planPreview").textContent = `Te quedarían ${money.format(income - savings - recurring)} después del ahorro y tus gastos recurrentes.`;
}

function toast(message, type = "success") {
  const node = $("toast");
  node.textContent = message;
  node.className = `toast toast-${type} show`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    node.classList.remove("show");
    node.classList.remove("toast-success", "toast-danger", "toast-info");
  }, 2600);
}

function confirmAction({ title = "¿Seguro?", text = "Esta acción no se puede deshacer.", confirmLabel = "Confirmar", tone = "danger" } = {}) {
  return new Promise((resolve) => {
    const dialog = $("confirmDialog");
    const titleNode = $("confirmTitle");
    const textNode = $("confirmText");
    const cancelBtn = $("confirmCancelBtn");
    const okBtn = $("confirmOkBtn");
    let settled = false;

    titleNode.textContent = title;
    textNode.textContent = text;
    okBtn.textContent = confirmLabel;
    okBtn.classList.toggle("danger-btn", tone === "danger");

    const cleanup = (result) => {
      if (settled) return;
      settled = true;
      cancelBtn.removeEventListener("click", onCancel);
      okBtn.removeEventListener("click", onOk);
      dialog.removeEventListener("close", onClose);
      if (dialog.open) dialog.close();
      resolve(result);
    };
    const onCancel = () => cleanup(false);
    const onOk = () => cleanup(true);
    const onClose = () => cleanup(false);

    cancelBtn.addEventListener("click", onCancel);
    okBtn.addEventListener("click", onOk);
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function setMovementType(type) {
  $("movementType").value = type;
  document.querySelectorAll(".movement-type").forEach((button) => {
    button.classList.toggle("active", button.dataset.movementType === type);
  });
  const isIncome = type === "income";
  $("expenseDialogTitle").textContent = isIncome ? "Añadir ingreso" : "Añadir gasto";
  $("movementSubmitBtn").textContent = isIncome ? "Guardar ingreso" : "Guardar gasto";
  const options = isIncome ? incomeCategories() : expenseCategories();
  $("expenseCategory").innerHTML = options.map((category) => `<option>${category}</option>`).join("");
}

function openTransactionEditor(item) {
  if (!item) return;
  $("expenseForm").reset();
  $("expenseId").value = item.id;
  setMovementType(item.type === "income" ? "income" : "expense");
  $("expenseDialogTitle").textContent = "Editar movimiento";
  $("expenseName").value = item.name;
  $("expenseAmount").value = item.amount;
  $("expenseDate").value = item.date;
  $("expenseCategory").value = item.category;
  $("movementSubmitBtn").textContent = "Guardar cambios";
  $("learnRuleBox").hidden = false;
  $("learnRuleCheck").checked = false;
  $("expenseDialog").showModal();
}

function closeTransactionEditor() {
  $("expenseId").value = "";
  $("learnRuleBox").hidden = true;
  $("learnRuleCheck").checked = false;
}

function openRecurring(item = null) {
  $("recurringForm").reset();
  $("recurringId").value = item?.id || "";
  $("recurringName").value = item?.name || "Casa";
  $("recurringAmount").value = item?.amount || "";
  $("recurringCategory").value = item?.category || "Vivienda";

  const group = item?.brand ? "subscriptions" : "everyday";
  switchTemplateGroup(group, false);

  const templates = [...document.querySelectorAll(".template")];
  templates.forEach((button) => {
    const shouldBeActive = item ? button.dataset.template === item.template : button.dataset.template === (group === "subscriptions" ? "Netflix" : "Casa");
    button.classList.toggle("active", shouldBeActive);
  });

  if (!document.querySelector(".template.active") || document.querySelector(".template.active")?.hidden) {
    const firstVisible = document.querySelector(`.template[data-group="${group}"]:not([hidden])`);
    if (firstVisible) firstVisible.classList.add("active");
  }

  $("recurringForm").querySelector(".submit-btn").textContent = item ? "Guardar cambios" : "Añadir a mi plan";
  $("recurringDialog").showModal();
}

function switchTemplateGroup(group, chooseFirst = true) {
  document.querySelectorAll(".template-tab").forEach((tab) => {
    const isActive = tab.dataset.templateTab === group;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  document.querySelectorAll(".template").forEach((template) => {
    template.hidden = template.dataset.group !== group;
  });

  const active = document.querySelector(".template.active");
  if (!chooseFirst && active && !active.hidden) return;

  document.querySelectorAll(".template").forEach((item) => item.classList.remove("active"));
  const selected = document.querySelector(`.template[data-group="${group}"]:not([hidden])`);
  if (selected) {
    selected.classList.add("active");
    $("recurringCategory").value = selected.dataset.category;
    $("recurringName").value = selected.dataset.template;
  }
}


function isDemoMode() {
  const raw = localStorage.getItem(DEMO_KEY) || DEMO_FALLBACK_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  return raw === "1";
}

function setDemoMode(enabled) {
  if (enabled) localStorage.setItem(DEMO_KEY, "1");
  else localStorage.removeItem(DEMO_KEY);
}

function hasRealData() {
  ensureStateShape();
  return state.expenses.length || state.recurring.length || state.goals.length || Object.keys(state.months || {}).length;
}

function openWelcome({ force = false } = {}) {
  const welcomeSeen = localStorage.getItem(WELCOME_KEY) || WELCOME_FALLBACK_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!force && welcomeSeen === "1") return;
  const existing = document.querySelector(".welcome-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "welcome-overlay";
  overlay.innerHTML = `
    <div class="welcome-card" role="dialog" aria-modal="true" aria-label="Bienvenida a Nexo">
      <div class="welcome-logo"><span class="brand-mark" aria-hidden="true">N</span><strong>Nexo</strong></div>
      <p class="eyebrow">VERSIÓN PARA COMPARTIR</p>
      <h2>Controla gastos, límites y objetivos sin complicarte.</h2>
      <p>Importa extractos BBVA o CSV, revisa movimientos desde el móvil y sincroniza con tu PC por WiFi.</p>
      <div class="welcome-points">
        <div><strong>Privado</strong><span>Los datos se guardan en tu navegador o en tu PC si sincronizas.</span></div>
        <div><strong>Sin nube</strong><span>No se suben extractos a internet en esta versión local.</span></div>
        <div><strong>Prueba segura</strong><span>Puedes cargar un modo demo con datos falsos.</span></div>
      </div>
      <div class="welcome-actions">
        <button class="primary-btn" type="button" data-welcome-start>Empezar desde cero</button>
        <button class="secondary-btn" type="button" data-welcome-demo>Ver modo demo</button>
        <button class="secondary-btn" type="button" data-welcome-restore>Cargar copia</button>
      </div>
      <button class="text-btn welcome-skip" type="button" data-welcome-close>Ya conozco la app</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => {
    localStorage.setItem(WELCOME_KEY, "1");
    overlay.remove();
  };
  overlay.querySelector("[data-welcome-start]").addEventListener("click", close);
  overlay.querySelector("[data-welcome-close]").addEventListener("click", close);
  overlay.querySelector("[data-welcome-restore]").addEventListener("click", () => {
    close();
    showScreen("settings");
    $("backupFileInput")?.click();
  });
  overlay.querySelector("[data-welcome-demo]").addEventListener("click", async () => {
    if (hasRealData()) {
      const ok = await confirmAction({ title: "Cargar modo demo", text: "Se sustituirán los datos actuales por datos falsos de ejemplo. Haz una copia si quieres conservarlos.", confirmLabel: "Cargar demo", tone: "danger" });
      if (!ok) return;
    }
    state = createDemoState();
    setDemoMode(true);
    saveState();
    selectedMonth = currentMonth;
    showScreen("home");
    render();
    close();
    toast("Modo demo cargado con datos falsos", "info");
  });
}

async function loadDemoMode() {
  if (hasRealData()) {
    const ok = await confirmAction({ title: "Cargar modo demo", text: "Se sustituirán los datos actuales por datos falsos de ejemplo. Exporta una copia antes si quieres conservarlos.", confirmLabel: "Cargar demo", tone: "danger" });
    if (!ok) return;
  }
  state = createDemoState();
  setDemoMode(true);
  saveState();
  selectedMonth = currentMonth;
  render();
  toast("Modo demo cargado", "info");
}

async function clearDemoMode() {
  if (!isDemoMode()) {
    toast("No estás usando el modo demo", "info");
    return;
  }
  const ok = await confirmAction({ title: "Salir del modo demo", text: "Se borrarán los datos falsos para empezar con tus datos reales.", confirmLabel: "Borrar demo", tone: "danger" });
  if (!ok) return;
  state = emptyState();
  setDemoMode(false);
  saveState();
  render();
  toast("Demo borrada. Empieza con tus datos reales.", "success");
}

function showPrivacyInfo() {
  confirmAction({
    title: "Privacidad y datos",
    text: "Nexo local guarda los datos en tu navegador. Si usas Sincronización WiFi, guarda una copia en tu propio PC. En esta versión no se suben tus extractos a internet ni hay cuentas de usuario.",
    confirmLabel: "Entendido",
    tone: "info"
  });
}

async function deleteAllDataProtected() {
  const ok = await confirmAction({ title: "Borrar todos mis datos", text: "Esta acción eliminará movimientos, presupuestos, reglas, objetivos, recurrentes y copias locales de la app.", confirmLabel: "Continuar", tone: "danger" });
  if (!ok) return;
  const typed = window.prompt('Para confirmar, escribe BORRAR en mayúsculas.');
  if (typed !== "BORRAR") {
    toast("Borrado cancelado", "info");
    return;
  }
  state = emptyState();
  setDemoMode(false);
  localStorage.removeItem(STORAGE_KEY);
  STORAGE_FALLBACK_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(SYNC_LOCAL_UPDATED_KEY);
  saveState();
  render();
  toast("Datos borrados", "danger");
}

function initShareReadyFeatures() {
  $("openWelcomeBtn")?.addEventListener("click", () => openWelcome({ force: true }));
  $("loadDemoBtn")?.addEventListener("click", loadDemoMode);
  $("clearDemoBtn")?.addEventListener("click", clearDemoMode);
  $("privacyInfoBtn")?.addEventListener("click", showPrivacyInfo);
  $("deleteAllDataBtn")?.addEventListener("click", deleteAllDataProtected);
  window.addEventListener("load", () => setTimeout(() => openWelcome(), 250));
}

function initEvents() {
  $("monthPicker").value = selectedMonth;
  $("monthLabelBtn").addEventListener("click", openMonthPicker);
  $("monthDialogGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-month-value]");
    if (!button) return;
    selectedMonth = button.dataset.monthValue;
    $("monthDialog").close();
    render();
  });
  $("prevYearBtn").addEventListener("click", () => {
    monthDialogYear -= 1;
    renderMonthDialog();
  });
  $("nextYearBtn").addEventListener("click", () => {
    monthDialogYear += 1;
    renderMonthDialog();
  });
  $("monthDialogToday").addEventListener("click", () => {
    selectedMonth = currentMonth;
    $("monthDialog").close();
    render();
  });
  $("prevMonthBtn").addEventListener("click", () => {
    selectedMonth = shiftMonth(selectedMonth, -1);
    render();
  });
  $("nextMonthBtn").addEventListener("click", () => {
    selectedMonth = shiftMonth(selectedMonth, 1);
    render();
  });

  $("themeToggleBtn").addEventListener("click", () => {
    applyTheme(activeTheme === "dark" ? "light" : "dark");
    saveTheme(activeTheme);
  });

  $("editPlanBtn").addEventListener("click", openPlan);
  $("addRecurringBtn").addEventListener("click", () => openRecurring());
  $("editCategoryBudgetsBtn").addEventListener("click", openCategoryBudgetDialog);
  $("categoryBudgetForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveCategoryBudgetDialog();
  });
  $("addGoalBtn").addEventListener("click", () => openGoalDialog());
  $("downloadGoalsPlanBtn")?.addEventListener("click", downloadGoalsPlan);
  $("downloadMonthlyReportBtn")?.addEventListener("click", downloadMonthlyReport);
  $("addCategoryBtn").addEventListener("click", () => openCategoryDialog());
  $("categoryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveCategoryFromDialog();
  });
  $("customCategoryList").addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-category]");
    const remove = event.target.closest("[data-delete-category]");
    if (edit) {
      openCategoryDialog({ name: edit.dataset.editCategory, type: edit.dataset.categoryType, builtIn: edit.dataset.categoryBuiltIn === "1", icon: categoryIcon(edit.dataset.editCategory) });
      return;
    }
    if (remove) await deleteCustomCategory(remove.dataset.deleteCategory);
  });
  document.body.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-emoji]");
    if (!chip) return;
    const target = $(chip.dataset.targetInput);
    if (target) {
      target.value = chip.dataset.emoji;
      target.focus();
    }
  });
  $("goalForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveGoalFromDialog();
  });
  document.addEventListener("click", async (event) => {
    const customGoal = event.target.closest("[data-goal-custom]");
    const contribution = event.target.closest("[data-goal-contribution]");
    if (customGoal) {
      const goal = (state.goals || []).find((item) => item.id === customGoal.dataset.goalCustom);
      const value = window.prompt(`¿Cuánto quieres añadir a ${goal?.name || "este objetivo"}?`, "25");
      if (value === null) return;
      addGoalContribution(customGoal.dataset.goalCustom, Number(String(value).replace(",", ".")));
      return;
    }
    if (contribution) {
      addGoalContribution(contribution.dataset.goalContribution, Number(contribution.dataset.goalAmount));
    }
  });
  $("goalsList").addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-goal]");
    const remove = event.target.closest("[data-delete-goal]");
    if (edit) {
      openGoalDialog((state.goals || []).find((goal) => goal.id === edit.dataset.editGoal));
      return;
    }
    if (!remove) return;
    const current = (state.goals || []).find((goal) => goal.id === remove.dataset.deleteGoal);
    const ok = await confirmAction({ title: "Eliminar objetivo", text: `Se eliminará “${current?.name || "este objetivo"}” de tus metas.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    state.goals = (state.goals || []).filter((goal) => goal.id !== remove.dataset.deleteGoal);
    saveState();
    render();
    toast("Objetivo eliminado", "danger");
  });
  $("addExpenseBtn").addEventListener("click", () => {
    $("expenseForm").reset();
    closeTransactionEditor();
    setMovementType("expense");
    const [year, month] = selectedMonth.split("-").map(Number);
    const preferredDay = selectedMonth === currentMonth ? now.getDate() : 1;
    $("expenseDate").value = `${selectedMonth}-${String(Math.min(preferredDay, new Date(year, month, 0).getDate())).padStart(2, "0")}`;
    $("expenseDialog").showModal();
  });

  ["movementSearchInput", "movementTypeFilter", "movementCategoryFilter"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => {
      movementFilters.search = $("movementSearchInput")?.value || "";
      movementFilters.type = $("movementTypeFilter")?.value || "all";
      movementFilters.category = $("movementCategoryFilter")?.value || "all";
      selectedMovementIds.clear();
      render();
    });
    el.addEventListener("change", () => {
      movementFilters.search = $("movementSearchInput")?.value || "";
      movementFilters.type = $("movementTypeFilter")?.value || "all";
      movementFilters.category = $("movementCategoryFilter")?.value || "all";
      selectedMovementIds.clear();
      render();
    });
  });
  $("clearMovementFiltersBtn")?.addEventListener("click", () => {
    movementFilters.search = "";
    movementFilters.type = "all";
    movementFilters.category = "all";
    movementFilters.importBatchId = "all";
    selectedMovementIds.clear();
    render();
  });
  $("lastImportFilterBtn")?.addEventListener("click", () => {
    const last = latestImportBatch();
    if (!last) return toast("Todavía no hay una importación reciente", "info");
    movementFilters.importBatchId = movementFilters.importBatchId === last.id ? "all" : last.id;
    selectedMovementIds.clear();
    showScreen("movements");
    render();
  });
  $("importReviewSummary")?.addEventListener("click", async (event) => {
    if (event.target.closest("#viewLastImportBtn")) {
      const batchId = lastImportSummary?.batchId || latestImportBatch()?.id;
      if (!batchId) return;
      movementFilters.importBatchId = batchId;
      selectedMovementIds.clear();
      render();
      return;
    }
    if (event.target.closest("#deleteLastImportBtn")) {
      const batchId = lastImportSummary?.batchId || latestImportBatch()?.id;
      if (!batchId) return;
      const ok = await confirmAction({ title: "Borrar última importación", text: "Se eliminarán solo los movimientos de esta importación. No se borran recurrentes, presupuestos ni objetivos.", confirmLabel: "Borrar importación" });
      if (!ok) return;
      const removed = deleteImportBatch(batchId);
      saveState();
      render();
      toast(`${removed} movimientos eliminados`, "danger");
      return;
    }
    if (!event.target.closest("#dismissImportSummaryBtn")) return;
    lastImportSummary = null;
    renderImportReviewSummary();
  });
  $("bulkToolbar")?.addEventListener("click", async (event) => {
    if (event.target.closest("#selectVisibleMovementsBtn")) {
      const visible = filterTransactions(monthEntriesAll());
      selectedMovementIds.clear();
      visible.forEach((item) => selectedMovementIds.add(item.id));
      render();
      return;
    }
    if (event.target.closest("#clearBulkSelectionBtn")) {
      selectedMovementIds.clear();
      render();
      return;
    }
    if (event.target.closest("#applyBulkCategoryBtn")) {
      const category = $("bulkCategorySelect")?.value || "";
      if (!category) return toast("Elige una categoría antes de aplicar", "info");
      if (!selectedMovementIds.size) return toast("No hay movimientos seleccionados", "info");
      const count = selectedMovementIds.size;
      const learn = Boolean($("bulkLearnRulesCheck")?.checked);
      const selectedBefore = state.expenses.filter((item) => selectedMovementIds.has(item.id));
      state.expenses = state.expenses.map((item) => selectedMovementIds.has(item.id) ? { ...item, category } : item);
      if (learn) {
        selectedBefore.forEach((item) => addRuleFromMovement({ ...item, category }));
      }
      saveState();
      selectedMovementIds.clear();
      render();
      toast(`${count} movimientos cambiados a ${category}${learn ? " y reglas aprendidas" : ""}`, "success");
    }
  });

  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  $("incomeInput").addEventListener("input", updatePlanPreview);
  $("savingsInput").addEventListener("input", updatePlanPreview);

  $("planForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const income = Number($("incomeInput").value);
    const savings = Number($("savingsInput").value);
    if (savings > income) {
      $("planPreview").textContent = "El ahorro no puede ser mayor que tus ingresos.";
      return;
    }
    state.months[selectedMonth] = { income, savings };
    saveState();
    $("planDialog").close();
    render();
    toast("Plan mensual guardado");
  });

  $("expenseForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const date = $("expenseDate").value;
    const id = $("expenseId").value;
    const item = {
      id: id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      name: $("expenseName").value.trim(),
      amount: Number($("expenseAmount").value),
      date,
      category: $("expenseCategory").value,
      type: $("movementType").value,
      createdAt: id ? (state.expenses.find((expense) => expense.id === id)?.createdAt || Date.now()) : Date.now()
    };
    if (id) {
      state.expenses = state.expenses.map((expense) => expense.id === id ? { ...expense, ...item } : expense);
      if ($("learnRuleCheck").checked) addRuleFromMovement(item);
    } else {
      state.expenses.push(item);
    }
    saveState();
    $("expenseDialog").close();
    closeTransactionEditor();
    if (!date.startsWith(selectedMonth)) selectedMonth = date.slice(0, 7);
    render();
    toast(id ? "Movimiento actualizado" : ($("movementType").value === "income" ? "Ingreso añadido a tu margen" : "Gasto añadido"));
  });

  document.querySelectorAll(".movement-type").forEach((button) => {
    button.addEventListener("click", () => setMovementType(button.dataset.movementType));
  });

  $("templateGrid").querySelectorAll(".draw-icon").forEach((element) => {
    element.innerHTML = iconSvg(element.dataset.icon);
  });

  document.querySelectorAll(".template-tab").forEach((tab) => tab.addEventListener("click", () => {
    switchTemplateGroup(tab.dataset.templateTab);
  }));

  $("templateGrid").addEventListener("click", (event) => {
    const button = event.target.closest(".template");
    if (!button || button.hidden) return;
    document.querySelectorAll(`.template[data-group="${button.dataset.group}"]`).forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    $("recurringCategory").value = button.dataset.category;
    $("recurringName").value = button.dataset.template;
    $("recurringName").focus();
  });

  $("recurringForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("recurringId").value;
    const activeTemplate = document.querySelector(".template.active");
    const item = {
      id: id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      template: activeTemplate?.dataset.template || "",
      name: $("recurringName").value.trim(),
      amount: Number($("recurringAmount").value),
      category: $("recurringCategory").value,
      brand: activeTemplate?.dataset.brand || ""
    };
    if (id) state.recurring = state.recurring.map((current) => current.id === id ? item : current);
    else state.recurring.push(item);
    saveState();
    $("recurringDialog").close();
    render();
    toast(id ? "Gasto recurrente actualizado" : "Gasto recurrente añadido a tu plan");
  });

  $("recurringList").addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-recurring]");
    const remove = event.target.closest("[data-delete-recurring]");
    if (edit) openRecurring(state.recurring.find((item) => item.id === edit.dataset.editRecurring));
    if (remove) {
      const current = state.recurring.find((item) => item.id === remove.dataset.deleteRecurring);
      const ok = await confirmAction({ title: "Eliminar gasto recurrente", text: `Se eliminará “${current?.name || "este gasto"}” de tu plan mensual.`, confirmLabel: "Eliminar" });
      if (!ok) return;
      state.recurring = state.recurring.filter((item) => item.id !== remove.dataset.deleteRecurring);
      saveState();
      render();
      toast("Gasto recurrente eliminado", "danger");
    }
  });

  $("transactionList").addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-select-transaction]");
    if (!checkbox) return;
    if (checkbox.checked) selectedMovementIds.add(checkbox.dataset.selectTransaction);
    else selectedMovementIds.delete(checkbox.dataset.selectTransaction);
    render();
  });

  $("transactionList").addEventListener("click", async (event) => {
    if (event.target.closest("[data-select-transaction]")) return;
    const edit = event.target.closest("[data-edit-transaction]");
    const remove = event.target.closest("[data-delete]");
    if (edit) {
      openTransactionEditor(state.expenses.find((expense) => expense.id === edit.dataset.editTransaction));
      return;
    }
    if (!remove) return;
    const current = state.expenses.find((expense) => expense.id === remove.dataset.delete);
    const ok = await confirmAction({ title: "Eliminar movimiento", text: `Se eliminará “${current?.name || "este movimiento"}”.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    state.expenses = state.expenses.filter((expense) => expense.id !== remove.dataset.delete);
    saveState();
    render();
    toast("Movimiento eliminado", "danger");
  });

  $("resetBtn").addEventListener("click", async () => {
    const ok = await confirmAction({ title: "Borrar todos los datos", text: "Se eliminarán tus planes, movimientos, reglas y gastos recurrentes.", confirmLabel: "Borrar todo" });
    if (!ok) return;
    state = emptyState();
    localStorage.removeItem(DEMO_KEY);
    saveState();
    render();
    toast("Todos los datos se han borrado", "danger");
  });
}

function initInstallPrompt() {
  let deferredInstallPrompt = null;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("installBtn").hidden = false;
  });

  if (isIos && !isStandalone) $("installBtn").hidden = false;
  if ($("installHelp")) {
    $("installHelp").hidden = location.protocol !== "file:";
  }

  $("installBtn").addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $("installBtn").hidden = true;
    } else {
      toast("En Safari: Compartir → Añadir a pantalla de inicio");
    }
  });
}


function initDataTools() {
  $("importCsvBtn").addEventListener("click", () => {
    pendingCsvItems = [];
    pendingImportFile = null;
    pendingImportIncludeDuplicates = false;
    pendingImportResetData = false;
    pendingConvertedCsvText = "";
    pendingConvertedCsvName = "";
    pendingCsvMappingContext = null;
    pendingCsvProfileInfo = "";
    $("csvFileInput").value = "";
    if ($("importDuplicatesCheck")) $("importDuplicatesCheck").checked = false;
    if ($("resetImportDataCheck")) $("resetImportDataCheck").checked = false;
    if ($("pdfPasswordInput")) $("pdfPasswordInput").value = "";
    if ($("pdfPasswordBox")) $("pdfPasswordBox").hidden = true;
    $("csvImportStatus").textContent = "Aún no has seleccionado ningún archivo.";
    updateConverterStatus();
    $("csvPreview").hidden = true;
    $("csvPreview").innerHTML = "";
    $("confirmCsvImportBtn").disabled = true;
    $("csvDialog").showModal();
  });

  $("csvFileInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    pendingImportFile = file;
    if ($("pdfPasswordInput")) $("pdfPasswordInput").value = "";
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if ($("pdfPasswordBox")) $("pdfPasswordBox").hidden = !isPdf;
    await readSelectedBankFile();
  });

  if ($("retryPdfPasswordBtn")) {
    $("retryPdfPasswordBtn").addEventListener("click", async () => {
      await readSelectedBankFile($("pdfPasswordInput")?.value || "");
    });
  }

  $("csvPreview").addEventListener("click", (event) => {
    const applyMapping = event.target.closest("#applyCsvMappingBtn");
    if (applyMapping) {
      applyCsvMappingFromPanel();
      return;
    }
    const download = event.target.closest("#downloadConvertedCsvBtn");
    if (!download) return;
    if (!pendingConvertedCsvText) {
      toast("Todavía no hay CSV convertido para descargar", "info");
      return;
    }
    downloadTextFile(pendingConvertedCsvName || "nexo-bbva-convertido.csv", pendingConvertedCsvText, "text/csv;charset=utf-8");
    toast("CSV convertido descargado", "success");
  });

  $("csvPreview").addEventListener("change", (event) => {
    if (event.target?.id === "importDuplicatesCheck") {
      pendingImportIncludeDuplicates = event.target.checked;
      renderCsvPreview();
      return;
    }
    if (event.target?.id === "resetImportDataCheck") {
      pendingImportResetData = event.target.checked;
      if (pendingImportResetData) pendingImportIncludeDuplicates = true;
      renderCsvPreview();
      return;
    }
    const category = event.target.closest("[data-csv-category]");
    if (!category) return;
    const item = pendingCsvItems[Number(category.dataset.csvCategory)];
    if (!item) return;
    item.category = category.value;
  });

  $("downloadConvertedCsvBtn")?.addEventListener("click", () => {
    if (!pendingConvertedCsvText) {
      toast("Todavía no hay CSV convertido para descargar", "info");
      return;
    }
    downloadTextFile(pendingConvertedCsvName || "nexo-bbva-convertido.csv", pendingConvertedCsvText, "text/csv;charset=utf-8");
    toast("CSV convertido descargado", "success");
  });

  $("confirmCsvImportBtn").addEventListener("click", () => {
    const toImport = pendingImportResetData || pendingImportIncludeDuplicates ? pendingCsvItems : pendingCsvItems.filter((item) => !item.duplicate);
    if (!toImport.length) {
      toast(pendingImportIncludeDuplicates ? "No hay movimientos para importar" : "No hay movimientos nuevos para importar", "info");
      return;
    }
    if (pendingImportResetData) {
      state.expenses = [];
      pendingCsvItems.forEach((item) => { item.duplicate = false; });
    }
    const batchId = crypto.randomUUID ? crypto.randomUUID() : `import-${Date.now()}`;
    const batchName = pendingImportFile?.name || pendingConvertedCsvName || "Importación";
    const normalizedImport = toImport.map(({ duplicate, ...item }) => ({
      ...item,
      originalDescription: item.raw?.description || item.originalDescription || item.name,
      importBatchId: batchId,
      importBatchName: batchName,
      importedAt: new Date().toISOString()
    }));
    state.expenses.push(...normalizedImport);
    state.importHistory = state.importHistory || [];
    state.importHistory.unshift({ id: batchId, name: batchName, importedAt: new Date().toISOString(), count: normalizedImport.length, months: monthBreakdown(normalizedImport) });
    state.importHistory = state.importHistory.slice(0, 20);
    lastImportSummary = buildImportSummary(normalizedImport);
    const targetMonth = mostCommonMonth(normalizedImport) || normalizedImport.map((item) => item.date).filter(Boolean).sort().at(-1)?.slice(0, 7);
    if (targetMonth) selectedMonth = targetMonth;
    saveState();
    $("csvDialog").close();
    showScreen("movements");
    render();
    toast(`${toImport.length} movimientos importados. Te he llevado al mes ${formatMonth(selectedMonth)}.`, "success");
  });

  $("exportBackupBtn").addEventListener("click", exportBackup);
  $("importBackupBtn").addEventListener("click", () => $("backupFileInput").click());
  $("backupFileInput").addEventListener("change", importBackup);
  $("addRuleBtn").addEventListener("click", () => openRuleDialog());
  $("rulesList").addEventListener("click", async (event) => {
    const remove = event.target.closest("[data-delete-rule]");
    if (!remove) return;
    const current = (state.rules || []).find((rule) => rule.id === remove.dataset.deleteRule);
    const ok = await confirmAction({ title: "Eliminar regla", text: `La regla “${current?.keyword || "esta regla"}” dejará de aplicarse en futuras importaciones.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    state.rules = (state.rules || []).filter((rule) => rule.id !== remove.dataset.deleteRule);
    saveState();
    renderRules();
    toast("Regla eliminada", "danger");
  });
  $("ruleType").addEventListener("change", () => fillRuleCategoryOptions());
  $("ruleForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const keyword = $("ruleKeyword").value.trim();
    if (!keyword) return;
    state.rules = state.rules || [];
    state.rules.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      keyword,
      name: cleanDescription($("ruleName")?.value || ""),
      category: $("ruleCategory").value,
      type: $("ruleType").value
    });
    saveState();
    $("ruleDialog").close();
    renderRules();
    toast("Regla guardada", "success");
  });
}

async function readSelectedBankFile(password = "") {
  const file = pendingImportFile;
  if (!file) return;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  try {
    $("csvImportStatus").textContent = isPdf
      ? (password ? "Convirtiendo PDF con contraseña..." : "Convirtiendo PDF BBVA a CSV...")
      : "Leyendo archivo...";
    pendingConvertedCsvText = "";
    pendingConvertedCsvName = "";
    $("csvPreview").hidden = true;
    $("confirmCsvImportBtn").disabled = true;
    pendingCsvItems = await parseBankFile(file, password);
    if ($("pdfPasswordInput")) $("pdfPasswordInput").value = "";
    if ($("pdfPasswordBox")) $("pdfPasswordBox").hidden = true;
    renderCsvPreview();
  } catch (error) {
    pendingCsvItems = [];
    $("csvPreview").hidden = true;
    $("confirmCsvImportBtn").disabled = true;
    if (isPdf && isPdfPasswordError(error)) {
      if ($("pdfPasswordBox")) $("pdfPasswordBox").hidden = false;
      $("csvImportStatus").textContent = error.code === "INCORRECT_PASSWORD"
        ? "La contraseña no es correcta. Introdúcela de nuevo y reintenta."
        : "Este PDF está protegido. Introduce la contraseña para leerlo.";
      setTimeout(() => $("pdfPasswordInput")?.focus(), 50);
      return;
    }
    if (!isPdf && error?.code === "CSV_MAPPING_NEEDED") {
      pendingCsvMappingContext = error.context;
      renderCsvMappingPanel(error.context, error.message);
      return;
    }
    $("csvImportStatus").textContent = `No he podido leer el archivo: ${error.message}`;
  }
}

function isPdfPasswordError(error) {
  return error?.code === "NEED_PASSWORD" || error?.code === "INCORRECT_PASSWORD" || /password|contrase/i.test(String(error?.message || ""));
}

function mostCommonMonth(items) {
  const counts = items.reduce((acc, item) => {
    const month = String(item.date || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "";
}

async function parseBankFile(file, password = "") {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    try {
      return await parseBankPdfWithLocalConverter(file, password);
    } catch (localError) {
      console.warn("Conversor local BBVA no disponible o no pudo leer el PDF", localError);
      if (isPdfPasswordError(localError)) throw localError;
      throw new Error(`no está activo el conversor local BBVA o no pudo convertir el PDF. Abre la app con 1_INICIAR_NEXO.bat y vuelve a subir el PDF. Detalle: ${localError.message || localError}`);
    }
  }
  return parseBankCsv(await file.text());
}

async function parseBankPdfWithLocalConverter(file, password = "") {
  const endpoints = [
    `${window.location.origin}/convert-bbva-pdf`,
    "http://127.0.0.1:8765/convert-bbva-pdf"
  ].filter((value, index, list) => value.startsWith("http") && list.indexOf(value) === index);

  const formData = new FormData();
  formData.append("file", file, file.name || "extracto-bbva.pdf");
  formData.append("password", password || "");

  let lastError = null;
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, { method: "POST", body: formData, signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(errorText || `HTTP ${response.status}`);
        if (response.status === 401 || /PASSWORD_REQUIRED|password required|contrase/i.test(errorText)) err.code = "NEED_PASSWORD";
        if (response.status === 403 || /INCORRECT_PASSWORD|incorrect password|contraseña no es correcta/i.test(errorText)) err.code = "INCORRECT_PASSWORD";
        throw err;
      }
      const csvText = await response.text();
      pendingConvertedCsvText = csvText;
      pendingConvertedCsvName = `${(file.name || "extracto-bbva").replace(/\.pdf$/i, "")}-nexo.csv`;
      const items = parseBankCsv(csvText);
      if (!items.length) throw new Error("el conversor local no devolvió movimientos");
      return items;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
    }
  }
  throw lastError || new Error("conversor local no disponible");
}


async function updateConverterStatus() {
  const box = $("converterStatus");
  if (!box) return;
  if (location.protocol === "file:") {
    box.className = "converter-status warn";
    box.textContent = "Conversor no activo: abre la app con 1_INICIAR_NEXO.bat para importar PDF BBVA.";
    return;
  }
  box.className = "converter-status checking";
  box.textContent = "Comprobando conversor BBVA local...";
  const endpoints = [
    `${window.location.origin}/health`,
    "http://127.0.0.1:8765/health"
  ].filter((value, index, list) => value.startsWith("http") && list.indexOf(value) === index);
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.ok) {
        box.className = "converter-status ok";
        box.textContent = `Conversor BBVA activo (${data.version || "local"}). Los PDF se convertirán a CSV antes de importar.`;
        return;
      }
    } catch (error) {
      clearTimeout(timeout);
    }
  }
  box.className = "converter-status warn";
  box.textContent = "Conversor no detectado. Para PDF BBVA usa 1_INICIAR_NEXO.bat. Los CSV siguen funcionando sin conversor.";
}

function downloadTextFile(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function monthBreakdown(items) {
  const counts = items.reduce((acc, item) => {
    const month = String(item.date || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => `${formatMonth(month)}: ${count}`)
    .join(" · ");
}

function parseBankCsv(text) {
  const rows = parseCsvRows(String(text || "").trim());
  if (rows.length < 2) throw new Error("el archivo no tiene filas suficientes");
  const config = detectCsvImportConfig(rows);
  if (!config || config.dateIndex < 0 || config.descriptionIndex < 0 || (config.amountIndex < 0 && config.debitIndex < 0 && config.creditIndex < 0)) {
    const context = buildCsvMappingContext(rows);
    const error = new Error("No he podido detectar automáticamente las columnas del CSV. Indica qué columna es fecha, concepto e importe.");
    error.code = "CSV_MAPPING_NEEDED";
    error.context = context;
    throw error;
  }
  pendingCsvProfileInfo = buildCsvProfileInfo(config);
  return parseCsvRowsWithConfig(rows, config);
}

function buildCsvMappingContext(rows) {
  const headerRowIndex = findCsvHeaderRow(rows);
  const headerRow = rows[headerRowIndex] || rows[0] || [];
  const headers = headerRow.map((value, index) => String(value || "").trim() || `Columna ${index + 1}`);
  return {
    rows,
    headerRowIndex,
    headers,
    previewRows: rows.slice(headerRowIndex + 1, headerRowIndex + 7)
  };
}

function detectCsvImportConfig(rows) {
  const headerRowIndex = findCsvHeaderRow(rows);
  const rawHeaders = rows[headerRowIndex] || [];
  const headers = rawHeaders.map(normalizeHeader);
  const dateIndex = findHeaderSmart(headers, [
    "fecha operacion", "fecha oper", "f oper", "f operacion", "fecha movimiento", "fecha contable", "fecha cargo", "booking date", "transaction date", "data operacio", "data operacion",
    "fecha", "date", "data", "dia"
  ], ["fecha valor", "f valor", "saldo", "balance"]);
  const descriptionIndex = findHeaderSmart(headers, [
    "concepto", "descripcion", "descripcio", "description", "detalle", "movimiento", "operacion", "comercio", "merchant", "beneficiario", "ordenante", "texto", "nombre", "referencia", "asunto"
  ], ["saldo", "balance", "importe", "amount", "cargo", "abono", "debe", "haber", "fecha", "date"]);
  const amountIndex = findHeaderSmart(headers, [
    "importe", "importe eur", "importe euros", "amount", "cantidad", "monto", "total", "import", "eur", "euros", "valor movimiento"
  ], ["saldo", "balance", "fecha valor", "valor fecha"]);
  const debitIndex = findHeaderSmart(headers, [
    "cargo", "cargos", "debe", "debito", "debito eur", "salida", "salidas", "retirada", "withdrawal", "payment out", "pagado", "importe cargo", "cargo eur"
  ], ["saldo", "balance"]);
  const creditIndex = findHeaderSmart(headers, [
    "abono", "abonos", "haber", "credito", "entrada", "entradas", "ingreso", "deposit", "payment in", "cobrado", "importe abono", "abono eur"
  ], ["saldo", "balance"]);
  return { headerRowIndex, rawHeaders, headers, dateIndex, descriptionIndex, amountIndex, debitIndex, creditIndex };
}

function findCsvHeaderRow(rows) {
  const max = Math.min(rows.length, 8);
  let best = { index: 0, score: -1 };
  for (let i = 0; i < max; i += 1) {
    const headers = (rows[i] || []).map(normalizeHeader);
    const score = scoreHeaderRow(headers);
    if (score > best.score) best = { index: i, score };
  }
  return best.index;
}

function scoreHeaderRow(headers) {
  let score = 0;
  headers.forEach((header) => {
    if (!header) return;
    if (/fecha|date|data|dia/.test(header)) score += header.includes("valor") ? 1 : 3;
    if (/concepto|descripcion|descripcio|description|detalle|movimiento|operacion|comercio|merchant/.test(header)) score += 4;
    if (/importe|amount|cantidad|monto|cargo|abono|debe|haber|credito|debito|entrada|salida/.test(header)) score += header.includes("saldo") || header.includes("balance") ? -3 : 4;
    if (/saldo|balance/.test(header)) score -= 2;
  });
  return score;
}

function findHeaderSmart(headers, names, blocked = []) {
  const normalizedNames = names.map(normalizeHeader);
  const normalizedBlocked = blocked.map(normalizeHeader);
  const exact = headers.findIndex((header) => header && normalizedNames.includes(header) && !normalizedBlocked.some((bad) => bad && header.includes(bad)));
  if (exact >= 0) return exact;
  return headers.findIndex((header) => header && normalizedNames.some((name) => header.includes(name) || name.includes(header)) && !normalizedBlocked.some((bad) => bad && header.includes(bad)));
}

function buildCsvProfileInfo(config) {
  const header = (index) => index >= 0 ? String(config.rawHeaders[index] || `Columna ${index + 1}`).trim() : "—";
  const amountText = config.amountIndex >= 0 ? header(config.amountIndex) : `${header(config.debitIndex)} / ${header(config.creditIndex)}`;
  return `CSV detectado: fecha = ${header(config.dateIndex)}, concepto = ${header(config.descriptionIndex)}, importe = ${amountText}`;
}

function parseCsvRowsWithConfig(rows, config) {
  const existing = new Set(state.expenses.map(transactionKey));
  const dataRows = rows.slice((config.headerRowIndex || 0) + 1).filter((row) => row.some((cell) => String(cell || "").trim()));
  return dataRows.map((row, index) => {
    const rawDate = row[config.dateIndex] || "";
    const rawDescription = cleanDescription(row[config.descriptionIndex] || "Movimiento banco");
    const amount = resolveAmount(row, config.amountIndex, config.debitIndex, config.creditIndex);
    const date = parseCsvDate(rawDate);
    if (!date || !amount) return null;
    const classified = classifyBankMovement(rawDescription, amount);
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : `csv-${Date.now()}-${index}`,
      name: classified.name,
      amount: Math.abs(amount),
      date,
      category: classified.category,
      type: amount >= 0 || classified.type === "income" ? "income" : "expense",
      createdAt: Date.now() + index,
      source: "bank-import",
      originalDescription: rawDescription,
      raw: { description: rawDescription, amount, columns: row }
    };
    item.duplicate = existing.has(transactionKey(item));
    return item;
  }).filter(Boolean);
}

function renderCsvMappingPanel(context, message = "") {
  $("csvImportStatus").textContent = message || "Indica las columnas del CSV para poder importarlo.";
  $("confirmCsvImportBtn").disabled = true;
  $("csvPreview").hidden = false;
  const optionList = context.headers.map((header, index) => `<option value="${index}">${escapeHtml(header)}</option>`).join("");
  const noneOption = `<option value="-1">No usar</option>`;
  const guesses = detectCsvImportConfig(context.rows) || {};
  const selected = (index) => Number.isInteger(index) && index >= 0 ? index : -1;
  $("csvPreview").innerHTML = `
    <div class="csv-mapping-panel">
      <strong>Asignar columnas del CSV</strong>
      <p>Para bancos distintos a BBVA, elige qué columna corresponde a cada dato. La fecha valor no hace falta.</p>
      <div class="csv-mapping-grid">
        <label>Fecha de operación<select id="csvMapDate">${optionList}</select></label>
        <label>Concepto / descripción<select id="csvMapDescription">${optionList}</select></label>
        <label>Importe único<select id="csvMapAmount">${noneOption}${optionList}</select></label>
        <label>Cargo / debe<select id="csvMapDebit">${noneOption}${optionList}</select></label>
        <label>Abono / haber<select id="csvMapCredit">${noneOption}${optionList}</select></label>
      </div>
      <button id="applyCsvMappingBtn" class="submit-btn" type="button">Aplicar columnas y previsualizar</button>
      <small class="import-raw">Si tu banco trae Cargo y Abono separados, deja Importe único en “No usar”.</small>
      <div class="csv-mapping-preview">
        <table><thead><tr>${context.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>
        ${context.previewRows.map((row) => `<tr>${context.headers.map((_, idx) => `<td>${escapeHtml(row[idx] || "")}</td>`).join("")}</tr>`).join("")}
        </tbody></table>
      </div>
    </div>`;
  setSelectValue("csvMapDate", selected(guesses.dateIndex));
  setSelectValue("csvMapDescription", selected(guesses.descriptionIndex));
  setSelectValue("csvMapAmount", selected(guesses.amountIndex));
  setSelectValue("csvMapDebit", selected(guesses.debitIndex));
  setSelectValue("csvMapCredit", selected(guesses.creditIndex));
}

function setSelectValue(id, value) {
  const el = $(id);
  if (el) el.value = String(value);
}

function applyCsvMappingFromPanel() {
  if (!pendingCsvMappingContext) return;
  const numberValue = (id) => Number($(id)?.value ?? -1);
  const config = {
    headerRowIndex: pendingCsvMappingContext.headerRowIndex,
    rawHeaders: pendingCsvMappingContext.headers,
    dateIndex: numberValue("csvMapDate"),
    descriptionIndex: numberValue("csvMapDescription"),
    amountIndex: numberValue("csvMapAmount"),
    debitIndex: numberValue("csvMapDebit"),
    creditIndex: numberValue("csvMapCredit")
  };
  if (config.dateIndex < 0 || config.descriptionIndex < 0 || (config.amountIndex < 0 && config.debitIndex < 0 && config.creditIndex < 0)) {
    toast("Selecciona fecha, concepto e importe/cargo/abono", "error");
    return;
  }
  pendingCsvProfileInfo = buildCsvProfileInfo(config);
  pendingCsvItems = parseCsvRowsWithConfig(pendingCsvMappingContext.rows, config);
  if (!pendingCsvItems.length) {
    toast("Con esas columnas no he encontrado movimientos válidos", "error");
    return;
  }
  pendingCsvMappingContext = null;
  renderCsvPreview();
}


async function parseBankPdf(arrayBuffer, password = "") {
  const lines = await extractPdfTextLines(arrayBuffer, password);
  const items = parsePdfBankLines(lines);
  if (!items.length) {
    throw new Error("no he encontrado movimientos en el PDF. Prueba a subir una página donde se vean fecha, concepto e importe.");
  }
  return items;
}

async function extractPdfTextLines(arrayBuffer, password = "") {
  const pdfjs = await loadPdfJs();
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: arrayBuffer, password }).promise;
  } catch (error) {
    if (error?.name === "PasswordException" || error?.code === 1 || error?.code === 2) {
      const normalized = new Error(error?.code === 2 ? "contraseña incorrecta" : "contraseña requerida");
      normalized.code = error?.code === 2 ? "INCORRECT_PASSWORD" : "NEED_PASSWORD";
      throw normalized;
    }
    throw error;
  }

  const allVisualLines = [];
  const plainLines = [];
  const rawPdfItems = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const grouped = [];
    content.items.forEach((item) => {
      const text = cleanDescription(item.str || "");
      if (!text) return;
      const x = item.transform?.[4] || 0;
      const y = item.transform?.[5] || 0;
      rawPdfItems.push({ pageNumber, x, y, text });
      let line = grouped.find((entry) => Math.abs(entry.y - y) < 3.8);
      if (!line) {
        line = { y, parts: [], pageNumber };
        grouped.push(line);
      }
      line.parts.push({ x, text });
    });

    const visualLines = grouped
      .sort((a, b) => b.y - a.y)
      .map((line) => {
        const parts = line.parts.sort((a, b) => a.x - b.x);
        const text = parts.map((part) => part.text).join(" ").replace(/\s+/g, " ").trim();
        return { pageNumber, y: line.y, parts, text, minX: parts[0]?.x || 0 };
      })
      .filter((line) => line.text);

    visualLines.forEach((line) => {
      plainLines.push(line.text);
      allVisualLines.push(line);
    });
  }

  // Para BBVA, las columnas visuales son mucho más fiables que el texto plano.
  // El texto plano puede juntar filas y quedarse solo con unas pocas entradas.
  // Por eso primero usamos posiciones reales: F. Oper. + Concepto + Importe.
  const bbvaLineRows = buildBbvaRowsFromVisualTextV2(rawPdfItems);
  const bbvaFullRows = buildBbvaRowsFromFullText(rawPdfItems, plainLines);
  const bbvaTokenRows = buildBbvaRowsFromTokenStream(rawPdfItems);
  const bbvaRawRows = buildBbvaRowsFromRawPdfItems(rawPdfItems);
  const bbvaRows = buildBbvaRowsFromVisualLines(allVisualLines);
  const bbvaPlainRows = buildBbvaRowsFromPlainLines(plainLines);

  const bbvaCandidates = [bbvaLineRows, bbvaFullRows, bbvaTokenRows, bbvaRawRows, bbvaRows, bbvaPlainRows].filter((rows) => rows.length);
  if (bbvaCandidates.length) {
    const bestRows = bbvaCandidates.sort((a, b) => b.length - a.length)[0];
    const yearMatch = plainLines.join(" ").match(/\b(20\d{2})\b/);
    return yearMatch ? [`01/01/${yearMatch[1]} 02/01/${yearMatch[1]}`, ...bestRows] : bestRows;
  }
  return plainLines;
}


function buildBbvaRowsFromVisualTextV2(rawItems) {
  // BBVA v2: parser por líneas visibles completas. No necesita que PDF.js separe
  // cada columna en tokens perfectos; si una línea contiene fecha, concepto,
  // importe, saldo y EUR, extrae SOLO F. Oper. + Concepto + Importe.
  const rows = [];
  const ignored = /saldo inicial|saldo fin de mes|saldo \d+ de|fecha\s+operaci|f\.\s*oper|f\.\s*valor|concepto|importe|divisa|viene de la hoja|avance de movimientos|iban\s|bic:|informe mensual|fecha de emisión|titular|d\.n\.i|movimientos de cuenta|movimientos en cuenta|atención bbva|banco bilbao|línea bbva|twitter|facebook|producto no excluido|fondo de garantía|cuenta:|260\d{9}/i;
  const headerRegex = /^\s*(\d{1,2}\s*[/-]\s*\d{1,2})\s+(\d{1,2}\s*[/-]\s*\d{1,2})\s+(.+?)\s+([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+,\d{2})\s+([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+,\d{2})\s+EUR\b/i;
  const startsNewHeader = /^\s*\d{1,2}\s*[/-]\s*\d{1,2}\s+\d{1,2}\s*[/-]\s*\d{1,2}\b/;
  const pages = new Map();

  const cleanDate = (value) => String(value || "").replace(/\s+/g, "");
  const cleanMoney = (value) => String(value || "").replace(/\s+/g, "");
  const finish = (current) => {
    if (!current || !current.operDate || !current.amount) return;
    const concept = cleanBankName(current.conceptParts.join(" ")) || "Movimiento BBVA";
    if (!concept || ignored.test(concept.slice(0, 80))) return;
    rows.push(`${current.operDate} ${current.operDate} ${concept} ${current.amount} 0,00 EUR`);
  };

  rawItems.forEach((item) => {
    const text = normalizePdfTextLine(item.text || "");
    if (!text) return;
    const page = Number(item.pageNumber || 1);
    if (!pages.has(page)) pages.set(page, []);
    pages.get(page).push({
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      text
    });
  });

  Array.from(pages.keys()).sort((a, b) => a - b).forEach((pageNumber) => {
    const grouped = [];
    (pages.get(pageNumber) || [])
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .forEach((item) => {
        // Tolerancia más amplia porque BBVA pinta fecha/concepto/importe con y ligeramente distinta.
        let line = grouped.find((entry) => Math.abs(entry.y - item.y) < 8.5);
        if (!line) {
          line = { y: item.y, parts: [] };
          grouped.push(line);
        }
        line.parts.push(item);
      });

    let current = null;
    grouped
      .sort((a, b) => b.y - a.y)
      .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" ").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .forEach((line) => {
        const cleanLine = normalizePdfTextLine(line);
        const header = cleanLine.match(headerRegex);
        if (header) {
          finish(current);
          current = {
            operDate: cleanDate(header[1]),
            amount: cleanMoney(header[4]),
            conceptParts: [header[3]]
          };
          return;
        }

        if (!current) return;
        if (startsNewHeader.test(cleanLine)) {
          finish(current);
          current = null;
          return;
        }
        if (ignored.test(cleanLine) || /\bEUR\b/i.test(cleanLine)) return;
        if (/^[-+]?\s*\d{1,3}(?:\.\d{3})*,\d{2}/.test(cleanLine)) return;

        // Detalle de la línea anterior: tarjeta, comercio, Bizum, préstamo, etc.
        const detail = cleanLine
          .replace(/\s+ES$/i, "")
          .replace(/\s+/g, " ")
          .trim();
        if (detail && detail.length > 2) current.conceptParts.push(detail);
      });
    finish(current);
  });

  // Quita duplicados exactos generados por tolerancias de línea.
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row)) return false;
    seen.add(row);
    return true;
  });
}

function buildBbvaRowsFromFullText(rawItems, plainLines = []) {
  // Conversor BBVA robusto: no depende de columnas ni de líneas perfectas.
  // Reconstruye todo el texto visual y corta cada movimiento desde:
  // F. Oper. + F. Valor + Concepto + Importe + Saldo + EUR
  // Luego DESCARTA F. Valor y Saldo, y genera filas internas tipo CSV.
  const ignoredBlock = /saldo inicial|saldo fin de mes|saldo \d+ de|fecha\s+operaci|f\.\s*oper|f\.\s*valor|concepto|importe|divisa|viene de la hoja anterior|avance de movimientos|iban\s|bic:|atención bbva|banco bilbao|línea bbva|twitter|facebook|producto no excluido|fondo de garantía|cuenta:/i;
  const datePair = /(\d{1,2}\s*[/-]\s*\d{1,2})\s+(\d{1,2}\s*[/-]\s*\d{1,2})\s+/g;
  const moneyRegex = /[+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+,\d{2}/g;
  const rows = [];

  const cleanDate = (value) => String(value || '').replace(/\s+/g, '');
  const cleanMoney = (value) => String(value || '').replace(/\s+/g, '');
  const normalizeBlock = (value) => normalizePdfTextLine(value || '')
    .replace(/\bEUR\b/gi, ' EUR ')
    .replace(/\s+/g, ' ')
    .trim();

  const visualText = (() => {
    const grouped = [];
    rawItems
      .map((item) => ({
        page: Number(item.pageNumber || 1),
        x: Number(item.x || 0),
        y: Number(item.y || 0),
        text: normalizePdfTextLine(item.text || '')
      }))
      .filter((item) => item.text)
      .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
      .forEach((item) => {
        let line = grouped.find((entry) => entry.page === item.page && Math.abs(entry.y - item.y) < 5.5);
        if (!line) {
          line = { page: item.page, y: item.y, parts: [] };
          grouped.push(line);
        }
        line.parts.push(item);
      });
    return grouped
      .sort((a, b) => a.page - b.page || b.y - a.y)
      .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '))
      .join('\n');
  })();

  const sources = [visualText, plainLines.join('\n')]
    .map(normalizeBlock)
    .filter(Boolean);

  const parseSource = (source) => {
    const matches = [...source.matchAll(datePair)];
    const parsedRows = [];
    matches.forEach((match, index) => {
      const start = match.index || 0;
      const end = index + 1 < matches.length ? (matches[index + 1].index || source.length) : source.length;
      let block = source.slice(start, end).replace(/\s+/g, ' ').trim();
      if (!block || ignoredBlock.test(block.slice(0, 90))) return;

      const head = block.match(/^(\d{1,2}\s*[/-]\s*\d{1,2})\s+(\d{1,2}\s*[/-]\s*\d{1,2})\s+(.*)$/);
      if (!head) return;
      const operDate = cleanDate(head[1]);
      let rest = head[3] || '';

      const moneyMatches = [...rest.matchAll(moneyRegex)].map((m) => ({ text: cleanMoney(m[0]), index: m.index || 0 }));
      if (moneyMatches.length < 2) return;

      // En BBVA el primer importe con coma dentro del bloque es la columna Importe.
      // El segundo suele ser Saldo y se ignora.
      const amount = moneyMatches[0].text;
      const amountIndex = moneyMatches[0].index;
      let conceptMain = rest.slice(0, amountIndex).trim();

      // El detalle suele venir después de "Importe Saldo EUR" y antes del siguiente movimiento.
      let detail = rest.slice(moneyMatches[1].index + moneyMatches[1].text.length)
        .replace(/\bEUR\b/gi, ' ')
        .replace(moneyRegex, ' ')
        .replace(/\bInforme mensual\b.*$/i, ' ')
        .replace(/\bAtención BBVA:.*$/i, ' ')
        .replace(/\bBANCO BILBAO.*$/i, ' ')
        .trim();

      let concept = cleanBankName(`${conceptMain} ${detail}`)
        .replace(/\bMarzo\s+20\d{2}\b/gi, ' ')
        .replace(/\bAbril\s+20\d{2}\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!concept || /^saldo/i.test(concept) || ignoredBlock.test(concept.slice(0, 60))) return;
      parsedRows.push(`${operDate} ${operDate} ${concept} ${amount} 0,00 EUR`);
    });
    return parsedRows;
  };

  sources.forEach((source) => {
    const parsed = parseSource(source);
    if (parsed.length > rows.length) {
      rows.length = 0;
      rows.push(...parsed);
    }
  });

  return rows;
}




function buildBbvaRowsFromTokenStream(rawItems) {
  // Conversor interno BBVA: PDF -> filas CSV normalizadas.
  // Lee el documento como secuencia visual de tokens y extrae SOLO:
  // F. Oper. + Concepto completo + Importe. Ignora F. Valor, Saldo y Divisa.
  const ignored = /saldo inicial|saldo fin|saldo \d+ de|fecha\s+operaci|f\.\s*oper|f\.\s*valor|concepto|importe|divisa|viene de la hoja|avance de movimientos|iban\s|bbva|informe mensual|fecha de emisión|titular|d\.n\.i|bic:|movimientos de cuenta|movimientos en cuenta|atención bbva|banco bilbao|línea bbva|twitter|facebook|producto no excluido|fondo de garantía|cuenta:|http/i;
  const dateRegex = /^\d{1,2}[/-]\d{1,2}$/;
  const moneyRegex = /^[+-]?\d{1,3}(?:\.\d{3})*,\d{2}$|^[+-]?\d+,\d{2}$/;
  const rows = [];
  const tokens = rawItems
    .map((item) => ({
      page: Number(item.pageNumber || 1),
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      text: normalizePdfTextLine(item.text || "")
    }))
    .filter((item) => item.text && !ignored.test(item.text))
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);

  let i = 0;
  const cleanToken = (value) => normalizePdfTextLine(value || "");
  const isDate = (value) => dateRegex.test(cleanToken(value));
  const isMoney = (value) => moneyRegex.test(cleanToken(value));
  const isEur = (value) => /^EUR$/i.test(cleanToken(value));

  while (i < tokens.length) {
    const first = tokens[i];
    const second = tokens[i + 1];
    if (!first || !second || !isDate(first.text) || !isDate(second.text)) {
      i += 1;
      continue;
    }

    const operDate = cleanToken(first.text);
    let j = i + 2;
    const conceptParts = [];
    let amount = "";

    while (j < tokens.length) {
      const token = tokens[j];
      const next = tokens[j + 1];
      const next2 = tokens[j + 2];

      // Nueva fila: fecha oper + fecha valor antes de encontrar importe.
      // Cerramos la fila actual como incompleta y seguimos desde esa fecha.
      if (next && isDate(token.text) && isDate(next.text) && !amount) break;

      // BBVA al final de cada movimiento trae: Importe + Saldo + EUR.
      // Cogemos el primero como Importe y descartamos el segundo como Saldo.
      if (isMoney(token.text) && next && isMoney(next.text) && next2 && isEur(next2.text)) {
        amount = cleanToken(token.text);
        j += 3;
        break;
      }

      // Algunas filas pueden traer: Importe + Saldo + (EUR separado raro o ausente)
      if (isMoney(token.text) && next && isMoney(next.text)) {
        amount = cleanToken(token.text);
        j += 2;
        if (tokens[j] && isEur(tokens[j].text)) j += 1;
        break;
      }

      if (!isEur(token.text) && !isMoney(token.text) && !isDate(token.text)) {
        conceptParts.push(token.text);
      }
      j += 1;
    }

    if (operDate && amount && conceptParts.length) {
      const concept = cleanBankName(conceptParts.join(" ")) || "Movimiento BBVA";
      // Fila interna compatible con parsePdfBankLines: fecha oper duplicada, concepto, importe y saldo dummy.
      rows.push(`${operDate} ${operDate} ${concept} ${amount} 0,00 EUR`);
      i = Math.max(j, i + 1);
    } else {
      i += 1;
    }
  }

  return rows;
}

function buildBbvaRowsFromRawPdfItems(rawItems) {
  // Parser BBVA por filas reales del PDF. Usa SOLO F. Oper. + Concepto + Importe.
  // F. Valor, Saldo y Divisa se ignoran completamente para evitar mezclar meses o coger saldos como importes.
  const rows = [];
  const ignored = /saldo inicial|saldo fin|saldo \d+ de|fecha\s+operaci|f\.\s*oper|f\.\s*valor|concepto|importe|divisa|viene de la hoja|avance de movimientos|iban\s|bbva|informe mensual|fecha de emisión|titular|d\.n\.i|bic:|movimientos de cuenta|movimientos en cuenta|atención bbva|banco bilbao|línea bbva|twitter|facebook|producto no excluido|fondo de garantía|cuenta:|saldo\s+\d+\s+de\s+/i;
  const dateRegex = /^\d{1,2}[/-]\d{1,2}$/;
  const moneyRegex = /^[+-]?\d{1,3}(?:\.\d{3})*,\d{2}$|^[+-]?\d+,\d{2}$/;
  const eurRegex = /^EUR$/i;
  const pages = new Map();

  rawItems.forEach((item) => {
    const text = normalizePdfTextLine(item.text || '');
    if (!text) return;
    const page = Number(item.pageNumber || 1);
    if (!pages.has(page)) pages.set(page, []);
    pages.get(page).push({ x: Number(item.x || 0), y: Number(item.y || 0), text });
  });

  const lineText = (parts) => parts.map((part) => part.text).join(' ').replace(/\s+/g, ' ').trim();
  const finish = (current) => {
    if (!current || !current.operDate || !current.amount) return;
    const concept = cleanBankName(current.conceptParts.join(' ')) || 'Movimiento BBVA';
    rows.push(`${current.operDate} ${current.operDate} ${concept} ${current.amount} 0,00 EUR`);
  };

  Array.from(pages.keys()).sort((a, b) => a - b).forEach((pageNumber) => {
    const pageItems = pages.get(pageNumber) || [];
    const grouped = [];
    pageItems.forEach((item) => {
      let line = grouped.find((entry) => Math.abs(entry.y - item.y) < 4.8);
      if (!line) {
        line = { y: item.y, parts: [] };
        grouped.push(line);
      }
      line.parts.push(item);
    });

    let current = null;
    grouped
      .sort((a, b) => b.y - a.y)
      .map((line) => ({
        y: line.y,
        parts: line.parts.sort((a, b) => a.x - b.x),
      }))
      .forEach((line) => {
        const parts = line.parts;
        const text = lineText(parts);
        if (!text || ignored.test(text)) return;

        const dateParts = parts.filter((part) => dateRegex.test(part.text));
        const moneyParts = parts.filter((part) => moneyRegex.test(part.text));
        const hasEur = parts.some((part) => eurRegex.test(part.text));

        // Fila principal BBVA: empieza con F. Oper. y F. Valor, y termina con Importe + Saldo + EUR.
        // Nos quedamos con la primera fecha y con el penúltimo importe visible, que es la columna Importe.
        if (dateParts.length >= 2 && moneyParts.length >= 2 && hasEur) {
          finish(current);
          const operDate = dateParts[0].text;
          const amountPart = moneyParts[moneyParts.length - 2];
          const amount = amountPart.text;
          const conceptParts = parts
            .filter((part) => part.x > 95 && part.x < amountPart.x - 3)
            .filter((part) => !dateRegex.test(part.text) && !moneyRegex.test(part.text) && !eurRegex.test(part.text))
            .map((part) => part.text);
          current = { operDate, amount, conceptParts };
          return;
        }

        if (!current) return;

        // Línea secundaria del concepto: tarjeta, comercio, Bizum, préstamo, etc.
        // Normalmente está en la columna Concepto, sin importe ni EUR.
        if (!hasEur && !moneyParts.length) {
          const continuation = parts
            .filter((part) => part.x > 95 && part.x < 390)
            .map((part) => part.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (continuation && !ignored.test(continuation) && !dateRegex.test(continuation)) {
            current.conceptParts.push(continuation);
          }
        }
      });
    finish(current);
  });

  return rows;
}

function buildBbvaRowsFromPlainLines(lines) {
  // BBVA fiable: no usamos F. Valor ni Saldo. Solo F. Oper. + Concepto + Importe.
  // Esta función parsea el texto secuencial del PDF y crea filas normalizadas para el importador.
  const rows = [];
  let current = null;
  let stagedOperDate = "";
  const ignored = /saldo inicial|saldo fin|saldo \d+ de|fecha\s+operaci|f\.\s*oper|f\.\s*valor|concepto|importe|divisa|viene de la hoja|avance de movimientos|iban\s|bbva|informe mensual|fecha de emisión|titular|d\.n\.i|bic:|movimientos de cuenta|movimientos en cuenta|atención bbva|banco bilbao|línea bbva|twitter|facebook|producto no excluido|fondo de garantía|cuenta:/i;
  const dateOnly = /^\s*(\d{1,2}\s*[/-]\s*\d{1,2})\s*$/;
  const twoDates = /^\s*(\d{1,2}\s*[/-]\s*\d{1,2})\s+(\d{1,2}\s*[/-]\s*\d{1,2})\s*(.*)$/;
  const moneyRegex = /[+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+,\d{2}/g;

  const cleanDate = (value) => (value || "").replace(/\s+/g, "");
  const firstMoney = (text) => {
    const matches = [...String(text || "").matchAll(moneyRegex)].map((match) => ({ text: match[0].replace(/\s+/g, ""), index: match.index || 0 }));
    return matches[0] || null;
  };
  const finish = () => {
    if (!current || !current.operDate || !current.amount) {
      current = null;
      return;
    }
    const concept = cleanBankName(current.conceptParts.join(" ")) || "Movimiento BBVA";
    rows.push(`${current.operDate} ${current.operDate} ${concept} ${current.amount} 0,00 EUR`);
    current = null;
  };
  const appendConceptUntilAmount = (text) => {
    const money = firstMoney(text);
    if (money) {
      const beforeMoney = String(text || "").slice(0, money.index).trim();
      if (beforeMoney) current.conceptParts.push(beforeMoney);
      current.amount = money.text;
      finish();
      return true;
    }
    const clean = normalizePdfTextLine(text);
    if (clean && !ignored.test(clean) && !/^EUR$/i.test(clean)) current.conceptParts.push(clean);
    return false;
  };

  lines.map(normalizePdfTextLine).forEach((line) => {
    if (!line || ignored.test(line) || /^EUR$/i.test(line)) return;

    const dateLine = line.match(dateOnly);
    if (dateLine) {
      // En texto extraído por bloques, BBVA puede soltar F. Oper. y F. Valor en líneas separadas.
      if (!stagedOperDate) {
        finish();
        stagedOperDate = cleanDate(dateLine[1]);
      } else if (!current) {
        current = { operDate: stagedOperDate, conceptParts: [], amount: "" };
        stagedOperDate = "";
      }
      return;
    }

    const rowStart = line.match(twoDates);
    if (rowStart) {
      finish();
      stagedOperDate = "";
      current = { operDate: cleanDate(rowStart[1]), conceptParts: [], amount: "" };
      appendConceptUntilAmount(rowStart[3] || "");
      return;
    }

    if (!current) return;
    appendConceptUntilAmount(line);
  });
  finish();
  return rows;
}

function buildBbvaRowsFromVisualLines(visualLines) {
  // Parser específico para extractos BBVA: usa columnas reales, no “adivina” por texto.
  // Columnas: F. Oper. | F. Valor | Concepto | Importe | Saldo | Divisa.
  const rows = [];
  let current = null;
  const ignored = /saldo inicial|saldo final|fecha\s+operaci|f\.\s*oper|f\.\s*valor|concepto|importe|divisa|viene de la hoja|avance de movimientos|iban\s|bbva|informe mensual|fecha de emisión|titular|d\.n\.i|bic:|movimientos de cuenta|movimientos en cuenta|atención bbva|banco bilbao|línea bbva|twitter|facebook|producto no excluido|fondo de garantía|cuenta:/i;

  const textOf = (parts, minX, maxX = Infinity) => parts
    .filter((part) => part.x >= minX && part.x < maxX)
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const findDateInColumn = (parts, minX, maxX) => {
    const text = textOf(parts, minX, maxX);
    const match = text.match(/\b\d{1,2}\s*[/-]\s*\d{1,2}\b/);
    return match ? match[0].replace(/\s+/g, "") : "";
  };

  const findMoneyInColumn = (parts, minX, maxX) => {
    const text = textOf(parts, minX, maxX);
    const matches = [...text.matchAll(/[+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+,\d{2}/g)]
      .map((match) => match[0].replace(/\s+/g, ""));
    return matches[0] || "";
  };

  const finish = () => {
    if (!current) return;
    const concept = current.conceptParts.join(" ").replace(/\s+/g, " ").trim();
    if (current.operDate && current.amount && concept) {
      rows.push(`${current.operDate} ${current.valueDate || current.operDate} ${concept} ${current.amount} ${current.saldo || "0,00"} EUR`);
    }
    current = null;
  };

  visualLines.forEach((visualLine) => {
    const parts = (visualLine.parts || [])
      .map((part) => ({ x: Number(part.x || 0), text: normalizePdfTextLine(part.text || "") }))
      .filter((part) => part.text)
      .sort((a, b) => a.x - b.x);
    const line = normalizePdfTextLine(parts.map((part) => part.text).join(" "));
    if (!line || ignored.test(line)) return;
    if (/^saldo\s+\d+\s+de\s+/i.test(line)) return;
    if (/^\d+\s+de\s+\d+\s+260\d+/i.test(line)) return;

    const operDate = findDateInColumn(parts, 0, 58);
    const valueDate = findDateInColumn(parts, 58, 110);
    const amount = findMoneyInColumn(parts, 390, 468);
    const saldo = findMoneyInColumn(parts, 468, 528);
    const conceptLine = textOf(parts, 110, 390);

    // Nueva fila de movimiento BBVA. La fecha buena para la app es F. Oper.
    if (operDate && valueDate) {
      finish();
      current = {
        operDate,
        valueDate,
        amount,
        saldo,
        conceptParts: conceptLine ? [conceptLine] : []
      };
      // Si el importe está en otra línea por cualquier motivo, esperamos a completarla.
      if (amount && /\bEUR\b/i.test(line)) {
        // No finalizamos todavía: la siguiente línea puede ser el detalle de tarjeta/Bizum/etc.
      }
      return;
    }

    if (!current) return;

    // Línea de detalle del concepto, normalmente empieza en la columna Concepto.
    const continuation = textOf(parts, 110, 390) || textOf(parts, 100, 405);
    if (continuation && !/^[-+]?\d/.test(continuation) && !/\bEUR\b/i.test(continuation)) {
      current.conceptParts.push(continuation);
      return;
    }

    // Algunos PDF dejan importe/saldo en una segunda línea. No usamos nunca el saldo como importe.
    if (!current.amount) {
      const extraAmount = findMoneyInColumn(parts, 390, 468);
      const extraSaldo = findMoneyInColumn(parts, 468, 528);
      if (extraAmount) current.amount = extraAmount;
      if (extraSaldo) current.saldo = extraSaldo;
    }
  });
  finish();
  return rows;
}

function looksLikeCompleteBankMovement(line) {
  if (!startsWithBankDates(line)) return false;
  const moneyMatches = extractPdfMoneyMatches(line, extractPdfDates(line, new Date().getFullYear()));
  // BBVA: siempre hay importe del movimiento + saldo + EUR. Si la línea solo trae un importe,
  // también la aceptamos para bancos más simples, pero BBVA normalmente tendrá dos.
  return moneyMatches.length >= 1 && /\bEUR\b/i.test(line);
}

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (window.__pdfJsLoading) return window.__pdfJsLoading;
  window.__pdfJsLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const lib = window.pdfjsLib || globalThis.pdfjsLib;
      if (!lib) {
        reject(new Error("no se ha cargado el lector PDF"));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(lib);
    };
    script.onerror = () => reject(new Error("no he podido cargar el lector PDF. Necesitas conexión a internet para importar PDF."));
    document.head.appendChild(script);
  });
  return window.__pdfJsLoading;
}

function parsePdfBankLines(lines) {
  const existing = new Set((pendingImportResetData ? [] : state.expenses).map(transactionKey));
  const year = detectPdfStatementYear(lines) || Number(selectedMonth.split("-")[0]) || new Date().getFullYear();
  const movements = [];
  let last = null;
  let pending = "";
  const ignored = /saldo inicial|saldo final|fecha\s+operaci|f\.\s*oper|f\.\s*valor|concepto|importe|divisa|^eur$|^pagina|^página|viene de la hoja|avance de movimientos/i;

  const flushPending = () => {
    if (!pending) return;
    const parsed = parsePdfMovementLine(pending, year);
    if (parsed) {
      movements.push(parsed);
      last = parsed;
    }
    pending = "";
  };

  lines.forEach((line) => {
    const cleanLine = normalizePdfTextLine(line);
    if (!cleanLine || ignored.test(cleanLine)) return;

    // BBVA y otros bancos a veces separan la fila en dos líneas: fechas + concepto / detalle + importes.
    if (pending) {
      const candidate = `${pending} ${cleanLine}`;
      const parsed = parsePdfMovementLine(candidate, year);
      if (parsed) {
        movements.push(parsed);
        last = parsed;
        pending = "";
        return;
      }
      if (startsWithBankDates(cleanLine)) {
        flushPending();
      } else {
        pending = candidate;
        return;
      }
    }

    const movement = parsePdfMovementLine(cleanLine, year);
    if (movement) {
      movements.push(movement);
      last = movement;
    } else if (startsWithBankDates(cleanLine)) {
      pending = cleanLine;
    } else if (last && shouldAppendPdfContinuation(cleanLine)) {
      last.description = cleanBankName(`${last.description} ${cleanLine}`);
    }
  });
  flushPending();

  const importMovements = pendingImportResetData ? movements : (() => {
    const uniqueMovements = [];
    const seenMovements = new Set();
    movements.forEach((movement) => {
      const key = `${movement.date}|${Number(movement.amount).toFixed(2)}|${normalizeHeader(movement.description).slice(0, 80)}`;
      if (seenMovements.has(key)) return;
      seenMovements.add(key);
      uniqueMovements.push(movement);
    });
    return uniqueMovements;
  })();

  return importMovements.map((movement, index) => {
    const classified = classifyBankMovement(movement.description, movement.amount);
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : `pdf-${Date.now()}-${index}`,
      name: classified.name,
      amount: Math.abs(movement.amount),
      date: movement.date,
      category: classified.category,
      type: movement.amount >= 0 || classified.type === "income" ? "income" : "expense",
      createdAt: Date.now() + index,
      source: "pdf",
      raw: { description: movement.description, amount: movement.amount }
    };
    item.duplicate = existing.has(transactionKey(item));
    return item;
  });
}

function startsWithBankDates(line) {
  return /^\s*\d{1,2}\s*[/-]\s*\d{1,2}\s+\d{1,2}\s*[/-]\s*\d{1,2}/.test(line);
}

function detectPdfStatementYear(lines) {
  const joined = lines.join(" ");
  const range = joined.match(/\b\d{2}\/\d{2}\/(20\d{2})\s*→\s*\d{2}\/\d{2}\/(20\d{2})\b/);
  if (range) return Number(range[2] || range[1]);
  const any = joined.match(/\b\d{1,2}\/\d{1,2}\/(20\d{2})\b/);
  return any ? Number(any[1]) : null;
}

function shouldAppendPdfContinuation(line) {
  if (!line || /^[-+]?\s*[\d.,]+\s*(eur)?$/i.test(line)) return false;
  if (/saldo|total|anterior|siguiente/i.test(line)) return false;
  return line.length > 3;
}

function normalizePdfTextLine(line) {
  let text = cleanDescription(line)
    .replace(/\b([A-ZÁÉÍÓÚÑ])(?:\s+([A-ZÁÉÍÓÚÑ])){3,}\b/g, (match) => match.replace(/\s+/g, ""))
    .replace(/([+-])\s+(\d)/g, "$1$2")
    .replace(/(\d)\s+,\s*(\d{2})/g, "$1,$2")
    .replace(/(\d)\s+\.\s+(\d{3})/g, "$1.$2");
  return cleanDescription(text);
}

function cleanBankName(value) {
  let text = normalizePdfTextLine(value)
    .replace(/\bEUR\b/gi, "")
    .replace(/\bES\b$/i, "")
    .replace(/\s+-\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // No resumimos el concepto del banco: mantenemos el texto completo de la línea
  // para que puedas reconocer cada cargo exactamente como aparece en BBVA.
  return cleanDescription(text);
}

function parsePdfMovementLine(line, year) {
  const dateMatches = extractPdfDates(line, year);
  if (!dateMatches.length) return null;

  const moneyMatches = extractPdfMoneyMatches(line, dateMatches);
  if (!moneyMatches.length) return null;

  const amountCandidate = choosePdfAmount(moneyMatches);
  const amount = parseMoney(amountCandidate.text);
  if (!amount) return null;

  const chosenDate = dateMatches[0];
  const date = chosenDate.date;

  const descriptionStart = (dateMatches[1]?.end ?? dateMatches[0].end);
  const amountStart = amountCandidate.index;
  let description = line.slice(descriptionStart, amountStart).trim();
  dateMatches.forEach((match) => {
    description = description.replace(match.text, " ");
  });
  moneyMatches.forEach((match) => {
    if (match.index < amountStart) description = description.replace(match.text, " ");
  });
  description = cleanBankName(description || line.slice(dateMatches[0].end, amountStart));
  if (!description) description = "Movimiento banco";
  return { date, description, amount };
}

function extractPdfDates(line, fallbackYear) {
  const results = [];
  const pushDate = (text, index, day, month, rawYear = "") => {
    const d = Number(day);
    const m = Number(month);
    if (!d || !m || d > 31 || m > 12) return;
    let fullYear = rawYear || String(fallbackYear);
    if (fullYear.length === 2) fullYear = `20${fullYear}`;
    if (!/^\d{4}$/.test(fullYear)) fullYear = String(fallbackYear);
    results.push({ text, index, end: index + text.length, date: `${fullYear}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  };

  // En BBVA las fechas buenas están al principio: F. Oper. y F. Valor.
  // Limitamos la búsqueda para no confundir códigos tipo "1/03" dentro del concepto.
  const head = line.slice(0, 42);
  [...head.matchAll(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?\b/g)].forEach((match) => {
    pushDate(match[0], match.index || 0, match[1], match[2], match[3] || "");
  });

  // Algunos PDF separan los dígitos: "0 4 0 5" al inicio de la fila.
  const compactHead = line.slice(0, 18);
  [...compactHead.matchAll(/\b(\d)\s*(\d)\s*(\d)\s*(\d)\b/g)].forEach((match) => {
    const compact = `${match[1]}${match[2]}/${match[3]}${match[4]}`;
    if (!results.some((item) => Math.abs(item.index - (match.index || 0)) < 3)) {
      pushDate(compact, match.index || 0, `${match[1]}${match[2]}`, `${match[3]}${match[4]}`, "");
    }
  });

  return results.sort((a, b) => a.index - b.index).slice(0, 2);
}

function extractPdfMoneyMatches(line, dateMatches = []) {
  const matches = [...line.matchAll(/[+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+,\d{2}/g)]
    .map((match) => ({ text: match[0].replace(/\s+/g, ""), index: match.index || 0 }))
    .filter((match) => !dateMatches.some((date) => rangesOverlap(match.index, match.index + match.text.length, date.index, date.end)));
  return matches;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function choosePdfAmount(moneyMatches) {
  const signed = moneyMatches.filter((match) => /^[+-]/.test(match.text));
  if (signed.length) return signed[0];
  if (moneyMatches.length >= 2) return moneyMatches[moneyMatches.length - 2];
  return moneyMatches[0];
}

function parseCsvRows(text) {
  const delimiter = detectDelimiter(text.split(/\r?\n/)[0] || "");
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value.trim());
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(line) {
  const candidates = [";", ",", "\t"];
  return candidates.map((delimiter) => ({ delimiter, count: line.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function normalizeHeader(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function findHeader(headers, names) {
  return headers.findIndex((header) => names.some((name) => header === normalizeHeader(name) || header.includes(normalizeHeader(name))));
}

function parseMoney(value) {
  let text = String(value || "").replace(/€/g, "").replace(/\s/g, "").trim();
  if (!text) return 0;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/-$/.test(text)) {
    negative = true;
    text = text.slice(0, -1);
  }
  if (/^(D|DEBE|DEBITO|DEBIT|CARGO)/i.test(text) || /(D|DEBE|DEBITO|DEBIT|CARGO)$/i.test(text)) negative = true;
  if (/^(H|HABER|CREDITO|CREDIT|ABONO)/i.test(text) || /(H|HABER|CREDITO|CREDIT|ABONO)$/i.test(text)) negative = false;
  text = text.replace(/[^0-9,.-]/g, "");
  if (!text || text === "-" || text === ",") return 0;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized;
  if (lastComma > lastDot) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = text.replace(/,/g, "");
  } else {
    normalized = text;
  }
  const number = Number(normalized);
  if (!Number.isFinite(number)) return 0;
  return negative ? -Math.abs(number) : number;
}

function resolveAmount(row, amountIndex, debitIndex, creditIndex) {
  const debit = debitIndex >= 0 ? Math.abs(parseMoney(row[debitIndex])) : 0;
  const credit = creditIndex >= 0 ? Math.abs(parseMoney(row[creditIndex])) : 0;
  if (amountIndex >= 0) {
    const amount = parseMoney(row[amountIndex]);
    if (amount) return amount;
  }
  if (credit) return credit;
  if (debit) return -debit;
  return 0;
}


function parseCsvDate(value) {
  const text = String(value || "").trim();
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  return "";
}

function cleanDescription(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function findCustomRule(description, type) {
  const text = normalizeHeader(description);
  return (state.rules || [])
    .filter((rule) => rule.type === type && text.includes(normalizeHeader(rule.keyword)))
    .sort((a, b) => normalizeHeader(b.keyword).length - normalizeHeader(a.keyword).length)[0];
}

function addRuleFromMovement(item) {
  const source = item.raw?.description || item.originalDescription || item.name;
  const keyword = suggestRuleKeyword(source, item.name);
  if (!keyword) return;
  state.rules = state.rules || [];
  const normalizedKeyword = normalizeHeader(keyword);
  const existing = state.rules.find((rule) => normalizeHeader(rule.keyword) === normalizedKeyword && rule.type === item.type);
  if (existing) {
    existing.category = item.category;
    existing.name = item.name;
    return;
  }
  state.rules.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    keyword,
    category: item.category,
    name: item.name,
    type: item.type
  });
}

function suggestRuleKeyword(source, cleanName = "") {
  const raw = cleanDescription(source || cleanName);
  const paypal = raw.match(/PAYPAL\s*\*\s*([A-Z0-9ÁÉÍÓÚÑ ._-]{3,35})/i);
  if (paypal) return `PAYPAL *${paypal[1].replace(/\s+/g, " ").trim()}`.slice(0, 50);
  const amazon = raw.match(/(?:WWW\.)?AMAZON\*?\s*([A-Z0-9]{4,})?/i);
  if (amazon) return "AMAZON";
  const simpleMatches = [
    /REPSOL\s+WAYLET/i, /BON\s*PREU/i, /BASIC\s*-?\s*FIT/i, /METLIFE/i, /SABADELL\s+CONSUMER/i,
    /MES\s+PARKING/i, /ADAM\s+ECOTECH/i, /PANINI/i, /PLAYSTATION/i, /NETFLIX/i, /SPOTIFY/i
  ];
  for (const regex of simpleMatches) {
    const match = raw.match(regex);
    if (match) return titleCaseSmart(match[0]).slice(0, 50);
  }
  return cleanDescription(cleanName || raw)
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9 +._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ")
    .slice(0, 35);
}

function openRuleDialog(rule = null) {
  $("ruleForm").reset();
  $("ruleType").value = rule?.type || "expense";
  fillRuleCategoryOptions(rule?.category);
  $("ruleKeyword").value = rule?.keyword || "";
  if ($("ruleName")) $("ruleName").value = rule?.name || "";
  $("ruleDialog").showModal();
}

function fillRuleCategoryOptions(selected = "") {
  const options = $("ruleType").value === "income" ? incomeCategories() : expenseCategories();
  $("ruleCategory").innerHTML = options.map((category) => `<option>${category}</option>`).join("");
  if (selected && options.includes(selected)) $("ruleCategory").value = selected;
}

function classifyBankMovement(description, amount) {
  const original = cleanDescription(description);
  const text = normalizeHeader(original);
  const isIncome = amount >= 0;
  const customRule = findCustomRule(original, isIncome ? "income" : "expense");
  const niceName = shortName(original, original);
  if (customRule) return { type: customRule.type, category: customRule.category, name: customRule.name || niceName };

  if (text.includes("bizum")) {
    return isIncome
      ? { type: "income", category: "Bizum recibido", name: niceName || "Bizum recibido" }
      : { type: "expense", category: "Otros", name: niceName || "Bizum enviado" };
  }

  if (isIncome && /nomina|nomina por transferencia|salario|payroll/.test(text)) {
    return { type: "income", category: "Nómina", name: niceName.includes("ADAM") ? "Nómina ADAM" : "Nómina" };
  }
  if (isIncome && /(devolucion|reembolso|refund|abono|pago con tarjeta|amazon|paypal|tarjeta)/.test(text)) {
    return { type: "income", category: "Devolución", name: niceName.startsWith("Devolución") ? niceName : `Devolución ${niceName}`.trim() };
  }
  if (isIncome) return { type: "income", category: "Otros ingresos", name: niceName || "Ingreso" };

  const smartRules = [
    [/amazon\s*prime|prime\s*video|netflix|spotify|disney|hbo|max\b|youtube|icloud|apple\.com\/bill|apple com bill|dazn|game\s*pass|ps\s*plus|playstation\s*plus|google\s*microsoft|microsoft\s*365|office\s*365/, "Suscripciones"],
    [/supermercado|supermcat|bon\s*preu|bonpreu|mercadona|carrefour|lidl|aldi|alcampo|consum|supercor|dia\b|eroski|condis|caprabo/, "Alimentación"],
    [/restaurante|restaurantes|cafeteria|cafeterias|cafe\b|bar\b|tagliatella|desvan\s*de\s*japon|burger|mcdonald|kfc|glovo|just\s*eat|uber\s*eats|majareta|splau/, "Alimentación"],
    [/repsol|waylet|cepsa|bp\b|shell|galp|gasolinera|renfe|metro|taxi|uber\b|cabify|parking|aparcamiento|peaje/, "Transporte"],
    [/iberdrola|endesa|naturgy|agua|luz|gas\b|alquiler|hipoteca|comunidad|amortizacion\s*de\s*prestamo|prestamo|credito|sabadell\s*consumer/, "Vivienda"],
    [/farmacia|hospital|clinica|clinica|dentista|salud|basic\s*fit|metlife|seguro\s*medico|seguro/, "Salud"],
    [/playstation|steam|xbox|nintendo|panini|game\b|cine|ticketmaster|entradas/, "Ocio"],
    [/amazon|zara|pull\s*bear|decathlon|mediamarkt|media\s*markt|el\s*corte\s*ingles|ikea|aliexpress|planeta\s*deag|plantadeag/, "Compras"],
  ];
  const category = smartRules.find(([regex]) => regex.test(text))?.[1] || "Otros";
  return { type: "expense", category, name: niceName || "Movimiento banco" };
}

function titleCaseSmart(value) {
  return cleanDescription(value)
    .toLowerCase()
    .replace(/\b([a-záéíóúñ])/g, (m) => m.toUpperCase())
    .replace(/\bBbva\b/g, "BBVA")
    .replace(/\bAdam\b/g, "ADAM")
    .replace(/\bPaypal\b/g, "PayPal")
    .replace(/\bAmazon\b/g, "Amazon")
    .replace(/\bNetflix\b/g, "Netflix")
    .replace(/\bRepsol\b/g, "Repsol")
    .replace(/\bWaylet\b/g, "Waylet")
    .replace(/\bBasic Fit\b/g, "Basic-Fit")
    .replace(/\bMetlife\b/g, "MetLife")
    .replace(/\bPlaystation\b/g, "PlayStation");
}

function cleanImportedConcept(description, fallback = "Movimiento banco") {
  let text = cleanDescription(description || fallback)
    .replace(/\b\d{4,6}\*{2,}\d{2,}\b/g, " ")
    .replace(/\b\d{4,6}\*{2,}\d{2,}[A-Z0-9*./ -]*/g, (match) => match.replace(/^\d{4,6}\*{2,}\d{2,}/, " "))
    .replace(/\bPAGO\s+CON\s+TARJETA\s+DE\s+/gi, "")
    .replace(/\bPAGO\s+CON\s+TARJETA\s+EN\s+/gi, "")
    .replace(/\bADEUDO\s+A\s+SU\s+CARGO\b/gi, "")
    .replace(/\bABONO\s+DE\s+NOMINA\s+POR\s+TRANSFERENCIA\b/gi, "Nómina")
    .replace(/\bCARGO\s+POR\s+AMORTIZACION\s+DE\s+PRESTAMO\/?CREDITO\b/gi, "Préstamo / Crédito")
    .replace(/\bRET\.\s*EFECTIVO\s+A\s+DEBITO\s+CON\s+TARJ\.\s+EN\s+CAJERO\.\s+AUT\.?/gi, "Retirada efectivo cajero")
    .replace(/\bTRANSFERENCIAS\b/gi, "Transferencia")
    .replace(/\bRESTAURANTES\s+Y\s+CAFETERIAS\b/gi, "")
    .replace(/\bCOMPRAS\s+A\s+DISTANCIA\s+Y\s+SUSCRIPCIONES\b/gi, "")
    .replace(/\bMODA,?\s*CALZADO\s+Y\s+COMPLEMENTOS\b/gi, "")
    .replace(/\bHOGAR,?\s*MUEBLES,?\s*DECORACION\s+Y\s+ELECTR\b/gi, "")
    .replace(/\bSERVICIOS\s+VARIOS\b/gi, "")
    .replace(/\bGASOLINERAS\b/gi, "")
    .replace(/\bSUPERMERCADOS\b/gi, "")
    .replace(/\bN\s+20\d{4}\*+\d{3,}\b/gi, "")
    .replace(/\bOB\d+\b/gi, "")
    .replace(/\b[A-Z0-9]{7,}\b$/g, "")
    .replace(/\bES\b$/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const normalized = normalizeHeader(description);
  const paypal = description.match(/PAYPAL\s*\*\s*([^\s]+(?:\s+[^\s]+){0,3})/i);
  if (paypal) {
    const merchant = paypal[1]
      .replace(/\s*-\s*OB\d+/i, "")
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ._-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (/netflix/i.test(merchant)) return "Netflix";
    if (/playstation/i.test(merchant)) return "PlayStation";
    if (/google|microsoft/i.test(merchant)) return "Google / Microsoft";
    if (/panini/i.test(merchant)) return "Panini";
    if (/game/i.test(merchant)) return "GAME";
    if (/planeta|plantadeag/i.test(merchant)) return "Planeta DeAgostini";
    if (merchant) return titleCaseSmart(merchant);
  }

  const amazon = description.match(/(?:WWW\.)?AMAZON\*?\s*([A-Z0-9]*)/i);
  if (amazon) {
    if (/prime/i.test(description)) return "Amazon Prime";
    return "Amazon";
  }
  if (/netflix/i.test(description)) return "Netflix";
  if (/spotify/i.test(description)) return "Spotify";
  if (/disney/i.test(description)) return "Disney+";
  if (/basic\s*fit/i.test(description)) return "Basic-Fit";
  if (/metlife/i.test(description)) return "MetLife";
  if (/repsol|waylet/i.test(description)) return "Repsol Waylet";
  if (/adam\s+ecotech/i.test(description) && /nomina|abono/i.test(normalized)) return "Nómina ADAM";
  if (/sabadell\s+consumer/i.test(description)) return "Sabadell Consumer";
  if (/ret\.\s*efectivo|cajero/i.test(description)) return "Retirada efectivo cajero";
  if (/cargo\s+por\s+amortizacion|prestamo|cr[eé]dito/i.test(description)) return "Préstamo";
  if (/mes\s+parking/i.test(description)) return "Parking";
  if (/bizum/i.test(description)) {
    const bizum = description.replace(/\bBIZUM\b/ig, "").replace(/\bENVIADO:?\b/ig, "Bizum enviado").replace(/\bRECIBIDO:?\b/ig, "Bizum recibido");
    return titleCaseSmart(bizum || "Bizum").replace("Bizum Enviado", "Bizum enviado").replace("Bizum Recibido", "Bizum recibido");
  }

  text = text.replace(/^[,.;:-]+|[,.;:-]+$/g, "").trim();
  if (!text) text = fallback || "Movimiento banco";
  return titleCaseSmart(text).slice(0, 70);
}

function shortName(description, fallback) {
  return cleanImportedConcept(description, fallback || description || "Movimiento banco");
}

function transactionKey(item) {
  const sourceName = normalizeHeader(item.name || item.raw?.description || "").slice(0, 38);
  return `${item.date}|${item.type}|${Number(item.amount).toFixed(2)}|${sourceName}`;
}

function renderCategorySelect(item, index) {
  const options = item.type === "income" ? incomeCategories() : expenseCategories();
  return `<select class="csv-category-select" data-csv-category="${index}">${options.map((category) => `<option${category === item.category ? " selected" : ""}>${category}</option>`).join("")}</select>`;
}

function renderCsvPreview() {
  if (!pendingCsvItems.length) {
    $("csvImportStatus").textContent = "No he encontrado movimientos válidos en el archivo.";
    $("csvPreview").hidden = true;
    $("confirmCsvImportBtn").disabled = true;
    return;
  }
  const fresh = pendingCsvItems.filter((item) => !item.duplicate).length;
  const duplicates = pendingCsvItems.length - fresh;
  $("csvImportStatus").textContent = pendingImportResetData
    ? `Modo prueba activo: se borrarán los movimientos actuales y se importarán ${pendingCsvItems.length} movimientos del archivo.`
    : `Detectados ${pendingCsvItems.length} movimientos: ${fresh} nuevos y ${duplicates} posibles duplicados.`;
  $("confirmCsvImportBtn").disabled = pendingImportResetData ? pendingCsvItems.length === 0 : (pendingImportIncludeDuplicates ? pendingCsvItems.length === 0 : fresh === 0);
  $("csvPreview").hidden = false;
  const monthInfo = monthBreakdown(pendingCsvItems);
  const convertedCsvButton = pendingConvertedCsvText ? `<button id="downloadConvertedCsvBtn" class="secondary-btn" type="button">Descargar CSV convertido</button>` : "";
  $("csvPreview").innerHTML = `
    <div class="import-summary">
      <strong>${pendingCsvItems.length} movimientos detectados</strong>
      ${monthInfo ? `<span>${escapeHtml(monthInfo)}</span>` : ""}
      ${pendingCsvProfileInfo ? `<small class="import-raw">${escapeHtml(pendingCsvProfileInfo)}</small>` : ""}
      ${convertedCsvButton}
    </div>
    <label class="import-duplicates-option danger-option"><input id="resetImportDataCheck" type="checkbox" ${pendingImportResetData ? "checked" : ""}> Modo prueba: borrar movimientos actuales e importar todo este archivo</label>
    ${duplicates && !pendingImportResetData ? `<label class="import-duplicates-option"><input id="importDuplicatesCheck" type="checkbox" ${pendingImportIncludeDuplicates ? "checked" : ""}> Importar también los posibles duplicados</label>` : ""}
    <table>
      <thead><tr><th>Estado</th><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Importe</th></tr></thead>
      <tbody>
        ${pendingCsvItems.slice(0, 80).map((item) => `
          <tr>
            <td><span class="import-pill ${pendingImportResetData ? "" : (item.duplicate ? "duplicate" : "")}">${pendingImportResetData ? "Prueba" : (item.duplicate ? "Duplicado" : "Nuevo")}</span></td>
            <td>${escapeHtml(item.date)}</td>
            <td><strong>${escapeHtml(item.name)}</strong>${item.raw?.description && normalizeHeader(item.raw.description) !== normalizeHeader(item.name) ? `<small class="import-raw">${escapeHtml(item.raw.description)}</small>` : ""}</td>
            <td>${renderCategorySelect(item, pendingCsvItems.indexOf(item))}</td>
            <td class="${item.type === "income" ? "amount-income" : "amount-expense"}">${item.type === "income" ? "+" : "−"}${money.format(item.amount)}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function exportBackup() {
  const payload = {
    app: "Nexo",
    version: 1200,
    exportedAt: new Date().toISOString(),
    state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nexo-copia-${currentMonth}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Copia exportada. Guárdala si vas a usar otro PC", "success");
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const nextState = payload.state || payload;
    if (!nextState.months || !Array.isArray(nextState.expenses) || !Array.isArray(nextState.recurring)) {
      throw new Error("formato no válido");
    }
    const ok = await confirmAction({ title: "Restaurar copia", text: "Reemplazará los datos actuales por los de esta copia de seguridad.", confirmLabel: "Restaurar", tone: "info" });
    if (!ok) return;
    state = { months: {}, expenses: [], recurring: [], rules: [], categoryBudgets: {}, goals: [], ...nextState };
    saveState();
    render();
    toast("Copia restaurada", "success");
  } catch (error) {
    toast(`No se pudo restaurar: ${error.message}`, "danger");
  } finally {
    event.target.value = "";
  }
}


async function fetchWifiRemoteState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) return null;
  return await response.json();
}

function syncComparison(remotePayload) {
  const localIso = localUpdatedAt();
  const remoteIso = remotePayload?.syncedAt || remotePayload?.deviceUpdatedAt || "";
  const localTime = localIso ? Date.parse(localIso) : 0;
  const remoteTime = remoteIso ? Date.parse(remoteIso) : 0;
  const diff = localTime - remoteTime;
  if (!remotePayload) return { state: "no-remote", localIso, remoteIso, text: "Todavía no hay copia guardada en el PC." };
  if (!localIso) return { state: "remote-newer", localIso, remoteIso, text: "Hay una copia en el PC lista para traer." };
  if (diff > 2000) return { state: "local-newer", localIso, remoteIso, text: "Este dispositivo tiene cambios sin guardar en el PC." };
  if (diff < -2000) return { state: "remote-newer", localIso, remoteIso, text: "La copia del PC parece más nueva que este dispositivo." };
  return { state: "synced", localIso, remoteIso, text: "Este dispositivo y el PC parecen sincronizados." };
}

function renderWifiSyncStatus(comparison, online = true) {
  const box = $("wifiSyncStatus");
  if (!box) return;
  if (!online) {
    box.innerHTML = "Sin servidor local detectado. Arranca con <strong>2_INICIAR_NEXO_WIFI.bat</strong> para sincronizar PC y móvil.";
    return;
  }
  const badgeClass = comparison.state === "synced" ? "success" : (comparison.state === "no-remote" ? "info" : "warning");
  const label = comparison.state === "synced" ? "Sincronizado" : (comparison.state === "local-newer" ? "Cambios sin guardar" : (comparison.state === "remote-newer" ? "PC más nuevo" : "Sin copia"));
  box.innerHTML = `
    <div class="sync-status-grid">
      <span class="sync-badge ${badgeClass}">${label}</span>
      <p>${escapeHtml(comparison.text)}</p>
      <div><strong>Este dispositivo:</strong> ${escapeHtml(formatSyncDate(comparison.localIso))}</div>
      <div><strong>Copia del PC:</strong> ${escapeHtml(formatSyncDate(comparison.remoteIso))}</div>
    </div>`;
}

async function checkWifiSyncStatus() {
  const box = $("wifiSyncStatus");
  if (!box) return;
  if (!window.location.protocol.startsWith("http")) {
    box.innerHTML = "Sincronización no disponible si abres <code>index.html</code> directamente. Usa <strong>2_INICIAR_NEXO_WIFI.bat</strong>.";
    return;
  }
  try {
    const health = await fetch("/health", { cache: "no-store" }).then((r) => r.json());
    if (!health.sync) {
      box.textContent = "Servidor activo, pero esta versión no soporta sincronización WiFi.";
      return;
    }
    const remotePayload = await fetchWifiRemoteState().catch(() => null);
    lastWifiSyncMeta = syncComparison(remotePayload);
    renderWifiSyncStatus(lastWifiSyncMeta, true);
  } catch (error) {
    renderWifiSyncStatus({ state: "offline", text: "Sin servidor local detectado.", localIso: localUpdatedAt(), remoteIso: "" }, false);
  }
}

async function pushWifiSync(options = {}) {
  const { silent = false, skipConfirm = false } = options;
  try {
    const remotePayload = await fetchWifiRemoteState().catch(() => null);
    const comparison = syncComparison(remotePayload);
    if (!skipConfirm && comparison.state === "remote-newer") {
      const ok = await confirmAction({
        title: "Sobrescribir copia del PC",
        text: "La copia del PC parece más reciente. Si guardas ahora, la sustituirás por los datos de este dispositivo.",
        confirmLabel: "Guardar igualmente",
        tone: "danger"
      });
      if (!ok) return;
    }
    const payload = {
      app: "nexo",
      version: "1.16",
      syncedAt: new Date().toISOString(),
      deviceUpdatedAt: localUpdatedAt() || new Date().toISOString(),
      state: serializableState()
    };
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json().catch(() => ({}));
    localStorage.setItem(SYNC_LOCAL_UPDATED_KEY, result.syncedAt || payload.syncedAt);
    if (!silent) toast("Datos guardados en el PC", "success");
    checkWifiSyncStatus();
  } catch (error) {
    if (!silent) toast(`No se pudo guardar en el PC: ${error.message}`, "danger");
  }
}

async function pullWifiSync(options = {}) {
  const { skipConfirm = false } = options;
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    if (!payload?.state) throw new Error("la copia no contiene datos de Nexo");
    if (!skipConfirm) {
      const ok = await confirmAction({
        title: "Traer datos del PC",
        text: "Esto sustituirá los datos de este navegador por la copia guardada en el PC.",
        confirmLabel: "Traer datos"
      });
      if (!ok) return;
    }
    state = { months: {}, expenses: [], recurring: [], rules: [], categoryBudgets: {}, goals: [], customCategories: [], categoryIcons: {}, hiddenDefaultCategories: [], importHistory: [], ...payload.state };
    ensureStateShape();
    suppressSyncMark = true;
    saveState();
    suppressSyncMark = false;
    localStorage.setItem(SYNC_LOCAL_UPDATED_KEY, payload.syncedAt || payload.deviceUpdatedAt || new Date().toISOString());
    selectedMovementIds.clear();
    lastImportSummary = null;
    render();
    toast("Datos traídos del PC", "success");
    checkWifiSyncStatus();
  } catch (error) {
    toast(`No se pudieron traer datos: ${error.message}`, "danger");
  }
}

async function smartWifiSync() {
  try {
    const remotePayload = await fetchWifiRemoteState().catch(() => null);
    const comparison = syncComparison(remotePayload);
    if (comparison.state === "no-remote" || comparison.state === "local-newer") {
      await pushWifiSync({ skipConfirm: true });
      return;
    }
    if (comparison.state === "remote-newer") {
      const ok = await confirmAction({ title: "Traer copia más nueva", text: "La copia guardada en el PC parece más reciente. ¿Quieres traerla a este dispositivo?", confirmLabel: "Traer copia" });
      if (ok) await pullWifiSync({ skipConfirm: true });
      return;
    }
    toast("Todo parece sincronizado", "success");
    checkWifiSyncStatus();
  } catch (error) {
    toast(`No se pudo sincronizar: ${error.message}`, "danger");
  }
}

function initWifiSync() {
  $("pushWifiSyncBtn")?.addEventListener("click", () => pushWifiSync());
  $("pullWifiSyncBtn")?.addEventListener("click", () => pullWifiSync());
  $("smartWifiSyncBtn")?.addEventListener("click", smartWifiSync);
  const auto = $("autoWifiSyncCheck");
  if (auto) {
    auto.checked = autoSyncEnabled();
    auto.addEventListener("change", () => {
      setAutoSyncEnabled(auto.checked);
      toast(auto.checked ? "Autoguardado WiFi activado" : "Autoguardado WiFi desactivado", "info");
      if (auto.checked) scheduleAutoWifiSync();
    });
  }
  checkWifiSyncStatus();
}

const demoBankAccounts = [
  { id: "bbva-demo", name: "BBVA Demo", iban: "ES•• 0182 2310", balance: 1428.75, color: "#1456f0" },
  { id: "revolut-demo", name: "Revolut Demo", iban: "LT•• 0420 2300", balance: 386.42, color: "#111827" },
  { id: "santander-demo", name: "Santander preparado", iban: "ES•• pendiente", balance: 0, color: "#e30613", pending: true }
];

function demoBankDate(dayOffset = 0) {
  const base = new Date();
  base.setDate(base.getDate() + dayOffset);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function demoBankMovements() {
  return [
    { id: "demo-bank-001", date: demoBankDate(-5), name: "Mercadona", rawDescription: "PAGO TARJETA MERCADONA 0824", amount: 43.86, type: "expense", category: "Alimentación", account: "BBVA Demo" },
    { id: "demo-bank-002", date: demoBankDate(-4), name: "Bizum recibido - Alex", rawDescription: "BIZUM RECIBIDO ALEX CENA", amount: 18.5, type: "income", category: "Bizum recibido", account: "BBVA Demo" },
    { id: "demo-bank-003", date: demoBankDate(-3), name: "Repsol Waylet", rawDescription: "PAGO TARJETA REPSOL WAYLET", amount: 52.1, type: "expense", category: "Transporte", account: "BBVA Demo" },
    { id: "demo-bank-004", date: demoBankDate(-2), name: "Netflix", rawDescription: "PAYPAL *NETFLIX", amount: 6.99, type: "expense", category: "Suscripciones", account: "Revolut Demo" },
    { id: "demo-bank-005", date: demoBankDate(-1), name: "Devolución Amazon", rawDescription: "ABONO DEVOLUCION AMAZON", amount: 24.99, type: "income", category: "Devolución", account: "BBVA Demo" },
    { id: "demo-bank-006", date: demoBankDate(0), name: "Glovo", rawDescription: "PAGO TARJETA GLOVO APP", amount: 16.4, type: "expense", category: "Alimentación", account: "Revolut Demo" }
  ];
}

function bankCandidateKey(item) {
  return `${item.date}|${item.type}|${Number(item.amount).toFixed(2)}|${normalizeHeader(item.name || item.rawDescription || "").slice(0, 38)}`;
}

function bankMovementKind(item) {
  const text = normalizeHeader(`${item.name || ""} ${item.rawDescription || ""} ${item.category || ""}`);
  if (item.type === "income" && /BIZUM/.test(text)) return { label: "Bizum", className: "bizum", icon: "↩" };
  if (item.type === "income" && /(DEVOLUCION|ABONO|REEMBOLSO|REFUND)/.test(text)) return { label: "Devolución", className: "refund", icon: "↩" };
  if (item.type === "income") return { label: "Entrada", className: "income", icon: "↗" };
  if (/(NETFLIX|SPOTIFY|DISNEY|PRIME|MAX|YOUTUBE|PAYPAL)/.test(text)) return { label: "Suscripción", className: "subscription", icon: "◎" };
  if (/(MERCADONA|GLOVO|RESTAURANTE|CARREFOUR|LIDL|ALDI)/.test(text)) return { label: "Compra", className: "purchase", icon: "↘" };
  if (/(REPSOL|WAYLET|CEPSA|SHELL|BP)/.test(text)) return { label: "Coche", className: "transport", icon: "↘" };
  return { label: "Gasto", className: "expense", icon: "↘" };
}

function bankCategoryOptions(type, selected) {
  const categories = type === "income" ? incomeCategories() : expenseCategories();
  return categories.map((category) => `<option value="${escapeHtml(category)}"${category === selected ? " selected" : ""}>${escapeHtml(category)}</option>`).join("");
}

function syncBankSelectionWithCandidates(candidates, existingKeys) {
  ensureStateShape();
  const freshIds = candidates.filter((item) => !existingKeys.has(bankCandidateKey(item))).map((item) => item.id);
  const current = new Set(state.bank.selectedCandidateIds || []);
  state.bank.selectedCandidateIds = freshIds.filter((id) => current.size ? current.has(id) : true);
  return new Set(state.bank.selectedCandidateIds);
}

function updateBankCandidate(candidateId, patch) {
  ensureStateShape();
  const candidate = (state.bank.candidates || []).find((item) => item.id === candidateId);
  if (!candidate) return;
  Object.assign(candidate, patch);
  if (patch.type && !patch.category) {
    candidate.category = patch.type === "income" ? "Otros ingresos" : "Otros";
  }
  saveState();
  renderBankScreen();
}

function toggleBankCandidate(candidateId, checked) {
  ensureStateShape();
  const selected = new Set(state.bank.selectedCandidateIds || []);
  if (checked) selected.add(candidateId);
  else selected.delete(candidateId);
  state.bank.selectedCandidateIds = [...selected];
  saveState();
  renderBankScreen();
}

function renderBankScreen() {
  const bank = state.bank || { provider: "demo", connected: false, candidates: [] };
  const candidates = bank.candidates || [];
  const badge = $("bankConnectionBadge");
  if (!badge) return;
  const existingKeys = new Set(state.expenses.map(bankCandidateKey));
  const freshCandidates = candidates.filter((item) => !existingKeys.has(bankCandidateKey(item)));
  const selectedCandidateIds = syncBankSelectionWithCandidates(candidates, existingKeys);
  const selectedFreshCandidates = freshCandidates.filter((item) => selectedCandidateIds.has(item.id));
  const duplicateCount = Math.max(0, candidates.length - freshCandidates.length);
  const freshExpense = selectedFreshCandidates.filter((item) => item.type !== "income").reduce((sum, item) => sum + item.amount, 0);
  const freshIncome = selectedFreshCandidates.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const netImpact = Math.max(0, freshExpense - freshIncome);
  const lastSyncText = bank.lastSyncAt ? formatSyncDate(bank.lastSyncAt) : "sin sincronizar";

  badge.textContent = bank.connected ? "Demo conectado" : "Modo demo";
  badge.classList.toggle("connected", !!bank.connected);
  $("bankProviderName").textContent = bank.provider === "real" ? "Open Banking real" : "Simulación segura";
  $("bankProviderStatus").textContent = bank.connected
    ? `Conectado · última sincronización ${lastSyncText}.`
    : "Prueba el flujo completo sin meter datos reales ni credenciales.";
  $("bankSyncLabel").textContent = bank.lastSyncAt ? `Última ${lastSyncText}` : "Pendiente";
  $("importDemoBankBtn").disabled = !selectedFreshCandidates.length;
  $("importDemoBankBtn").textContent = selectedFreshCandidates.length ? `Importar ${selectedFreshCandidates.length} seleccionados` : "Nada seleccionado";

  $("bankReviewPanel").innerHTML = `
    <div class="bank-review-stat">
      <span>Nuevos</span>
      <strong>${selectedFreshCandidates.length}/${freshCandidates.length}</strong>
      <small>seleccionados para importar</small>
    </div>
    <div class="bank-review-stat">
      <span>Gasto</span>
      <strong>${money.format(freshExpense)}</strong>
      <small>compras detectadas</small>
    </div>
    <div class="bank-review-stat">
      <span>Entradas</span>
      <strong>${money.format(freshIncome)}</strong>
      <small>Bizum/devoluciones</small>
    </div>
    <div class="bank-review-stat featured">
      <span>Impacto real</span>
      <strong>${money.format(netImpact)}</strong>
      <small>gasto tras compensar entradas</small>
    </div>
    <div class="bank-review-stat">
      <span>Duplicados</span>
      <strong>${duplicateCount}</strong>
      <small>Nexo los evita</small>
    </div>
  `;

  $("bankAccountList").innerHTML = demoBankAccounts.map((account) => `
    <div class="bank-account-item${account.pending ? " muted-account" : ""}">
      <i style="background:${account.color}"></i>
      <div><strong>${escapeHtml(account.name)}</strong><span>${escapeHtml(account.iban)}</span></div>
      <b>${account.pending ? "Próximamente" : money.format(account.balance)}</b>
    </div>
  `).join("");

  if (!candidates.length) {
    $("bankMovementList").innerHTML = `
      <div class="bank-empty-state">
        <span>🏦</span>
        <strong>Aún no hay movimientos sincronizados</strong>
        <p>Conecta el banco demo y sincroniza. Aquí verás compras, Bizum, devoluciones y duplicados antes de importarlos.</p>
      </div>`;
    return;
  }

  $("bankMovementList").innerHTML = candidates.map((item) => {
    const duplicate = existingKeys.has(bankCandidateKey(item));
    const kind = bankMovementKind(item);
    const selected = selectedCandidateIds.has(item.id) && !duplicate;
    return `
      <div class="bank-movement-item${duplicate ? " duplicate" : ""}">
        <label class="bank-candidate-check">
          <input type="checkbox" data-bank-select="${escapeHtml(item.id)}"${selected ? " checked" : ""}${duplicate ? " disabled" : ""}>
          <span></span>
        </label>
        <div class="bank-movement-icon ${kind.className}">${kind.icon}</div>
        <div>
          <strong>${escapeHtml(item.name)} <em class="bank-kind-pill ${kind.className}">${escapeHtml(kind.label)}</em></strong>
          <span>${escapeHtml(item.account)} · ${escapeHtml(item.category)} · ${escapeHtml(item.date)}</span>
          <small>${duplicate ? "Ya existe en movimientos: no se importará otra vez" : escapeHtml(item.rawDescription || "")}</small>
          <div class="bank-review-controls">
            <select data-bank-type="${escapeHtml(item.id)}"${duplicate ? " disabled" : ""}>
              <option value="expense"${item.type !== "income" ? " selected" : ""}>Gasto</option>
              <option value="income"${item.type === "income" ? " selected" : ""}>Entrada</option>
            </select>
            <select data-bank-category="${escapeHtml(item.id)}"${duplicate ? " disabled" : ""}>
              ${bankCategoryOptions(item.type === "income" ? "income" : "expense", item.category)}
            </select>
          </div>
        </div>
        <b class="${item.type === "income" ? "amount-income" : "amount-expense"}">${item.type === "income" ? "+" : "−"}${money.format(item.amount)}</b>
      </div>`;
  }).join("");
}

async function checkBankBackendStatus() {
  const status = $("bankBackendStatus");
  const hint = $("bankBackendHint");
  if (!status || !hint) return;
  try {
    const response = await fetch("http://localhost:8787/health", { cache: "no-store" });
    const data = await response.json();
    status.textContent = data.configured ? "Listo" : "Activo sin claves";
    hint.textContent = data.configured
      ? "Backend preparado para proveedor real."
      : "El backend responde, pero falta proveedor/credenciales reales.";
  } catch {
    status.textContent = "No detectado";
    hint.textContent = "No pasa nada: el modo demo funciona sin backend.";
  }
}

function connectDemoBank() {
  ensureStateShape();
  state.bank.connected = true;
  state.bank.provider = "demo";
  state.bank.lastSyncAt = state.bank.lastSyncAt || "";
  state.bank.candidates = state.bank.candidates || [];
  saveState();
  render();
  toast("Banco demo conectado", "success");
}

function syncDemoBank() {
  ensureStateShape();
  if (!state.bank.connected) state.bank.connected = true;
  state.bank.provider = "demo";
  state.bank.candidates = demoBankMovements();
  state.bank.selectedCandidateIds = state.bank.candidates.map((item) => item.id);
  state.bank.lastSyncAt = new Date().toISOString();
  saveState();
  render();
  showScreen("bank");
  toast(`${state.bank.candidates.length} movimientos detectados y revisados`, "success");
}

function importDemoBankMovements() {
  ensureStateShape();
  const candidates = state.bank.candidates || [];
  if (!candidates.length) {
    toast("Primero sincroniza movimientos del banco demo", "info");
    return;
  }
  const existingKeys = new Set(state.expenses.map(bankCandidateKey));
  const selectedIds = new Set(state.bank.selectedCandidateIds || []);
  const batchId = `bank-demo-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const toImport = candidates
    .filter((item) => selectedIds.has(item.id) && !existingKeys.has(bankCandidateKey(item)))
    .map((item) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      name: item.name,
      amount: Number(item.amount) || 0,
      date: item.date,
      category: item.category,
      type: item.type,
      source: "bank-demo",
      originalDescription: item.rawDescription,
      importBatchId: batchId,
      importBatchName: "Banco demo",
      importedAt: nowIso,
      createdAt: nowIso
    }));

  if (!toImport.length) {
    toast("No hay movimientos nuevos que importar", "info");
    return;
  }
  state.expenses.push(...toImport);
  state.importHistory = state.importHistory || [];
  state.importHistory.unshift({ id: batchId, name: "Banco demo", importedAt: nowIso, count: toImport.length, months: monthBreakdown(toImport) });
  state.importHistory = state.importHistory.slice(0, 20);
  lastImportSummary = state.importHistory[0];
  saveState();
  render();
  showScreen("movements");
  toast(`${toImport.length} movimientos importados desde Banco`, "success");
}

function initBankScreen() {
  $("connectDemoBankBtn")?.addEventListener("click", connectDemoBank);
  $("syncDemoBankBtn")?.addEventListener("click", syncDemoBank);
  $("importDemoBankBtn")?.addEventListener("click", importDemoBankMovements);
  $("bankMovementList")?.addEventListener("change", (event) => {
    const selectId = event.target?.dataset?.bankSelect;
    const typeId = event.target?.dataset?.bankType;
    const categoryId = event.target?.dataset?.bankCategory;
    if (selectId) {
      toggleBankCandidate(selectId, event.target.checked);
      return;
    }
    if (typeId) {
      updateBankCandidate(typeId, { type: event.target.value, category: event.target.value === "income" ? "Otros ingresos" : "Otros" });
      return;
    }
    if (categoryId) {
      updateBankCandidate(categoryId, { category: event.target.value });
    }
  });
  checkBankBackendStatus();
}

function showScreen(screen = "home") {
  const navButtons = [...document.querySelectorAll("[data-nav-screen]")];
  const validScreens = new Set(navButtons.map((button) => button.dataset.navScreen));
  if (!validScreens.has(screen)) screen = "home";
  document.body.dataset.activeScreen = screen;
  localStorage.setItem(ACTIVE_SCREEN_KEY, screen);
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.navScreen === screen));
  window.scrollTo({ top: 0, behavior: "smooth" });
}


function initMobileQuickActions() {
  document.querySelectorAll("[data-mobile-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.mobileAction;
      if (action === "add-movement") {
        showScreen("movements");
        $("addExpenseBtn")?.click();
        return;
      }
      if (action === "import") {
        showScreen("movements");
        $("importCsvBtn")?.click();
        return;
      }
      if (action === "budgets") {
        showScreen("budgets");
        $("editCategoryBudgetsBtn")?.click();
        return;
      }
      if (action === "recurring") {
        showScreen("movements");
        $("addRecurringBtn")?.click();
      }
    });
  });
}

function initMobileAccessHelp() {
  const copyBtn = $("copyCurrentUrlBtn");
  if (!copyBtn) return;
  copyBtn.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast("Dirección copiada", "success");
    } catch (error) {
      toast(url, "info");
    }
  });
}

function initMobileViewportDock() {
  const root = document.documentElement;
  const updateDockOffset = () => {
    const viewport = window.visualViewport;
    const layoutHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const visualHeight = viewport?.height || layoutHeight;
    const visualTop = viewport?.offsetTop || 0;
    const bottomOffset = Math.max(0, layoutHeight - visualHeight - visualTop);
    const safeOffset = Math.min(150, Math.round(bottomOffset));
    root.style.setProperty("--browser-bottom-offset", `${safeOffset}px`);
  };

  updateDockOffset();
  window.addEventListener("resize", updateDockOffset, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(updateDockOffset, 250), { passive: true });
  window.visualViewport?.addEventListener("resize", updateDockOffset, { passive: true });
  window.visualViewport?.addEventListener("scroll", updateDockOffset, { passive: true });
}

function initMobileNavigation() {
  const navButtons = [...document.querySelectorAll("[data-nav-screen]")];
  const validScreens = new Set(navButtons.map((button) => button.dataset.navScreen));
  const stored = localStorage.getItem(ACTIVE_SCREEN_KEY) || ACTIVE_SCREEN_FALLBACK_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  const initial = validScreens.has(stored) ? stored : "home";
  navButtons.forEach((button) => button.addEventListener("click", () => showScreen(button.dataset.navScreen)));
  showScreen(initial);
}

applyTheme(activeTheme);
renderEmojiSuggestions();
initEvents();
initDataTools();
initInstallPrompt();
initMobileViewportDock();
initMobileNavigation();
initMobileQuickActions();
initMobileAccessHelp();
initWifiSync();
initBankScreen();
initShareReadyFeatures();
render();
if (!monthPlan().income) setTimeout(openPlan, 250);
