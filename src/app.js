import { addDays, analyzeNote, dictionaries, formatDate, inferSpace } from "./note-analyzer.js?v=20260608-sync2";

const STORAGE_KEY = "ai-notes-mvp-v5";
const SYNC_API_BASE = "/api";
let syncTimer = null;
let isApplyingRemoteState = false;
let shouldPersistAfterLoad = false;
let introStep = 0;
let introComplete = false;

const introMessages = [
  {
    kicker: "Добро пожаловать",
    title: "AI-заметки",
    text: "Записывай мысли, задачи и договоренности свободным текстом.",
  },
  {
    kicker: "Тихая автоматизация",
    title: "Сроки, люди и действия",
    text: "Сервис сам выделяет важное, предлагает follow-up и помогает не терять контекст.",
  },
  {
    kicker: "Рабочая память",
    title: "Все готово",
    text: "Начни с первой заметки. Остальное приложение аккуратно разложит по местам.",
  },
];

const dataSchema = {
  note: ["id", "text", "space", "status", "favorite", "sensitive", "analysis", "createdAt", "updatedAt"],
  action: ["id", "noteId", "type", "status", "title", "text", "createdAt", "updatedAt"],
  aiSuggestion: ["id", "noteId", "kind", "status", "title", "text", "payload", "createdAt", "resolvedAt"],
  pipelineJob: ["id", "noteId", "type", "status", "label", "createdAt", "updatedAt"],
  auditEvent: ["id", "type", "label", "detail", "createdAt"],
};

const defaultIntegrations = [
  {
    id: "openrouter",
    name: "OpenRouter",
    status: "planned",
    description: "AI-agent для анализа заметок, решений, дат, тредов и рекомендаций.",
  },
  {
    id: "yandex-calendar",
    name: "Yandex Calendar",
    status: "planned",
    description: "Создание событий, agenda, контекста перед встречей и follow-up после нее.",
  },
  {
    id: "telegram",
    name: "Telegram bot",
    status: "later",
    description: "Быстрый ввод с телефона: текст, голос, напоминания и ежедневные дайджесты.",
  },
  {
    id: "sync",
    name: "Account sync",
    status: "later",
    description: "Личный кабинет, синхронизация между Mac, телефоном и будущим VPS.",
  },
];

const defaultSpaces = ["Работа", "Личное", "Финансы", "Обучение"];
const actionStatuses = ["open", "progress", "done"];
const suggestionStatuses = ["pending", "accepted", "dismissed"];
const pipelineSteps = [
  ["capture", "Заметка создана"],
  ["analysis", "Локальный AI-анализ"],
  ["review", "Ожидает подтверждения"],
];
const noteTemplates = [
  {
    id: "meeting",
    label: "Встреча",
    space: "Работа",
    text: "Встреча: \nУчастники: \nРешили: \nНужно: \nСрок: ",
  },
  {
    id: "task",
    label: "Задача",
    space: "Работа",
    text: "Задача: \nНужно сделать: \nВладелец: \nСрок: завтра",
  },
  {
    id: "idea",
    label: "Идея",
    space: "Личное",
    text: "Идея: \nПочему важно: \nСледующий шаг: ",
  },
  {
    id: "decision",
    label: "Решение",
    space: "Работа",
    text: "Решили: \nКонтекст: \nКто отвечает: \nПроверить через неделю.",
  },
  {
    id: "personal",
    label: "Личное",
    space: "Личное",
    text: "Личное: \nНе забыть: \nСрок: ",
  },
];

const demoNoteTexts = new Set([
  "После созвона с Машей: договорились вернуться к макету в пятницу, проверить список правок и решить, что пойдет в первый релиз.",
  "Петр прислал идею для личного бюджета: разнести платежи по категориям и через неделю посмотреть, где лишние траты.",
  "Нужно подготовить заметки к встрече по проекту: цели, открытые вопросы, владельцы задач и решения, которые нельзя потерять.",
  "Идея: сделать утренний дайджест из заметок — что сегодня важно, какие обещания зависли и что стоит вынести в календарь.",
]);

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return normalizeAppState(JSON.parse(saved));
  }

  return {
    notes: [],
    actions: [],
    suggestions: [],
    jobs: [],
    auditLog: [
      buildAuditEvent("system", "Рабочая область готова", "Создай первую заметку или подключи синхронизацию."),
    ],
    integrations: defaultIntegrations,
    spaces: defaultSpaces,
    settings: {
      aiProvider: "OpenRouter",
      calendarProvider: "Yandex Calendar",
      privacyMode: true,
      hidePrivate: false,
      dailyDigest: true,
      aiScope: "selected",
      maskSensitive: true,
      confirmExternalActions: true,
      keepAuditLog: true,
      desktopMode: true,
      syncEnabled: false,
      syncCode: "",
      syncStatus: "Не подключено",
      syncUpdatedAt: "",
    },
    activeView: "inbox",
    selectedNoteId: "",
    selectedThread: "",
    activeFilter: "active",
    actionFilter: "open",
    editingNoteId: "",
    commandOpen: false,
    query: "",
  };
}

function normalizeAppState(parsed = {}) {
  const removedDemoIds = new Set((parsed.notes || []).filter((note) => demoNoteTexts.has(note.text)).map((note) => note.id));
  if (removedDemoIds.size) shouldPersistAfterLoad = true;

  const notes = (parsed.notes || [])
    .filter((note) => !removedDemoIds.has(note.id))
    .map((note) => enrichNote(note));
  const suggestions = (parsed.suggestions || [])
    .filter((suggestion) => !removedDemoIds.has(suggestion.noteId))
    .map(normalizeSuggestion);
  const missingSuggestions = notes
    .filter((note) => !suggestions.some((suggestion) => suggestion.noteId === note.id))
    .flatMap((note) => buildSuggestionsForNote(note));
  const jobs = (parsed.jobs || [])
    .filter((job) => !removedDemoIds.has(job.noteId))
    .map(normalizePipelineJob);
  const missingJobs = notes
    .filter((note) => !jobs.some((job) => job.noteId === note.id))
    .map((note) => buildPipelineJob(note));

  return {
    notes,
    actions: (parsed.actions || []).filter((action) => !removedDemoIds.has(action.noteId)).map(normalizeAction),
    suggestions: [...suggestions, ...missingSuggestions],
    jobs: [...jobs, ...missingJobs],
    auditLog: (parsed.auditLog || []).map(normalizeAuditEvent),
    integrations: parsed.integrations || defaultIntegrations,
    spaces: parsed.spaces || defaultSpaces,
    settings: {
      aiProvider: "OpenRouter",
      calendarProvider: "Yandex Calendar",
      privacyMode: true,
      hidePrivate: false,
      dailyDigest: true,
      aiScope: "selected",
      maskSensitive: true,
      confirmExternalActions: true,
      keepAuditLog: true,
      desktopMode: true,
      syncEnabled: false,
      syncCode: "",
      syncStatus: "Не подключено",
      syncUpdatedAt: "",
      ...(parsed.settings || {}),
    },
    activeView: parsed.activeView || "inbox",
    selectedNoteId: parsed.selectedNoteId,
    selectedThread: parsed.selectedThread || "",
    activeFilter: parsed.activeFilter || "active",
    actionFilter: parsed.actionFilter || "open",
    editingNoteId: parsed.editingNoteId || "",
    commandOpen: false,
    query: parsed.query || "",
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState({ includeLocalSync: true })));
  scheduleSyncPush();
}

function serializeState({ includeLocalSync = false } = {}) {
  const settings = { ...state.settings };
  if (!includeLocalSync) {
    delete settings.syncCode;
    delete settings.syncStatus;
  }

  return {
    notes: state.notes,
    actions: state.actions,
    suggestions: state.suggestions,
    jobs: state.jobs,
    auditLog: state.auditLog,
    integrations: state.integrations,
    spaces: state.spaces,
    settings,
    activeView: state.activeView,
    selectedNoteId: state.selectedNoteId,
    selectedThread: state.selectedThread,
    activeFilter: state.activeFilter,
    actionFilter: state.actionFilter,
    editingNoteId: state.editingNoteId,
    query: state.query,
  };
}

function enrichNote(note) {
  const analysis = {
    ...analyzeNote(note.text, note.createdAt),
    ...(note.analysisOverrides || {}),
  };
  return {
    ...note,
    status: note.status || "active",
    space: note.space || inferSpace(note.text),
    favorite: Boolean(note.favorite),
    sensitive: Boolean(note.sensitive),
    analysisOverrides: note.analysisOverrides || {},
    analysis,
  };
}

function renderIntro() {
  const message = introMessages[introStep] || introMessages[introMessages.length - 1];
  const progress = ((introStep + 1) / introMessages.length) * 100;
  document.querySelector("#app").innerHTML = `
    <main class="intro-screen">
      <section class="intro-copy" aria-live="polite">
        <span class="intro-kicker">${escapeHtml(message.kicker)}</span>
        <h1>${escapeHtml(message.title)}</h1>
        <p>${escapeHtml(message.text)}</p>
        <div class="intro-progress" aria-hidden="true">
          <span style="width: ${progress}%"></span>
        </div>
      </section>
      <button class="intro-skip" data-skip-intro="true">Перейти к заметкам</button>
    </main>
  `;
  document.querySelector("[data-skip-intro]")?.addEventListener("click", finishIntro);
}

function startIntro() {
  renderIntro();
  if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    setTimeout(finishIntro, 600);
    return;
  }

  const next = () => {
    introStep += 1;
    if (introStep >= introMessages.length) {
      finishIntro();
      return;
    }
    renderIntro();
    setTimeout(next, 3000);
  };

  setTimeout(next, 3000);
}

function finishIntro() {
  if (introComplete) return;
  introComplete = true;
  render();
}

function render() {
  if (!introComplete) {
    renderIntro();
    return;
  }

  const filteredNotes = getFilteredNotes();
  const selected = filteredNotes.find((note) => note.id === state.selectedNoteId) || filteredNotes[0] || null;
  const people = getPeople();
  const topics = getTopics();
  const reminders = getVisibleNotes().filter((note) => note.analysis.reminder);
  const signals = getVisibleNotes().filter((note) => note.analysis.signal !== "Обычный");
  const digest = getDigest();
  const today = getTodayData();
  const pendingSuggestions = getPendingSuggestions();

  document.querySelector("#app").innerHTML = `
    <main class="shell">
      <aside class="sidebar glass-panel">
        <div class="brand">
          <div class="brand-mark">A</div>
          <div>
            <strong>AI Memory</strong>
            <span>MVP workspace</span>
          </div>
        </div>
        <nav class="nav">
          ${navButton("inbox", "Заметки", getVisibleNotes().length)}
          ${navButton("today", "Сегодня", today.total)}
          ${navButton("reminders", "Follow-up", reminders.length + getActionsByType("followup").length)}
          ${navButton("calendar", "Календарь", getActionsByType("calendar").length + getActionsByType("agenda").length)}
          ${navButton("review", "AI Review", pendingSuggestions.length)}
          <details class="nav-more" ${isSecondaryView(state.activeView) ? "open" : ""}>
            <summary>Еще</summary>
            ${navButton("actions", "Действия", state.actions.filter((action) => action.status !== "done").length)}
            ${navButton("people", "Люди", people.length)}
            ${navButton("threads", "Темы", topics.length)}
            ${navButton("spaces", "Пространства", state.spaces.length)}
            ${navButton("favorites", "Избранное", getVisibleNotes().filter((note) => note.favorite).length)}
            ${navButton("digest", "Дайджест", digest.items.length)}
            ${navButton("radar", "Сигналы", signals.length)}
            ${navButton("activity", "Журнал", state.auditLog.length)}
            ${navButton("integrations", "Интеграции", state.integrations.length)}
            ${navButton("settings", "Настройки", state.settings.privacyMode ? 1 : 0)}
          </details>
        </nav>
      </aside>

      <section class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">Личная рабочая память</p>
            <h1>${viewTitle()}</h1>
          </div>
          <div class="top-actions">
            <button class="ghost command-trigger" data-open-command="true">Команды</button>
            <label class="search">
              <span></span>
              <input id="search" placeholder="Поиск по людям, темам, заметкам" value="${escapeHtml(state.query)}" />
            </label>
          </div>
        </header>

        <section class="content">
          ${state.activeView === "inbox" ? renderInbox(filteredNotes, selected) : ""}
          ${state.activeView === "today" ? renderToday(today) : ""}
          ${state.activeView === "spaces" ? renderSpaces() : ""}
          ${state.activeView === "favorites" ? renderFavorites() : ""}
          ${state.activeView === "people" ? renderPeople(people) : ""}
          ${state.activeView === "threads" ? renderThreads(topics) : ""}
          ${state.activeView === "review" ? renderReviewCenter() : ""}
          ${state.activeView === "actions" ? renderActions() : ""}
          ${state.activeView === "reminders" ? renderReminders(reminders) : ""}
          ${state.activeView === "calendar" ? renderCalendarPlan() : ""}
          ${state.activeView === "digest" ? renderDigest(digest) : ""}
          ${state.activeView === "radar" ? renderRadar(signals) : ""}
          ${state.activeView === "activity" ? renderActivityLog() : ""}
          ${state.activeView === "integrations" ? renderIntegrations() : ""}
          ${state.activeView === "settings" ? renderSettings() : ""}
        </section>
      </section>
      ${renderCommandPalette()}
    </main>
  `;

  bindEvents();
}

function navButton(id, label, count) {
  return `<button class="nav-button ${state.activeView === id ? "active" : ""}" data-view="${id}">
    <span>${label}</span><b>${count}</b>
  </button>`;
}

function isSecondaryView(view) {
  return ["actions", "people", "threads", "spaces", "favorites", "digest", "radar", "activity", "integrations", "settings"].includes(view);
}

function viewTitle() {
  return {
    inbox: "Быстрые заметки",
    today: "Сегодня",
    spaces: "Пространства",
    favorites: "Избранное",
    people: "Карточки людей",
    threads: "Темы и контекст",
    review: "AI Review",
    actions: "Действия",
    reminders: "Напоминания",
    calendar: "Календарный план",
    digest: "Дайджест",
    radar: "Сигналы и срочность",
    activity: "Журнал действий",
    integrations: "Интеграции",
    settings: "Настройки",
  }[state.activeView];
}

function renderInbox(notes, selected) {
  return `
    <div class="composer glass-panel">
      <textarea id="noteText" placeholder="Запиши мысль, задачу или договоренность..."></textarea>
      <div class="composer-actions">
        <div class="composer-meta">
          <select id="noteSpace" class="select-control" aria-label="Пространство заметки">
            ${state.spaces.map((space) => `<option value="${escapeHtml(space)}">${escapeHtml(space)}</option>`).join("")}
          </select>
          <details class="composer-more">
            <summary>Шаблоны</summary>
            <div class="template-row">
              ${noteTemplates.map((template) => `<button class="chip" data-template="${template.id}">${escapeHtml(template.label)}</button>`).join("")}
            </div>
          </details>
        </div>
        <button class="primary" id="addNote">Добавить заметку</button>
      </div>
    </div>
    <div class="filter-bar">
      ${filterButton("active", "Активные")}
      ${filterButton("all", "Все")}
      ${filterButton("favorites", "Избранное")}
      ${filterButton("sensitive", "Приватные")}
      ${filterButton("archived", "Архив")}
    </div>
    <div class="three-column">
      <div class="note-list glass-panel">
        ${notes.map(renderNoteItem).join("") || `<div class="empty-state">Нет заметок под этот фильтр.</div>`}
      </div>
      <div class="note-detail glass-panel">
        ${selected ? renderNoteDetail(selected) : "<p>Пока нет заметок.</p>"}
      </div>
    </div>
  `;
}

function renderCommandPalette() {
  if (!state.commandOpen) return "";
  const commands = [
    ["inbox", "Быстрые заметки", "Перейти в Inbox"],
    ["today", "Сегодня", "Открыть фокус дня"],
    ["review", "AI Review", "Проверить предложения агента"],
    ["actions", "Действия", "Открыть action board"],
    ["calendar", "Календарь", "Открыть календарный план"],
    ["digest", "Дайджест", "Открыть сводку"],
    ["activity", "Журнал", "Посмотреть историю решений"],
    ["settings", "Настройки", "Открыть настройки"],
  ];

  return `<div class="command-backdrop" data-close-command="true">
    <section class="command-panel glass-panel" role="dialog" aria-label="Command palette">
      <div class="section-head">
        <div>
          <span class="eyebrow">Command palette</span>
          <h2>Быстрые действия</h2>
        </div>
        <button class="ghost small" data-close-command="true">Закрыть</button>
      </div>
      <div class="command-list">
        <button class="command-item" data-command-focus-note="true">
          <b>Новая заметка</b>
          <span>Перейти в Inbox и поставить курсор в поле ввода</span>
        </button>
        <button class="command-item" data-command-followup="true">
          <b>Follow-up из выбранной заметки</b>
          <span>Создать действие по текущей заметке</span>
        </button>
        ${commands.map(([view, title, description]) => `
          <button class="command-item" data-command-view="${view}">
            <b>${escapeHtml(title)}</b>
            <span>${escapeHtml(description)}</span>
          </button>
        `).join("")}
      </div>
    </section>
  </div>`;
}

function filterButton(id, label) {
  return `<button class="chip ${state.activeFilter === id ? "active" : ""}" data-filter="${id}">${label}</button>`;
}

function renderNoteItem(note) {
  return `<button class="note-item ${note.id === state.selectedNoteId ? "selected" : ""}" data-note="${note.id}">
    <span class="topic">${note.favorite ? "★ " : ""}${note.sensitive ? "Private · " : ""}${note.analysis.topic}</span>
    <strong>${escapeHtml(note.text.slice(0, 82))}${note.text.length > 82 ? "..." : ""}</strong>
    <small>${escapeHtml(note.space)} · ${new Date(note.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
  </button>`;
}

function renderNoteDetail(note) {
  if (state.editingNoteId === note.id) return renderNoteEditor(note);

  return `
    <div class="detail-head">
      <div>
        <span class="pill">${note.analysis.topic}</span>
        <span class="risk ${note.analysis.signal.toLowerCase()}">${note.analysis.signal} сигнал</span>
      </div>
      <button class="ghost small" data-edit-note="${note.id}">Редактировать</button>
    </div>
    <div class="note-toolbar">
      <button class="ghost small" data-toggle-note="favorite" data-note-id="${note.id}">${note.favorite ? "В избранном" : "В избранное"}</button>
      <button class="ghost small" data-toggle-note="sensitive" data-note-id="${note.id}">${note.sensitive ? "Приватная" : "Сделать приватной"}</button>
      <button class="ghost small" data-archive-note="${note.id}">${note.status === "archived" ? "Вернуть" : "В архив"}</button>
    </div>
    <p class="note-text">${escapeHtml(note.text)}</p>
    <div class="meta-grid">
      <div><span>Люди</span><strong>${note.analysis.people.join(", ") || "Не определены"}</strong></div>
      <div><span>Срок</span><strong>${escapeHtml(reminderLabel(note))}</strong>${reminderHint(note)}</div>
      <div><span>Статус</span><strong>${note.analysis.urgency}</strong></div>
      <div><span>Пространство</span><strong>${escapeHtml(note.space)}</strong></div>
    </div>
    <div class="analysis-block">
      <h3>Выжимка</h3>
      <p>${escapeHtml(note.analysis.summary)}</p>
      ${note.analysis.decisions.length ? `<h3>Решения</h3><ul>${note.analysis.decisions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${note.analysis.tasks.length ? `<h3>Задачи</h3><ul>${note.analysis.tasks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    </div>
    ${renderInsights(note)}
  `;
}

function renderNoteEditor(note) {
  return `
    <div class="detail-head">
      <span class="pill">Редактирование</span>
      <span class="risk ${note.analysis.signal.toLowerCase()}">${note.analysis.signal} сигнал</span>
    </div>
    <div class="edit-form">
      <label>
        <span>Текст заметки</span>
        <textarea id="editNoteText">${escapeHtml(note.text)}</textarea>
      </label>
      <label>
        <span>Пространство</span>
        <select id="editNoteSpace" class="select-control">
          ${state.spaces.map((space) => `<option value="${escapeHtml(space)}" ${space === note.space ? "selected" : ""}>${escapeHtml(space)}</option>`).join("")}
        </select>
      </label>
      <div class="manual-grid">
        <label>
          <span>Тема</span>
          <select id="editNoteTopic" class="select-control">
            ${getTopicNames().map((topic) => `<option value="${escapeHtml(topic)}" ${topic === note.analysis.topic ? "selected" : ""}>${escapeHtml(topic)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Сигнал</span>
          <select id="editNoteSignal" class="select-control">
            ${["Обычный", "Средний", "Сильный"].map((signal) => `<option value="${escapeHtml(signal)}" ${signal === note.analysis.signal ? "selected" : ""}>${escapeHtml(signal)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Срок</span>
          <input id="editNoteReminder" class="text-control" value="${escapeHtml(note.analysis.reminder || "")}" placeholder="Например: завтра, 12 июня" />
        </label>
        <label>
          <span>Люди</span>
          <input id="editNotePeople" class="text-control" value="${escapeHtml(note.analysis.people.join(", "))}" placeholder="Имена через запятую" />
        </label>
      </div>
      <div class="edit-actions">
        <button class="primary" data-save-note="${note.id}">Сохранить</button>
        <button class="ghost" data-cancel-edit="true">Отменить</button>
      </div>
    </div>
  `;
}

function renderInsights(note) {
  return `
    <details class="insights">
      <summary>AI-рекомендация</summary>
      <p>${escapeHtml(note.analysis.action)}</p>
      <div class="stack">
        <button class="ghost" data-action="followup" data-note-action="${note.id}">Создать follow-up</button>
        <button class="ghost" data-action="calendar" data-note-action="${note.id}">Вынести в календарь</button>
        <button class="ghost" data-action="agenda" data-note-action="${note.id}">Подготовить agenda</button>
        <button class="ghost" data-action="prep" data-note-action="${note.id}">Режим встречи</button>
        <button class="ghost" data-action="postmeeting" data-note-action="${note.id}">Итоги встречи</button>
      </div>
      ${renderActionLog(note.id)}
    </details>
  `;
}

function renderSpaces() {
  const spaces = state.spaces.map((space) => ({
    name: space,
    notes: state.notes.filter((note) => note.space === space && note.status !== "archived"),
  }));
  return `<div class="cards-grid">${spaces.map((space) => `
    <article class="entity-card glass-panel">
      <span>${space.notes.length} активные заметки</span>
      <h2>${escapeHtml(space.name)}</h2>
      <p>${escapeHtml(space.notes[0]?.analysis.summary || "Пока нет заметок в этом пространстве.")}</p>
      <div class="card-footer"><b>${space.notes.filter((note) => note.analysis.reminder).length} сроков</b><em>${space.notes.filter((note) => note.favorite).length} избранных</em></div>
    </article>
  `).join("")}</div>`;
}

function renderToday(today) {
  return `<div class="today-layout">
    <section class="today-hero glass-panel">
      <span>Фокус дня</span>
      <strong>${today.total}</strong>
      <p>${escapeHtml(today.summary)}</p>
    </section>
    <section class="today-grid">
      ${renderTodayColumn("Сроки", today.reminders, "reminder")}
      ${renderTodayColumn("В работе", today.actions, "action")}
      ${renderTodayColumn("Сигналы", today.signals, "signal")}
    </section>
  </div>`;
}

function renderTodayColumn(title, items, type) {
  return `<article class="today-column glass-panel">
    <div class="section-head">
      <h2>${escapeHtml(title)}</h2>
      <span class="status planned">${items.length}</span>
    </div>
    ${items.map((item) => renderTodayItem(item, type)).join("") || `<div class="empty-state">Пока пусто.</div>`}
  </article>`;
}

function renderTodayItem(item, type) {
  if (type === "action") {
    return `<div class="today-item">
      <b>${escapeHtml(item.title)}</b>
      <span>${escapeHtml(actionStatusLabel(item.status))} · ${escapeHtml(actionLabel(item.type))}</span>
      <p>${escapeHtml(item.text)}</p>
    </div>`;
  }
  return `<div class="today-item">
    <b>${escapeHtml(item.analysis.topic)}</b>
    <span>${escapeHtml(item.analysis.reminder || item.analysis.signal)} · ${escapeHtml(item.space)}</span>
    <p>${escapeHtml(item.analysis.summary)}</p>
  </div>`;
}

function renderFavorites() {
  const favorites = getVisibleNotes().filter((note) => note.favorite);
  return `<div class="timeline glass-panel">${favorites.map((note) => `
    <article class="timeline-item">
      <time>${escapeHtml(note.space)}</time>
      <div>
        <strong>${escapeHtml(note.analysis.topic)}</strong>
        <p>${escapeHtml(note.text)}</p>
      </div>
    </article>
  `).join("") || "<p>Избранных заметок пока нет.</p>"}</div>`;
}

function renderPeople(people) {
  return `<div class="cards-grid">${people.map((person) => `
    <article class="entity-card glass-panel">
      <span>${person.notes.length} заметки</span>
      <h2>${escapeHtml(person.name)}</h2>
      <p>${escapeHtml(person.last.analysis.action)}</p>
      <div class="card-footer"><b>${person.last.analysis.topic}</b><em>${person.last.analysis.signal} сигнал</em></div>
    </article>
  `).join("")}</div>`;
}

function renderThreads(topics) {
  const activeThread = state.selectedThread || topics[0]?.name || "";
  const selected = topics.find((topic) => topic.name === activeThread);
  return `<div class="thread-layout">
    <div class="cards-grid thread-cards">${topics.map((topic) => `
      <button class="entity-card glass-panel thread-card ${topic.name === activeThread ? "selected" : ""}" data-thread="${escapeHtml(topic.name)}">
        <span>${topic.notes.length} заметки</span>
        <h2>${escapeHtml(topic.name)}</h2>
        <p>${escapeHtml(topic.notes[0].analysis.summary)}</p>
        <div class="thread-bar"><i style="width:${Math.min(100, topic.notes.length * 28)}%"></i></div>
      </button>
    `).join("")}</div>
    ${selected ? renderThreadDetail(selected) : ""}
  </div>`;
}

function renderThreadDetail(thread) {
  const decisions = thread.notes.flatMap((note) => note.analysis.decisions);
  const tasks = thread.notes.flatMap((note) => note.analysis.tasks);
  return `<section class="thread-detail glass-panel">
    <div class="section-head">
      <div>
        <span class="eyebrow">Тред</span>
        <h2>${escapeHtml(thread.name)}</h2>
      </div>
      <button class="ghost" data-action="thread-summary" data-thread-action="${escapeHtml(thread.name)}">Собрать summary</button>
    </div>
    <div class="meta-grid">
      <div><span>Заметок</span><strong>${thread.notes.length}</strong></div>
      <div><span>Сроков</span><strong>${thread.notes.filter((note) => note.analysis.reminder).length}</strong></div>
      <div><span>Решений</span><strong>${decisions.length}</strong></div>
      <div><span>Задач</span><strong>${tasks.length}</strong></div>
    </div>
    <div class="timeline compact">
      ${thread.notes.map((note) => `
        <article class="timeline-item">
          <time>${new Date(note.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</time>
          <div>
            <strong>${escapeHtml(note.space)}</strong>
            <p>${escapeHtml(note.text)}</p>
          </div>
        </article>
      `).join("")}
    </div>
  </section>`;
}

function renderReviewCenter() {
  const pending = getPendingSuggestions();
  const resolved = state.suggestions
    .filter((suggestion) => suggestion.status !== "pending")
    .slice(0, 6);
  const jobs = state.jobs.slice(0, 8);

  return `<div class="review-layout">
    <section class="review-main glass-panel">
      <div class="section-head">
        <div>
          <span class="eyebrow">Центр подтверждений</span>
          <h2>Предложения агента</h2>
        </div>
        <span class="status planned">${pending.length} ждут решения</span>
      </div>
      <div class="suggestion-list">
        ${pending.map(renderSuggestionCard).join("") || `<div class="empty-state">Все предложения разобраны. Новые появятся после создания или редактирования заметок.</div>`}
      </div>
    </section>
    <aside class="review-side">
      <section class="glass-panel review-card">
        <div class="panel-title">Pipeline</div>
        ${jobs.map(renderPipelineJob).join("") || `<div class="empty-state">Очередь пока пустая.</div>`}
      </section>
      <section class="glass-panel review-card">
        <div class="panel-title">Недавние решения</div>
        ${resolved.map(renderResolvedSuggestion).join("") || `<div class="empty-state">Пока нет принятых или отклоненных предложений.</div>`}
      </section>
    </aside>
  </div>`;
}

function renderSuggestionCard(suggestion) {
  const note = state.notes.find((item) => item.id === suggestion.noteId);
  return `<article class="suggestion-card">
    <div class="suggestion-top">
      <span class="status planned">${escapeHtml(suggestionLabel(suggestion.kind))}</span>
      <small>${new Date(suggestion.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
    </div>
    <h2>${escapeHtml(suggestion.title)}</h2>
    <p>${escapeHtml(suggestion.text)}</p>
    ${note ? `<blockquote>${escapeHtml(note.analysis.summary)}</blockquote>` : ""}
    <div class="suggestion-controls">
      <button class="primary" data-accept-suggestion="${suggestion.id}">Принять</button>
      <button class="ghost" data-dismiss-suggestion="${suggestion.id}">Отклонить</button>
      ${note ? `<button class="ghost" data-open-note="${note.id}">Открыть заметку</button>` : ""}
    </div>
  </article>`;
}

function renderResolvedSuggestion(suggestion) {
  return `<div class="resolved-item">
    <b>${escapeHtml(suggestion.title)}</b>
    <span>${suggestion.status === "accepted" ? "Принято" : "Отклонено"} · ${escapeHtml(suggestionLabel(suggestion.kind))}</span>
  </div>`;
}

function renderPipelineJob(job) {
  return `<div class="pipeline-job">
    <div>
      <b>${escapeHtml(job.label)}</b>
      <span>${escapeHtml(jobStatusLabel(job.status))}</span>
    </div>
    <div class="pipeline-steps">
      ${pipelineSteps.map(([step, label]) => `<i class="${job.steps?.includes(step) ? "done" : ""}" title="${escapeHtml(label)}"></i>`).join("")}
    </div>
  </div>`;
}

function renderActivityLog() {
  return `<div class="activity-layout">
    <section class="activity-hero glass-panel">
      <span>Audit trail</span>
      <strong>${state.auditLog.length}</strong>
      <p>Здесь видно, что предложил агент, что было принято, что ушло в действия и какие настройки менялись.</p>
    </section>
    <section class="timeline glass-panel">
      ${state.auditLog.map((event) => `
        <article class="timeline-item">
          <time>${new Date(event.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
          <div>
            <strong>${escapeHtml(event.label)}</strong>
            <p>${escapeHtml(event.detail)}</p>
            <small>${escapeHtml(eventTypeLabel(event.type))}</small>
          </div>
        </article>
      `).join("") || "<p>Журнал пока пуст.</p>"}
    </section>
  </div>`;
}

function renderActions() {
  const actions = getFilteredActions();
  return `<div class="actions-board">
    <div class="filter-bar">
      ${actionFilterButton("open", "Новые")}
      ${actionFilterButton("progress", "В работе")}
      ${actionFilterButton("done", "Готово")}
      ${actionFilterButton("all", "Все")}
    </div>
    <div class="action-grid">
      ${actions.map(renderActionCard).join("") || `<div class="empty-state glass-panel">Нет действий под этот фильтр.</div>`}
    </div>
  </div>`;
}

function actionFilterButton(id, label) {
  return `<button class="chip ${state.actionFilter === id ? "active" : ""}" data-action-filter="${id}">${label}</button>`;
}

function renderActionCard(action) {
  const note = state.notes.find((item) => item.id === action.noteId);
  return `<article class="action-card glass-panel">
    <div class="action-card-head">
      <span class="status ${action.status}">${actionStatusLabel(action.status)}</span>
      <span>${escapeHtml(actionLabel(action.type))}</span>
    </div>
    <h2>${escapeHtml(action.title)}</h2>
    <p>${escapeHtml(action.text)}</p>
    ${note ? `<small>${escapeHtml(note.space)} · ${escapeHtml(note.analysis.topic)}</small>` : `<small>Связанная заметка не найдена</small>`}
    <div class="action-controls">
      ${actionStatuses.map((status) => `<button class="ghost small ${action.status === status ? "selected" : ""}" data-action-status="${status}" data-action-id="${action.id}">${actionStatusLabel(status)}</button>`).join("")}
      ${note ? `<button class="ghost small" data-open-note="${note.id}">Открыть заметку</button>` : ""}
    </div>
  </article>`;
}

function renderReminders(reminders) {
  const followups = getActionsByType("followup");
  const softReminders = reminders.filter((note) => note.analysis.reminderKind === "suggested").length;
  return `<div class="reminders-layout">
    <section class="timeline glass-panel">
      ${followups.map((action) => renderActionItem(action)).join("")}
      ${reminders.map((note) => `
        <article class="timeline-item ${note.analysis.signal === "Сильный" ? "urgent" : ""}">
          <time>${escapeHtml(reminderLabel(note))}</time>
          <div>
            <strong>${escapeHtml(note.analysis.people[0] || note.analysis.topic)}</strong>
            ${reminderHint(note)}
            <p>${escapeHtml(note.text)}</p>
          </div>
        </article>
      `).join("") || (!followups.length ? "<p>Напоминаний пока нет.</p>" : "")}
    </section>
    <aside class="notification-card glass-panel">
      <div class="panel-title">Уведомления</div>
      <h2>Локальный центр готов</h2>
      <p>Сейчас приложение показывает follow-up внутри интерфейса. После интеграций этот же список можно отправлять в Telegram, календарь или системные push-уведомления.</p>
      <div class="status-checklist">
        <span><b>${reminders.length}</b> сроков из заметок</span>
        <span><b>${followups.length}</b> follow-up действий</span>
        <span><b>${softReminders}</b> мягких сроков</span>
      </div>
    </aside>
  </div>`;
}

function renderCalendarPlan() {
  const buckets = getCalendarBuckets();

  return `<div class="planner">
    <section class="planner-main glass-panel">
      <div class="section-head">
        <div>
          <span class="eyebrow">Черновик календаря</span>
          <h2>Неделя и черновики</h2>
        </div>
        <button class="ghost" data-open-view="integrations">Настроить календарь</button>
      </div>
      <div class="calendar-board">
        ${Object.entries(buckets).map(([key, bucket]) => renderCalendarColumn(key, bucket)).join("")}
      </div>
    </section>
    <aside class="planner-side glass-panel">
      <div class="panel-title">Calendar logic</div>
      <p>Позже здесь будет синхронизация с ${escapeHtml(state.settings.calendarProvider)}: создание события, agenda, контекст перед встречей и follow-up после нее.</p>
    </aside>
  </div>`;
}

function renderCalendarColumn(key, bucket) {
  return `<article class="calendar-column">
    <div class="section-head">
      <h2>${escapeHtml(bucket.label)}</h2>
      <span class="status planned">${bucket.items.length}</span>
    </div>
    ${bucket.items.map(renderCalendarItem).join("") || `<div class="empty-state">Пока пусто.</div>`}
  </article>`;
}

function renderCalendarItem(item) {
  if (item.kind === "action") {
    return `<div class="calendar-item">
      <b>${escapeHtml(item.title)}</b>
      <span>${escapeHtml(actionLabel(item.type))} · ${escapeHtml(actionStatusLabel(item.status))}</span>
      <p>${escapeHtml(item.text)}</p>
    </div>`;
  }
  return `<div class="calendar-item">
    <b>${escapeHtml(item.analysis.topic)}</b>
    <span>${escapeHtml(reminderLabel(item))} · ${escapeHtml(item.space)}</span>
    ${reminderHint(item)}
    <p>${escapeHtml(item.analysis.summary)}</p>
  </div>`;
}

function renderDigest(digest) {
  return `<div class="digest">
    <section class="digest-hero glass-panel">
      <span>Сегодня в фокусе</span>
      <strong>${digest.items.length}</strong>
      <p>${escapeHtml(digest.summary)}</p>
    </section>
    <section class="digest-list glass-panel">
      <div class="section-head">
        <h2>Утренний дайджест</h2>
        <button class="ghost" data-copy-digest="true">Собрать текст</button>
      </div>
      ${digest.items.map((item) => `
        <article>
          <b>${escapeHtml(item.label)}</b>
          <span>${escapeHtml(item.meta)}</span>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `).join("") || "<p>Пока нечего подсвечивать.</p>"}
    </section>
  </div>`;
}

function renderRadar(signals) {
  return `<div class="radar">
    <section class="radar-hero glass-panel">
      <span>Активных сигналов</span>
      <strong>${signals.length}</strong>
      <p>Срочные темы, зависшие договоренности, повторяющиеся проблемы и важные сигналы будут попадать сюда.</p>
    </section>
    <section class="radar-list glass-panel">
      ${signals.map((note) => `
        <article>
          <b>${note.analysis.signal}</b>
          <span>${note.analysis.topic}</span>
          <p>${escapeHtml(note.text)}</p>
        </article>
      `).join("") || "<p>Критичных сигналов пока нет.</p>"}
    </section>
  </div>`;
}

function renderIntegrations() {
  return `<div class="integrations">
    ${state.integrations.map((integration) => `
      <article class="integration-card glass-panel">
        <div>
          <span class="status ${integration.status}">${statusLabel(integration.status)}</span>
          <h2>${escapeHtml(integration.name)}</h2>
          <p>${escapeHtml(integration.description)}</p>
          <small>${escapeHtml(integrationReadiness(integration.id))}</small>
        </div>
        <button class="ghost" data-connect="${integration.id}">${integrationActionLabel(integration.status)}</button>
      </article>
    `).join("")}
  </div>`;
}

function renderSettings() {
  return `<div class="settings-grid">
    <section class="settings-card glass-panel">
      <span class="eyebrow">AI agent</span>
      <h2>${escapeHtml(state.settings.aiProvider)}</h2>
      <p>Анализ заметок, выделение решений, сроков, людей, тредов и рекомендаций. В production ключ OpenRouter будет храниться только на VPS API.</p>
    </section>
    <section class="settings-card glass-panel">
      <span class="eyebrow">Privacy</span>
      <h2>${state.settings.privacyMode ? "Приватный режим включен" : "Приватный режим выключен"}</h2>
      <p>Локальное хранение, скрытие приватных заметок, маскирование чувствительных данных и обязательное подтверждение перед внешними действиями.</p>
      <div class="settings-actions">
        <button class="ghost" data-toggle-setting="privacyMode">${state.settings.privacyMode ? "Выключить" : "Включить"}</button>
        <button class="ghost" data-toggle-setting="hidePrivate">${state.settings.hidePrivate ? "Показывать приватные" : "Скрывать приватные"}</button>
        <button class="ghost" data-toggle-setting="maskSensitive">${state.settings.maskSensitive ? "Не маскировать" : "Маскировать"}</button>
        <button class="ghost" data-toggle-setting="confirmExternalActions">${state.settings.confirmExternalActions ? "Без подтверждений" : "Требовать подтверждение"}</button>
      </div>
    </section>
    <section class="settings-card glass-panel">
      <span class="eyebrow">AI boundary</span>
      <h2>${aiScopeLabel(state.settings.aiScope)}</h2>
      <p>До интеграций фиксируем правило: агент получает только нужный контекст, приватные заметки можно исключить или замаскировать.</p>
      <div class="segmented">
        ${["local", "selected", "all"].map((scope) => `<button class="chip ${state.settings.aiScope === scope ? "active" : ""}" data-ai-scope="${scope}">${aiScopeLabel(scope)}</button>`).join("")}
      </div>
    </section>
    <section class="settings-card glass-panel">
      <span class="eyebrow">Desktop app</span>
      <h2>${state.settings.desktopMode ? "macOS-ready режим" : "Web-only режим"}</h2>
      <p>Интерфейс держим совместимым с будущей Tauri/macOS оболочкой: без клиентских API-ключей, с локальным состоянием и отдельным backend API.</p>
      <button class="ghost" data-toggle-setting="desktopMode">${state.settings.desktopMode ? "Отключить" : "Включить"}</button>
    </section>
    <section class="settings-card glass-panel">
      <span class="eyebrow">Digest</span>
      <h2>${state.settings.dailyDigest ? "Ежедневный дайджест включен" : "Дайджест выключен"}</h2>
      <p>Сводка важных заметок, обещаний, сроков и сигналов. Позже сможет приходить в Telegram или push-уведомлением.</p>
      <button class="ghost" data-toggle-setting="dailyDigest">${state.settings.dailyDigest ? "Выключить" : "Включить"}</button>
    </section>
    <section class="settings-card glass-panel">
      <span class="eyebrow">Local data</span>
      <h2>Резервная копия</h2>
      <p>Пока нет аккаунта и синхронизации, можно выгрузить локальное состояние приложения в JSON, восстановить его обратно или сбросить демо-данные.</p>
      <div class="settings-actions">
        <button class="ghost" data-export-state="true">Экспорт JSON</button>
        <label class="ghost import-button">
          Импорт JSON
          <input id="importStateFile" type="file" accept="application/json" />
        </label>
        <button class="ghost danger" data-reset-state="true">Сбросить демо</button>
      </div>
    </section>
    <section class="settings-card glass-panel">
      <span class="eyebrow">Sync</span>
      <h2>${state.settings.syncEnabled ? "Синхронизация включена" : "Синхронизация выключена"}</h2>
      <p>Введи личный синхро-код на Mac, iPhone или в другом браузере. Заметки будут храниться на VPS и подтягиваться по этому коду.</p>
      <label class="setting-field">
        <span>Синхро-код</span>
        <input id="syncCode" class="text-control" type="password" autocomplete="off" value="${escapeHtml(state.settings.syncCode || "")}" placeholder="Минимум 6 символов" />
      </label>
      <small class="sync-status">${escapeHtml(syncStatusText())}</small>
      <div class="settings-actions">
        <button class="ghost" data-save-sync-code="true">${state.settings.syncEnabled ? "Обновить код" : "Подключить"}</button>
        <button class="ghost" data-sync-pull="true">Загрузить с сервера</button>
        <button class="ghost" data-sync-push="true">Сохранить на сервер</button>
        <button class="ghost danger" data-sync-disable="true">Отключить</button>
      </div>
    </section>
  </div>`;
}

function renderActionLog(noteId) {
  const actions = state.actions.filter((action) => action.noteId === noteId);
  if (!actions.length) return "";
  return `<div class="action-log">
    <div class="panel-title">Created actions</div>
    ${actions.map((action) => `<span>${escapeHtml(actionLabel(action.type))} · ${escapeHtml(actionStatusLabel(action.status))}</span>`).join("")}
  </div>`;
}

function renderActionItem(action) {
  return `<article class="timeline-item">
    <time>${escapeHtml(actionLabel(action.type))}</time>
    <div>
      <strong>${escapeHtml(action.title)}</strong>
      <p>${escapeHtml(action.text)}</p>
      <small>${escapeHtml(actionStatusLabel(action.status))}</small>
    </div>
  </article>`;
}

function getFilteredNotes() {
  const query = state.query.trim().toLowerCase();
  return state.notes.filter((note) => {
    if (state.activeFilter === "active" && note.status === "archived") return false;
    if (state.activeFilter === "archived" && note.status !== "archived") return false;
    if (state.activeFilter === "favorites" && !note.favorite) return false;
    if (state.activeFilter === "sensitive" && !note.sensitive) return false;
    if (state.settings.hidePrivate && note.sensitive && state.activeFilter !== "sensitive") return false;
    if (!query) return true;
    return `${note.text} ${note.space} ${note.analysis.topic} ${note.analysis.people.join(" ")}`.toLowerCase().includes(query);
  });
}

function getVisibleNotes() {
  return state.notes.filter((note) => note.status !== "archived" && !(state.settings.hidePrivate && note.sensitive));
}

function getTopicNames() {
  return [...dictionaries.topics.map(([topic]) => topic), "Общее"];
}

function getPeople() {
  const map = new Map();
  getVisibleNotes().forEach((note) => {
    note.analysis.people.forEach((name) => {
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(note);
    });
  });
  return [...map.entries()].map(([name, notes]) => ({ name, notes, last: notes[0] }));
}

function getTopics() {
  const map = new Map();
  getVisibleNotes().forEach((note) => {
    if (!map.has(note.analysis.topic)) map.set(note.analysis.topic, []);
    map.get(note.analysis.topic).push(note);
  });
  return [...map.entries()].map(([name, notes]) => ({ name, notes }));
}

function getActionsByType(type) {
  return state.actions.filter((action) => action.type === type);
}

function getFilteredActions() {
  if (state.actionFilter === "all") return state.actions;
  return state.actions.filter((action) => action.status === state.actionFilter);
}

function getPendingSuggestions() {
  return state.suggestions.filter((suggestion) => {
    const note = state.notes.find((item) => item.id === suggestion.noteId);
    if (!note || suggestion.status !== "pending") return false;
    if (state.settings.hidePrivate && note.sensitive) return false;
    return true;
  });
}

function getDigest() {
  const reminders = getVisibleNotes().filter((note) => note.analysis.reminder);
  const signals = getVisibleNotes().filter((note) => note.analysis.signal !== "Обычный");
  const actions = state.actions.slice(0, 4);
  const items = [
    ...reminders.map((note) => ({ label: note.analysis.reminderKind === "suggested" ? "Мягкий срок" : "Срок", meta: reminderLabel(note), text: note.analysis.summary })),
    ...signals.map((note) => ({ label: "Сигнал", meta: note.analysis.topic, text: note.analysis.summary })),
    ...actions.map((action) => ({
      label: actionLabel(action.type),
      meta: new Date(action.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      text: action.text,
    })),
  ].slice(0, 8);

  return {
    items,
    summary: items.length
      ? "Собрала сроки, важные сигналы и созданные действия из последних заметок."
      : "Пока нет сроков или сигналов. Добавь заметку с датой, обещанием или срочной темой.",
  };
}

function getTodayData() {
  const todayLabel = formatDate(new Date());
  const tomorrowLabel = formatDate(addDays(new Date(), 1));
  const visibleNotes = getVisibleNotes();
  const reminders = visibleNotes
    .filter((note) => note.analysis.reminder)
    .sort((a, b) => reminderWeight(a.analysis.reminder, todayLabel, tomorrowLabel) - reminderWeight(b.analysis.reminder, todayLabel, tomorrowLabel))
    .slice(0, 6);
  const actions = state.actions
    .filter((action) => action.status !== "done")
    .slice(0, 6);
  const signals = visibleNotes
    .filter((note) => note.analysis.signal !== "Обычный")
    .slice(0, 6);
  const total = reminders.length + actions.length + signals.length;

  return {
    reminders,
    actions,
    signals,
    total,
    summary: total
      ? "Собрала ближайшие сроки, открытые действия и важные сигналы."
      : "На сегодня нет явных сроков, действий или сигналов.",
  };
}

function getCalendarBuckets() {
  const todayLabel = formatDate(new Date());
  const tomorrowLabel = formatDate(addDays(new Date(), 1));
  const buckets = {
    today: { label: "Сегодня", items: [] },
    tomorrow: { label: "Завтра", items: [] },
    later: { label: "Позже", items: [] },
    nodate: { label: "Без даты", items: [] },
  };

  getVisibleNotes().forEach((note) => {
    const key = note.analysis.reminder === todayLabel
      ? "today"
      : note.analysis.reminder === tomorrowLabel
        ? "tomorrow"
        : note.analysis.reminder
          ? "later"
          : "nodate";
    buckets[key].items.push(note);
  });

  state.actions
    .filter((action) => ["calendar", "agenda"].includes(action.type) && action.status !== "done")
    .forEach((action) => {
      buckets.nodate.items.unshift({ ...action, kind: "action" });
    });

  Object.values(buckets).forEach((bucket) => {
    bucket.items = bucket.items.slice(0, 8);
  });

  return buckets;
}

function reminderWeight(reminder, todayLabel, tomorrowLabel) {
  if (reminder === todayLabel) return 0;
  if (reminder === tomorrowLabel) return 1;
  return 2;
}

function createAction(type, noteId) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return;
  const action = {
    id: createId(),
    noteId,
    type,
    status: "open",
    title: buildActionTitle(type, note),
    text: note.analysis.action,
    createdAt: new Date().toISOString(),
  };
  state.actions.unshift(action);
  addAuditEvent("action", "Создано действие", `${actionLabel(type)} из заметки: ${note.analysis.summary}`);
  saveState();
  render();
}

function queueSuggestionsForNote(note) {
  state.suggestions = state.suggestions.filter((suggestion) => suggestion.noteId !== note.id || suggestion.status !== "pending");
  state.suggestions.unshift(...buildSuggestionsForNote(note));
  const existingJob = state.jobs.find((job) => job.noteId === note.id);
  if (existingJob) {
    Object.assign(existingJob, buildPipelineJob(note), { id: existingJob.id });
  } else {
    state.jobs.unshift(buildPipelineJob(note));
  }
}

function buildSuggestionsForNote(note) {
  const suggestions = [];
  const base = {
    noteId: note.id,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  if (note.analysis.tasks.length || note.analysis.reminder || note.analysis.signal !== "Обычный") {
    suggestions.push({
      ...base,
      id: createId(),
      kind: "followup",
      title: buildActionTitle("followup", note),
      text: note.analysis.action,
      payload: { actionType: "followup" },
    });
  }

  if (note.analysis.reminder) {
    const reminderText = note.analysis.reminderKind === "suggested"
      ? `Предлагаю мягкое напоминание на ${note.analysis.reminder}, потому что точного срока в заметке нет: ${note.analysis.summary}`
      : `Предлагаю вынести это в календарь как черновик события или напоминания: ${note.analysis.summary}`;
    suggestions.push({
      ...base,
      id: createId(),
      kind: "calendar",
      title: `Черновик календаря: ${note.analysis.reminder}`,
      text: reminderText,
      payload: { actionType: "calendar", reminder: note.analysis.reminder },
    });
  }

  if (note.analysis.decisions.length) {
    suggestions.push({
      ...base,
      id: createId(),
      kind: "decision",
      title: "Зафиксировать решение",
      text: `В заметке есть решение. Лучше сохранить его в треде и добавить контрольный follow-up.`,
      payload: { actionType: "thread-summary" },
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      ...base,
      id: createId(),
      kind: "thread",
      title: `Связать с тредом: ${note.analysis.topic}`,
      text: "Предлагаю оставить как контекст и связать с похожими заметками.",
      payload: { topic: note.analysis.topic },
    });
  }

  return suggestions.slice(0, 3);
}

function buildPipelineJob(note) {
  return {
    id: createId(),
    noteId: note.id,
    type: "note-analysis",
    status: "review",
    label: note.analysis.summary,
    steps: ["capture", "analysis", "review"],
    createdAt: note.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function acceptSuggestion(id) {
  const suggestion = state.suggestions.find((item) => item.id === id);
  if (!suggestion || suggestion.status !== "pending") return;
  const note = state.notes.find((item) => item.id === suggestion.noteId);
  suggestion.status = "accepted";
  suggestion.resolvedAt = new Date().toISOString();

  if (suggestion.payload?.actionType && note) {
    const type = suggestion.payload.actionType === "thread-summary" ? "followup" : suggestion.payload.actionType;
    state.actions.unshift({
      id: createId(),
      noteId: note.id,
      type,
      status: "open",
      title: suggestion.title,
      text: suggestion.text,
      createdAt: new Date().toISOString(),
    });
  }

  markJobDone(suggestion.noteId);
  addAuditEvent("ai", "AI-предложение принято", suggestion.title);
  saveState();
  render();
}

function dismissSuggestion(id) {
  const suggestion = state.suggestions.find((item) => item.id === id);
  if (!suggestion || suggestion.status !== "pending") return;
  suggestion.status = "dismissed";
  suggestion.resolvedAt = new Date().toISOString();
  addAuditEvent("ai", "AI-предложение отклонено", suggestion.title);
  saveState();
  render();
}

function markJobDone(noteId) {
  const pendingForNote = state.suggestions.some((suggestion) => suggestion.noteId === noteId && suggestion.status === "pending");
  const job = state.jobs.find((item) => item.noteId === noteId);
  if (job && !pendingForNote) {
    job.status = "done";
    job.steps = ["capture", "analysis", "review"];
    job.updatedAt = new Date().toISOString();
  }
}

function normalizeAction(action) {
  return {
    status: "open",
    createdAt: new Date().toISOString(),
    ...action,
  };
}

function normalizeSuggestion(suggestion) {
  return {
    id: suggestion.id || createId(),
    status: suggestionStatuses.includes(suggestion.status) ? suggestion.status : "pending",
    kind: suggestion.kind || "thread",
    payload: suggestion.payload || {},
    createdAt: suggestion.createdAt || new Date().toISOString(),
    ...suggestion,
  };
}

function normalizePipelineJob(job) {
  return {
    id: job.id || createId(),
    type: job.type || "note-analysis",
    status: job.status || "review",
    steps: job.steps || ["capture", "analysis", "review"],
    createdAt: job.createdAt || new Date().toISOString(),
    updatedAt: job.updatedAt || new Date().toISOString(),
    ...job,
  };
}

function normalizeAuditEvent(event) {
  return {
    id: event.id || createId(),
    type: event.type || "system",
    label: event.label || "Событие",
    detail: event.detail || "",
    createdAt: event.createdAt || new Date().toISOString(),
  };
}

function buildAuditEvent(type, label, detail) {
  return {
    id: createId(),
    type,
    label,
    detail,
    createdAt: new Date().toISOString(),
  };
}

function addAuditEvent(type, label, detail) {
  if (!state.settings?.keepAuditLog) return;
  state.auditLog.unshift(buildAuditEvent(type, label, detail));
  state.auditLog = state.auditLog.slice(0, 80);
}

function parsePeopleInput(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function buildActionTitle(type, note) {
  const target = note.analysis.people[0] || note.analysis.topic;
  if (type === "calendar") return `Календарь: ${target}`;
  if (type === "agenda") return `Agenda: ${target}`;
  if (type === "prep") return `Подготовка: ${target}`;
  if (type === "postmeeting") return `Итоги: ${target}`;
  return `Follow-up: ${target}`;
}

function actionLabel(type) {
  return {
    followup: "Follow-up",
    calendar: "Календарь",
    agenda: "Agenda",
    prep: "Подготовка",
    postmeeting: "Итоги",
    "thread-summary": "Summary",
  }[type] || "Действие";
}

function actionStatusLabel(status) {
  return {
    open: "Новое",
    progress: "В работе",
    done: "Готово",
  }[status] || status;
}

function reminderLabel(item) {
  return item.analysis?.reminder || "Нет";
}

function reminderHint(item) {
  if (item.analysis?.reminderKind !== "suggested") return "";
  const reason = item.analysis.reminderReason || "Точного срока нет, поставлен мягкий follow-up.";
  return `<small class="meta-hint">${escapeHtml(reason)}</small>`;
}

function suggestionLabel(kind) {
  return {
    followup: "Follow-up",
    calendar: "Календарь",
    decision: "Решение",
    thread: "Тред",
  }[kind] || "Предложение";
}

function jobStatusLabel(status) {
  return {
    review: "Ждет решения",
    done: "Разобрано",
    queued: "В очереди",
  }[status] || status;
}

function eventTypeLabel(type) {
  return {
    system: "Система",
    note: "Заметка",
    ai: "AI Review",
    action: "Действие",
    settings: "Настройки",
    integration: "Интеграция",
  }[type] || type;
}

function aiScopeLabel(scope) {
  return {
    local: "Только локально",
    selected: "Только выбранные",
    all: "Все заметки",
  }[scope] || "Только выбранные";
}

function statusLabel(status) {
  return {
    connected: "Подключено",
    planned: "MVP-контур",
    later: "Позже",
  }[status] || status;
}

function integrationActionLabel(status) {
  if (status === "connected") return "Проверить";
  if (status === "later") return "В очередь";
  return "Проверить контур";
}

function integrationReadiness(id) {
  return {
    openrouter: "UI и QA-агенты готовы. В приложении пока локальный анализ; реальный OpenRouter нужно подключать через VPS API.",
    "yandex-calendar": "Сейчас создаются календарные черновики внутри приложения. Внешняя запись в календарь будет следующим этапом.",
    telegram: "Telegram-бот пока не подключен. Контур нужен для быстрого ввода, дайджестов и уведомлений.",
    sync: state.settings.syncEnabled
      ? `Серверное хранилище включено. ${syncStatusText()}`
      : "Серверное хранилище готово. Включи его в настройках через личный синхро-код.",
  }[id] || "Контур интеграции отмечен, внешнее подключение еще не выполняется.";
}

function syncStatusText() {
  const parts = [state.settings.syncStatus || "Не подключено"];
  if (state.settings.syncUpdatedAt) {
    parts.push(`последнее обновление: ${new Date(state.settings.syncUpdatedAt).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })}`);
  }
  return parts.join(" · ");
}

function setSyncStatus(status, updatedAt = state.settings.syncUpdatedAt || "") {
  state.settings.syncStatus = status;
  state.settings.syncUpdatedAt = updatedAt;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState({ includeLocalSync: true })));
}

function getSyncCode() {
  return String(state.settings.syncCode || "").trim();
}

function canSync() {
  return state.settings.syncEnabled && getSyncCode().length >= 6;
}

function scheduleSyncPush() {
  if (isApplyingRemoteState || !canSync()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    pushSyncState({ silent: true });
  }, 900);
}

async function requestSync(path, payload) {
  const response = await fetch(`${SYNC_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Sync request failed with ${response.status}`);
  }
  return data;
}

async function pushSyncState({ silent = false } = {}) {
  if (!canSync()) {
    if (!silent) setSyncStatus("Введите синхро-код минимум 6 символов.");
    return;
  }

  try {
    if (!silent) setSyncStatus("Сохраняю на сервер...");
    const data = await requestSync("/sync/push", {
      workspaceKey: getSyncCode(),
      state: serializeState({ includeLocalSync: false }),
    });
    setSyncStatus("Сохранено на сервере", data.updatedAt || new Date().toISOString());
    if (!silent) render();
  } catch (error) {
    setSyncStatus(`Ошибка синхронизации: ${error.message}`);
    if (!silent) render();
  }
}

async function pullSyncState() {
  if (!canSync()) {
    setSyncStatus("Введите синхро-код минимум 6 символов.");
    render();
    return;
  }

  try {
    setSyncStatus("Загружаю с сервера...");
    render();
    const data = await requestSync("/sync/pull", { workspaceKey: getSyncCode() });
    if (!data.exists) {
      setSyncStatus("На сервере пока пусто. Сохрани текущие заметки.");
      render();
      return;
    }

    const syncCode = state.settings.syncCode;
    const imported = normalizeAppState(data.state || {});
    isApplyingRemoteState = true;
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, imported, {
      settings: {
        ...imported.settings,
        syncEnabled: true,
        syncCode,
        syncStatus: "Загружено с сервера",
        syncUpdatedAt: data.updatedAt || new Date().toISOString(),
      },
      activeView: "inbox",
      activeFilter: "all",
      query: "",
      editingNoteId: "",
    });
    state.selectedNoteId = state.notes[0]?.id || "";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState({ includeLocalSync: true })));
    isApplyingRemoteState = false;
    render();
  } catch (error) {
    isApplyingRemoteState = false;
    setSyncStatus(`Ошибка синхронизации: ${error.message}`);
    render();
  }
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-open-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.openView;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-note]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedNoteId = button.dataset.note;
      state.editingNoteId = "";
      saveState();
      render();
    });
  });

  document.querySelector("#search")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    saveState();
    render();
    restoreSearchFocus();
  });

  document.querySelector("#addNote")?.addEventListener("click", () => {
    const textarea = document.querySelector("#noteText");
    const space = document.querySelector("#noteSpace")?.value || "Личное";
    const text = textarea.value.trim();
    if (!text) return;
    const note = enrichNote({ id: createId(), text, space, createdAt: new Date().toISOString() });
    state.notes.unshift(note);
    queueSuggestionsForNote(note);
    addAuditEvent("note", "Создана заметка", note.analysis.summary);
    state.selectedNoteId = note.id;
    textarea.value = "";
    saveState();
    render();
  });

  document.querySelectorAll("[data-template]").forEach((button) => {
    button.addEventListener("click", () => {
      const template = noteTemplates.find((item) => item.id === button.dataset.template);
      const textarea = document.querySelector("#noteText");
      const space = document.querySelector("#noteSpace");
      if (!template || !textarea) return;
      textarea.value = template.text;
      if (space) space.value = template.space;
      textarea.focus();
    });
  });

  document.querySelector("[data-open-command]")?.addEventListener("click", () => {
    state.commandOpen = true;
    render();
  });

  document.querySelectorAll("[data-close-command]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (!event.target.closest(".command-panel") || event.target.dataset.closeCommand) {
        state.commandOpen = false;
        render();
      }
    });
  });

  document.querySelectorAll("[data-command-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.commandView;
      state.commandOpen = false;
      saveState();
      render();
    });
  });

  document.querySelector("[data-command-focus-note]")?.addEventListener("click", () => {
    state.activeView = "inbox";
    state.commandOpen = false;
    saveState();
    render();
    document.querySelector("#noteText")?.focus();
  });

  document.querySelector("[data-command-followup]")?.addEventListener("click", () => {
    if (state.selectedNoteId) createAction("followup", state.selectedNoteId);
    state.commandOpen = false;
    state.activeView = "actions";
    saveState();
    render();
  });

  document.querySelectorAll("[data-note-action]").forEach((button) => {
    button.addEventListener("click", () => createAction(button.dataset.action, button.dataset.noteAction));
  });

  document.querySelectorAll("[data-edit-note]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingNoteId = button.dataset.editNote;
      saveState();
      render();
    });
  });

  document.querySelector("[data-cancel-edit]")?.addEventListener("click", () => {
    state.editingNoteId = "";
    saveState();
    render();
  });

  document.querySelectorAll("[data-save-note]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = state.notes.find((item) => item.id === button.dataset.saveNote);
      const text = document.querySelector("#editNoteText")?.value.trim();
      const space = document.querySelector("#editNoteSpace")?.value;
      const topic = document.querySelector("#editNoteTopic")?.value;
      const signal = document.querySelector("#editNoteSignal")?.value;
      const reminder = document.querySelector("#editNoteReminder")?.value.trim();
      const people = parsePeopleInput(document.querySelector("#editNotePeople")?.value || "");
      if (!note || !text || !space) return;
      Object.assign(note, enrichNote({
        ...note,
        text,
        space,
        analysisOverrides: {
          topic,
          signal,
          reminder: reminder || null,
          reminderKind: reminder ? "exact" : null,
          reminderReason: reminder ? "Срок задан вручную." : "",
          people,
          urgency: reminder ? "Есть срок" : signal === "Сильный" ? "Следить" : "Без срока",
        },
        updatedAt: new Date().toISOString(),
      }));
      queueSuggestionsForNote(note);
      addAuditEvent("note", "Заметка обновлена", note.analysis.summary);
      state.editingNoteId = "";
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.actionFilter = button.dataset.actionFilter;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action-status]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = state.actions.find((item) => item.id === button.dataset.actionId);
      if (!action) return;
      action.status = button.dataset.actionStatus;
      action.updatedAt = new Date().toISOString();
      state.actionFilter = action.status;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-open-note]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedNoteId = button.dataset.openNote;
      state.activeView = "inbox";
      state.activeFilter = "all";
      state.query = "";
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-toggle-note]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = state.notes.find((item) => item.id === button.dataset.noteId);
      if (!note) return;
      note[button.dataset.toggleNote] = !note[button.dataset.toggleNote];
      addAuditEvent("note", "Изменен статус заметки", `${note.analysis.summary}: ${button.dataset.toggleNote}`);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-archive-note]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = state.notes.find((item) => item.id === button.dataset.archiveNote);
      if (!note) return;
      note.status = note.status === "archived" ? "active" : "archived";
      if (note.status === "archived") {
        state.selectedNoteId = getFilteredNotes().find((item) => item.id !== note.id)?.id || "";
      } else {
        state.selectedNoteId = note.id;
      }
      addAuditEvent("note", note.status === "archived" ? "Заметка в архиве" : "Заметка возвращена", note.analysis.summary);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-thread]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedThread = button.dataset.thread;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-thread-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const thread = getTopics().find((item) => item.name === button.dataset.threadAction);
      if (!thread) return;
      state.actions.unshift({
        id: createId(),
        noteId: thread.notes[0].id,
        type: "thread-summary",
        status: "open",
        title: `Summary: ${thread.name}`,
        text: `${thread.notes.length} заметки в треде. Главный контекст: ${thread.notes[0].analysis.summary}`,
        createdAt: new Date().toISOString(),
      });
      addAuditEvent("action", "Создан summary треда", thread.name);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-accept-suggestion]").forEach((button) => {
    button.addEventListener("click", () => acceptSuggestion(button.dataset.acceptSuggestion));
  });

  document.querySelectorAll("[data-dismiss-suggestion]").forEach((button) => {
    button.addEventListener("click", () => dismissSuggestion(button.dataset.dismissSuggestion));
  });

  document.querySelectorAll("[data-toggle-setting]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggleSetting;
      state.settings[key] = !state.settings[key];
      addAuditEvent("settings", "Настройка изменена", `${key}: ${state.settings[key] ? "on" : "off"}`);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-ai-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.aiScope = button.dataset.aiScope;
      addAuditEvent("settings", "AI boundary изменен", aiScopeLabel(state.settings.aiScope));
      saveState();
      render();
    });
  });

  document.querySelector("[data-save-sync-code]")?.addEventListener("click", async () => {
    const syncCode = document.querySelector("#syncCode")?.value.trim() || "";
    state.settings.syncCode = syncCode;
    state.settings.syncEnabled = syncCode.length >= 6;
    setSyncStatus(state.settings.syncEnabled ? "Синхронизация подключена" : "Введите минимум 6 символов.");
    addAuditEvent("settings", "Синхронизация обновлена", state.settings.syncEnabled ? "Синхронизация включена" : "Код слишком короткий");
    saveState();
    render();
    if (state.settings.syncEnabled) await pushSyncState({ silent: false });
  });

  document.querySelector("[data-sync-push]")?.addEventListener("click", async () => {
    const syncCode = document.querySelector("#syncCode")?.value.trim() || state.settings.syncCode || "";
    state.settings.syncCode = syncCode;
    state.settings.syncEnabled = syncCode.length >= 6;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState({ includeLocalSync: true })));
    await pushSyncState({ silent: false });
  });

  document.querySelector("[data-sync-pull]")?.addEventListener("click", async () => {
    const syncCode = document.querySelector("#syncCode")?.value.trim() || state.settings.syncCode || "";
    state.settings.syncCode = syncCode;
    state.settings.syncEnabled = syncCode.length >= 6;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState({ includeLocalSync: true })));
    await pullSyncState();
  });

  document.querySelector("[data-sync-disable]")?.addEventListener("click", () => {
    state.settings.syncEnabled = false;
    state.settings.syncCode = "";
    setSyncStatus("Синхронизация отключена", "");
    addAuditEvent("settings", "Синхронизация отключена", "Локальные заметки остались в браузере.");
    saveState();
    render();
  });

  document.querySelectorAll("[data-connect]").forEach((button) => {
    button.addEventListener("click", () => {
      const integration = state.integrations.find((item) => item.id === button.dataset.connect);
      if (!integration) return;
      integration.status = "planned";
      addAuditEvent("integration", "Интеграция отмечена", integration.name);
      saveState();
      render();
    });
  });

  document.querySelector("[data-copy-digest]")?.addEventListener("click", () => {
    const digest = getDigest();
    const text = digest.items.map((item) => `${item.label}: ${item.text}`).join("\n");
    navigator.clipboard?.writeText(text);
  });

  document.querySelector("[data-export-state]")?.addEventListener("click", () => {
    exportState();
  });

  document.querySelector("#importStateFile")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    importStateFile(file);
  });

  document.querySelector("[data-reset-state]")?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });
}

function restoreSearchFocus() {
  const search = document.querySelector("#search");
  if (!search) return;
  search.focus();
  search.setSelectionRange(search.value.length, search.value.length);
}

function exportState() {
  const data = JSON.stringify({
    exportedAt: new Date().toISOString(),
    app: "AI Memory MVP",
    version: STORAGE_KEY,
    state,
  }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ai-memory-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importStateFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const imported = normalizeAppState(parsed.state || parsed);
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, imported, {
        activeView: "inbox",
        activeFilter: "all",
        query: "",
        editingNoteId: "",
      });
      state.selectedNoteId = state.notes[0]?.id || "";
      saveState();
      render();
    } catch (error) {
      window.alert("Не получилось импортировать JSON. Проверь файл экспорта.");
    }
  });
  reader.readAsText(file);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

if (shouldPersistAfterLoad) {
  saveState();
}

startIntro();
