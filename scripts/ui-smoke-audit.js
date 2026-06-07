import { readFileSync } from "node:fs";

const appSource = readFileSync("src/app.js", "utf8");
const stylesSource = readFileSync("src/styles.css", "utf8");

const expectedViews = [
  "inbox",
  "today",
  "spaces",
  "favorites",
  "people",
  "threads",
  "review",
  "actions",
  "reminders",
  "calendar",
  "digest",
  "radar",
  "activity",
  "integrations",
  "settings",
];

const expectedSelectors = [
  "data-open-command",
  "data-command-focus-note",
  "data-note-action",
  "data-accept-suggestion",
  "data-dismiss-suggestion",
  "data-toggle-setting",
  "data-ai-scope",
  "data-export-state",
  "importStateFile",
  "data-reset-state",
  "data-action-status",
  "data-open-note",
  "editNoteReminder",
  "editNotePeople",
  "editNoteSignal",
  "editNoteTopic",
  "renderCalendarPlan",
  "renderReviewCenter",
];

const findings = [
  ...auditViews(),
  ...auditSelectors(),
  ...auditResponsiveCss(),
];

if (findings.length) {
  console.error("UI smoke audit failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`UI smoke audit passed: ${expectedViews.length} views checked`);

function auditViews() {
  const results = [];
  for (const view of expectedViews) {
    if (!appSource.includes(`navButton("${view}"`)) {
      results.push(`Missing sidebar nav button for view "${view}".`);
    }
    if (!appSource.includes(`${view}: "`)) {
      results.push(`Missing title mapping for view "${view}".`);
    }
    if (!appSource.includes(`state.activeView === "${view}"`)) {
      results.push(`Missing render branch for view "${view}".`);
    }
  }
  return results;
}

function auditSelectors() {
  return expectedSelectors
    .filter((selector) => !appSource.includes(selector))
    .map((selector) => `Missing expected interactive selector "${selector}".`);
}

function auditResponsiveCss() {
  const results = [];
  if (!stylesSource.includes("@media (max-width: 1180px)")) {
    results.push("Missing tablet responsive media query.");
  }
  if (!stylesSource.includes("@media (max-width: 720px)")) {
    results.push("Missing mobile responsive media query.");
  }
  for (const className of [".three-column", ".review-layout", ".activity-layout", ".calendar-board"]) {
    if (!stylesSource.includes(className)) {
      results.push(`Missing CSS rules for ${className}.`);
    }
  }
  return results;
}
