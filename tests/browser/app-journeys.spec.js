import { expect, test } from "@playwright/test";

async function resetApp(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator("[data-skip-intro]").click();
  await expect(page.locator(".shell")).toBeVisible();
}

async function addNote(page, text) {
  await page.locator("#noteText").fill(text);
  await page.locator("#addNote").click();
  await expect(page.locator(".note-text")).toContainText(text);
}

async function openView(page, view) {
  const navButton = page.locator(`[data-view="${view}"]`);
  if (!(await navButton.isVisible())) {
    await page.locator("[data-open-command]").click();
    await page.locator(`[data-command-view="${view}"]`).click();
    return;
  }
  await navButton.click();
}

test.describe("AI Notes user journeys", () => {
  test("opens the command palette and returns focus to note input", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Напомнить Сергею завтра проверить договор");

    await page.locator("[data-open-command]").click();
    await expect(page.locator(".command-panel")).toBeVisible();
    await page.locator("[data-command-view='review']").click();
    await expect(page.locator("h1")).toContainText("ИИ-проверка");

    await page.locator("[data-open-command]").click();
    await page.locator("[data-command-focus-note]").click();
    await expect(page.locator("h1")).toContainText("Быстрые заметки");
    await expect(page.locator("#noteText")).toBeFocused();
  });

  test("creates a note, reviews AI suggestion, and completes an action", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Обсудить с Димой встречу в среду и подготовить список вопросов");

    await expect(page.locator(".meta-grid")).toContainText("10 июня");

    await openView(page, "review");
    await expect(page.locator("h1")).toContainText("ИИ-проверка");
    await expect(page.locator(".suggestion-card").first()).toBeVisible();
    await page.locator("[data-accept-suggestion]").first().click();

    await openView(page, "actions");
    await expect(page.locator(".action-card").first()).toBeVisible();
    await page.locator('[data-action-status="progress"]').first().click();
    await expect(page.locator(".action-card").first()).toContainText("В работе");
    await page.locator('[data-action-status="done"]').first().click();
    await expect(page.locator(".action-card").first()).toContainText("Готово");
  });

  test("edits deadline manually, then sees the note in calendar", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Созвониться по проекту и уточнить открытые вопросы");

    await page.locator("[data-edit-note]").click();
    await page.locator("#editNoteReminder").fill("15 июня");
    await page.locator("[data-save-note]").click();

    await expect(page.locator(".meta-grid")).toContainText("15 июня");

    await openView(page, "calendar");
    await expect(page.locator("h1")).toContainText("Календарный план");
    await expect(page.locator(".calendar-board")).toContainText("15 июня");
  });

  test("assigns a soft deadline when a task has no exact date", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Через несколько дней поднять вопрос о грейдировании в компании");

    await expect(page.locator(".meta-grid")).toContainText("Точного срока нет");

    await openView(page, "review");
    await expect(page.locator('.suggestion-card:has-text("мягкое напоминание")').first()).toBeVisible();

    await openView(page, "calendar");
    await expect(page.locator(".calendar-board")).toContainText("Точного срока нет");
  });

  test("creates actions from note AI recommendation and shows notification center", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Напомнить Сергею завтра проверить договор и вынести встречу в календарь");

    await page.locator(".insights summary").click();
    await expect(page.locator(".insights")).toContainText("Создать напоминание");
    await page.locator('[data-action="followup"]').click();
    await page.locator(".insights summary").click();
    await page.locator('[data-action="calendar"]').click();

    await openView(page, "reminders");
    await expect(page.locator(".notification-card")).toContainText("Локальный центр готов");
    await expect(page.locator(".timeline")).toContainText("Напоминание");

    await openView(page, "calendar");
    await expect(page.locator(".calendar-board")).toContainText("Календарь");
  });

  test("captures multiple participants and decisions in a complex meeting note", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Обсудить и принять решения по отчету и бюджету в пятницу с Иваном и Светой");

    await expect(page.locator(".meta-grid")).toContainText("12 июня");
    await expect(page.locator(".note-card.active")).toContainText("Решения");

    await page.locator(".insights summary").click();
    await page.locator('[data-action="agenda"]').click();

    await openView(page, "calendar");
    await expect(page.locator(".calendar-board")).toContainText("Повестка");
    await expect(page.locator(".calendar-board")).toContainText("Иваном и Светой");
  });

  test("integration cards expose current MVP readiness without claiming live sync", async ({ page }) => {
    await resetApp(page);
    await openView(page, "integrations");

    await expect(page.locator(".integration-card")).toContainText("OpenRouter");
    await expect(page.locator(".integration-card")).toContainText("Yandex Calendar");
    await expect(page.locator(".integration-card")).toContainText("Telegram");
    await expect(page.locator(".integration-card")).toContainText("реальный OpenRouter нужно подключать через серверный API");
    await expect(page.locator(".integration-card")).toContainText("Telegram-бот пока не подключен");

    await page.locator('[data-connect="telegram"]').click();
    await expect(page.locator(".integration-card")).toContainText("Telegram");
  });

  test("hides private notes from normal inbox views", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Личная приватная заметка с Олей на завтра");
    await page.locator('[data-toggle-note="sensitive"]').click();
    await expect(page.locator(".note-toolbar")).toContainText("Приватная");

    await openView(page, "settings");
    await page.locator('[data-toggle-setting="hidePrivate"]').click();
    await openView(page, "inbox");

    await expect(page.locator(".note-list")).not.toContainText("Личная приватная заметка");
  });

  test("exports and imports JSON state", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Напомнить Оле и Пете завтра согласовать отчет");

    const exportedState = await page.evaluate(() => ({
      exportedAt: new Date().toISOString(),
      app: "ИИ-заметки",
      version: "ai-notes-mvp-v5",
      state: JSON.parse(localStorage.getItem("ai-notes-mvp-v5") || "{}"),
    }));

    await openView(page, "settings");
    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-export-state]").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^ai-memory-export-\d{4}-\d{2}-\d{2}\.json$/);

    await page.evaluate(() => {
      localStorage.clear();
      location.reload();
    });
    await page.locator("[data-skip-intro]").click();
    await expect(page.locator(".shell")).toBeVisible();
    await expect(page.locator(".note-list")).not.toContainText("Напомнить Оле и Пете завтра согласовать отчет");

    await openView(page, "settings");
    await page.locator("#importStateFile").setInputFiles({
      name: "ai-memory-import.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exportedState), "utf8"),
    });

    await expect(page.locator(".note-list")).toContainText("Напомнить Оле и Пете завтра согласовать отчет");
    await expect(page.locator(".meta-grid")).toContainText("9 июня");
  });

  test("mobile layout has no horizontal overflow", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only journey");

    await resetApp(page);
    await addNote(page, "Напомнить Сергею и Маше проверить результаты завтра");

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);

    await openView(page, "review");
    await expect(page.locator("h1")).toContainText("ИИ-проверка");
    const reviewOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(reviewOverflow).toBe(false);
  });
});
