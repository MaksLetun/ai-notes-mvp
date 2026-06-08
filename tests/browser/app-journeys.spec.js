import { expect, test } from "@playwright/test";

async function resetApp(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator(".shell")).toBeVisible();
}

async function addNote(page, text) {
  await page.locator("#noteText").fill(text);
  await page.locator("#addNote").click();
  await expect(page.locator(".note-text")).toContainText(text);
}

test.describe("AI Notes user journeys", () => {
  test("creates a note, reviews AI suggestion, and completes an action", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Обсудить с Димой встречу в среду и подготовить список вопросов");

    await expect(page.locator(".meta-grid")).toContainText("Дима");
    await expect(page.locator(".meta-grid")).toContainText("10 июня");

    await page.locator('[data-view="review"]').click();
    await expect(page.locator("h1")).toContainText("AI Review");
    await expect(page.locator(".suggestion-card").first()).toBeVisible();
    await page.locator("[data-accept-suggestion]").first().click();

    await page.locator('[data-view="actions"]').click();
    await expect(page.locator(".action-card").first()).toBeVisible();
    await page.locator('[data-action-status="progress"]').first().click();
    await expect(page.locator(".action-card").first()).toContainText("В работе");
    await page.locator('[data-action-status="done"]').first().click();
    await expect(page.locator(".action-card").first()).toContainText("Готово");
  });

  test("edits people and deadline manually, then sees the note in calendar", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Созвониться по проекту и уточнить открытые вопросы");

    await page.locator("[data-edit-note]").click();
    await page.locator("#editNoteReminder").fill("15 июня");
    await page.locator("#editNotePeople").fill("Оля, Петр");
    await page.locator("[data-save-note]").click();

    await expect(page.locator(".meta-grid")).toContainText("Оля, Петр");
    await expect(page.locator(".meta-grid")).toContainText("15 июня");

    await page.locator('[data-view="calendar"]').click();
    await expect(page.locator("h1")).toContainText("Календарный план");
    await expect(page.locator(".calendar-board")).toContainText("15 июня");
  });

  test("assigns a soft deadline when a task has no exact date", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Через несколько дней поднять вопрос о грейдировании в компании");

    await expect(page.locator(".meta-grid")).toContainText("Мягкий срок");
    await expect(page.locator(".meta-grid")).toContainText("Точного срока нет");

    await page.locator('[data-view="review"]').click();
    await expect(page.locator('.suggestion-card:has-text("мягкое напоминание")').first()).toBeVisible();

    await page.locator('[data-view="calendar"]').click();
    await expect(page.locator(".calendar-board")).toContainText("Точного срока нет");
  });

  test("hides private notes from normal inbox views", async ({ page }) => {
    await resetApp(page);
    await addNote(page, "Личная приватная заметка с Олей на завтра");
    await page.locator('[data-toggle-note="sensitive"]').click();
    await expect(page.locator(".note-toolbar")).toContainText("Приватная");

    await page.locator('[data-view="settings"]').click();
    await page.locator('[data-toggle-setting="hidePrivate"]').click();
    await page.locator('[data-view="inbox"]').click();

    await expect(page.locator(".note-list")).not.toContainText("Личная приватная заметка");
  });

  test("mobile layout has no horizontal overflow", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only journey");

    await resetApp(page);
    await addNote(page, "Напомнить Сергею и Маше проверить результаты завтра");

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);

    await page.locator('[data-view="review"]').click();
    await expect(page.locator("h1")).toContainText("AI Review");
    const reviewOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(reviewOverflow).toBe(false);
  });
});
