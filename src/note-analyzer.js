import { normalizePersonName } from "./text-utils.js";

export const dictionaries = {
  topics: [
    ["Встречи", ["встреч", "созвон", "1:1", "обсудить", "переговор", "презентац"]],
    ["Проекты", ["проект", "релиз", "запуск", "дизайн", "разработка", "сайт"]],
    ["Задачи", ["задач", "нужно", "сделать", "проверить", "подготовить", "отправить", "создать", "написать", "уточнить", "согласовать", "договориться", "порешать", "отложить", "позвонить", "напомнить", "решить", "поднять"]],
    ["Люди", ["коллег", "друг", "клиент", "команда", "партнер", "руководител"]],
    ["Финансы", ["деньги", "оплат", "счет", "налог", "бюджет", "платеж"]],
    ["Обучение", ["курс", "книга", "обуч", "изуч", "лекц", "материал"]],
    ["Здоровье", ["врач", "здоров", "сон", "спорт", "трениров", "устал"]],
    ["Идеи", ["идея", "придумал", "концепт", "гипотез", "можно сделать"]],
  ],
  signalWords: ["срочно", "важно", "завис", "проблем", "риск", "горит", "просроч", "устал", "снова", "не забыть"],
  actionWords: ["нужно", "напомни", "напомнить", "вернуться", "запланировать", "обсудить", "подготовить", "проверить", "создать", "написать", "уточнить", "согласовать", "договориться", "порешать", "отложить", "позвонить", "решить", "поднять"],
};

export function analyzeNote(text, createdAt = new Date().toISOString()) {
  const lower = text.toLowerCase();
  const people = extractPeople(text);
  const topic = detectTopic(lower);
  const signalScore = dictionaries.signalWords.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
  const hasAction = dictionaries.actionWords.some((word) => lower.includes(word));
  const reminderDetails = detectReminderDetails(lower, createdAt, { hasAction, topic });

  return {
    topic,
    people,
    reminder: reminderDetails.label,
    reminderKind: reminderDetails.kind,
    reminderReason: reminderDetails.reason,
    signal: signalScore >= 2 ? "Сильный" : signalScore === 1 ? "Средний" : "Обычный",
    urgency: reminderDetails.kind === "suggested" ? "Мягкий срок" : reminderDetails.label ? "Есть срок" : signalScore > 1 ? "Следить" : "Без срока",
    summary: summarizeNote(text),
    decisions: extractDecisions(text),
    tasks: extractTasks(text),
    action: hasAction ? suggestAction(topic, signalScore, people) : "Сохранить как контекст и связать с похожими заметками.",
    confidence: Math.min(96, 68 + signalScore * 7 + people.length * 4 + (reminderDetails.label ? 9 : 0)),
  };
}

export function inferSpace(text) {
  const topic = detectTopic(text.toLowerCase());
  if (topic === "Финансы") return "Финансы";
  if (topic === "Обучение" || topic === "Здоровье") return "Личное";
  if (topic === "Проекты" || topic === "Встречи" || topic === "Задачи") return "Работа";
  return "Личное";
}

export function extractPeople(text) {
  const capitalizedMatches = text.match(/(?<![\p{L}])[А-ЯЁ][а-яё]{2,}(?![\p{L}])/gu) || [];
  const prepositionMatches = [...text.matchAll(/(?:^|[\s,.;:!?])(?:с|со|к|ко|у|от|для|по)\s+([а-яё]{3,})(?=$|[\s,.;:!?])/giu)]
    .map((match) => match[1]);
  const matches = [...capitalizedMatches, ...prepositionMatches];
  const ignored = new Set([
    "После",
    "Нужно",
    "Нужна",
    "Команда",
    "Написать",
    "Согласовать",
    "Уточнить",
    "Договориться",
    "Порешать",
    "Отложить",
    "Позвонить",
    "Решить",
    "Напомнить",
    "Запланировать",
    "Вернуться",
    "Обсудить",
    "Подготовить",
    "Проверить",
    "Создать",
    "Идея",
    "Встреча",
    "Участники",
    "Решили",
    "Срок",
    "Владелец",
    "Контекст",
    "Кто",
    "Личное",
    "Задача",
    "Срочно",
    "Важно",
    "Если",
    "Следующем",
    "Следующая",
    "Следующей",
    "Ближайшей",
    "Ответственный",
    "Нему",
    "Сегодня",
    "Завтра",
    "Через",
    "Несколько",
    "Среда",
    "Среду",
    "Среде",
    "Четверг",
    "Четвергу",
    "Пятница",
    "Пятницу",
    "Пятнице",
    "Суббота",
    "Субботу",
    "Субботе",
    "Воскресенье",
    "Воскресенью",
    "Макет",
    "Релиз",
    "Проект",
    "Проекту",
    "Счет",
    "Счета",
    "Бюджет",
    "Бюджету",
    "Срок",
    "Сроки",
    "Срокам",
    "Отчет",
    "Отчёт",
    "Детали",
    "Результатов",
    "Интеграции",
  ]);
  return [
    ...new Set(
      matches
        .map(normalizePersonName)
        .filter((word) => word && !ignored.has(word)),
    ),
  ].slice(0, 4);
}

export function detectTopic(lower) {
  if (lower.trim().startsWith("идея")) return "Идеи";
  if (lower.includes("встреч") || lower.includes("созвон")) return "Встречи";
  if (lower.includes("реш") && lower.includes("срок")) return "Проекты";
  const match = dictionaries.topics.find(([, words]) => words.some((word) => lower.includes(word)));
  return match ? match[0] : "Общее";
}

export function detectReminder(lower, createdAt) {
  return detectReminderDetails(lower, createdAt).label;
}

export function detectReminderDetails(lower, createdAt, options = {}) {
  const date = new Date(createdAt);
  if (lower.includes("перенести на завтра")) return exactReminder(addDays(date, 1), "Найден явный перенос на завтра.");
  if (lower.includes("завтра")) return exactReminder(addDays(date, 1), "Найден явный срок: завтра.");
  if (lower.includes("сегодня")) return exactReminder(date, "Найден явный срок: сегодня.");
  const relativeDays = detectRelativeDays(lower);
  if (relativeDays) return exactReminder(addDays(date, relativeDays), `Найден явный относительный срок: через ${relativeDays} дн.`);
  const weekday = detectWeekday(lower);
  if (weekday !== null) {
    return {
      label: nextWeekday(date, weekday),
      kind: "exact",
      reason: "Найден день недели.",
    };
  }
  if (lower.includes("недел")) return exactReminder(addDays(date, 7), "Найден относительный срок: неделя.");
  if (lower.includes("месяц")) return exactReminder(addDays(date, 30), "Найден относительный срок: месяц.");
  if (shouldSuggestSoftReminder(lower, options)) {
    return {
      label: formatDate(addDays(date, 3)),
      kind: "suggested",
      reason: "Точного срока нет, но есть действие. Поставлен мягкий follow-up через 3 дня.",
    };
  }
  return emptyReminder();
}

export function summarizeNote(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= 96 ? clean : `${clean.slice(0, 96)}...`;
}

export function extractDecisions(text) {
  return splitSentences(text)
    .filter((sentence) => /решил|решили|решить|решени|договорил|договорились|выбрали|утверд/i.test(sentence))
    .slice(0, 3);
}

export function extractTasks(text) {
  return splitSentences(text)
    .filter((sentence) => /нужно|сделать|проверить|подготовить|отправить|создать|вернуться|запланировать|обсудить|написать|уточнить|согласовать|договориться|порешать|отложить|позвонить|напомнить|решить|поднять/i.test(sentence))
    .slice(0, 4);
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function nextWeekday(date, weekday) {
  const copy = new Date(date);
  const diff = (weekday + 7 - copy.getDay()) % 7 || 7;
  copy.setDate(copy.getDate() + diff);
  return formatDate(copy);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
}

function suggestAction(topic, signalScore, people) {
  const person = people[0] || "участником";
  if (signalScore >= 2) return "Зафиксировать следующий шаг, срок и владельца; поставить напоминание, чтобы тема не зависла.";
  if (topic === "Проекты") return "Выделить решение, открытые вопросы и ближайшее действие; связать заметку с проектным тредом.";
  if (topic === "Встречи") return `Добавить в agenda следующей встречи и проверить, что договоренность с ${person} не потерялась.`;
  if (topic === "Финансы") return "Вынести платеж или проверку в follow-up и связать заметку с финансовым тредом.";
  if (topic === "Обучение") return "Сохранить материал, определить следующий шаг и поставить мягкое напоминание вернуться к нему.";
  return "Выделить следующий шаг, срок и владельца; связать заметку с текущим тредом.";
}

function detectWeekday(lower) {
  const weekdays = [
    [1, ["понедельник", "понедельнику"]],
    [2, ["вторник", "вторнику"]],
    [3, ["среда", "среду", "среде"]],
    [4, ["четверг", "четвергу"]],
    [5, ["пятница", "пятницу", "пятнице", "пятнич"]],
    [6, ["суббота", "субботу", "субботе"]],
    [0, ["воскресенье", "воскресенью"]],
  ];
  const match = weekdays.find(([, forms]) => forms.some((form) => lower.includes(form)));
  return match ? match[0] : null;
}

function detectRelativeDays(lower) {
  const match = lower.match(/через\s+(один|два|три|четыре|пять|шесть|семь|\d+)\s+дн/);
  if (!match) return null;
  const words = {
    один: 1,
    два: 2,
    три: 3,
    четыре: 4,
    пять: 5,
    шесть: 6,
    семь: 7,
  };
  return words[match[1]] || Number(match[1]) || null;
}

function exactReminder(date, reason) {
  return {
    label: formatDate(date),
    kind: "exact",
    reason,
  };
}

function emptyReminder() {
  return {
    label: null,
    kind: null,
    reason: "",
  };
}

function shouldSuggestSoftReminder(lower, { hasAction = false, topic = "" } = {}) {
  if (lower.includes("без срока")) return false;
  if (lower.includes("вчера")) return false;
  if (topic === "Идеи" && lower.trim().startsWith("идея")) return false;
  if (/через\s+несколько\s+дн/.test(lower)) return true;
  if (/(на днях|в ближайшее время|скоро|позже|потом|без точной даты|без точного срока|пока не назнач)/.test(lower)) return true;
  return hasAction;
}

function splitSentences(text) {
  return text.split(/[.!?;]+/).map((sentence) => sentence.trim()).filter(Boolean);
}
