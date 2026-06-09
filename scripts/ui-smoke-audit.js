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

const sidebarViews = ["inbox", "today", "reminders", "calendar", "settings"];

const expectedSelectors = [
  "data-open-command",
  "data-command-focus-note",
  "data-command-followup",
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
  "renderCalendarPlan",
  "renderReviewCenter",
];

const findings = [
  ...auditViews(),
  ...auditSelectors(),
  ...auditWorkflowWiring(),
  ...auditResponsiveCss(),
  ...auditMinimalInterface(),
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
    if (!appSource.includes(`${view}: "`)) {
      results.push(`Missing title mapping for view "${view}".`);
    }
    if (!appSource.includes(`state.activeView === "${view}"`)) {
      results.push(`Missing render branch for view "${view}".`);
    }
  }
  for (const view of sidebarViews) {
    if (!appSource.includes(`navButton("${view}"`)) {
      results.push(`Missing sidebar nav button for primary view "${view}".`);
    }
  }
  return results;
}

function auditSelectors() {
  return expectedSelectors
    .filter((selector) => !appSource.includes(selector))
    .map((selector) => `Missing expected interactive selector "${selector}".`);
}

function auditWorkflowWiring() {
  const checks = [
    ['function renderCommandPalette()', "Missing command palette renderer."],
    ['state.commandOpen = true;', "Missing command palette open state transition."],
    ['function exportState()', "Missing JSON export handler."],
    ['function importStateFile(file)', "Missing JSON import handler."],
  ];

  return checks
    .filter(([pattern]) => !appSource.includes(pattern))
    .map(([, message]) => message);
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

function auditMinimalInterface() {
  const results = [];
  const sidebarMatch = appSource.match(/<nav class="nav">([\s\S]*?)<\/nav>/);
  const sidebarMarkup = sidebarMatch?.[1] || "";
  const primaryNavCount = [...sidebarMarkup.matchAll(/navButton\("/g)].length;

  if (primaryNavCount > 5) {
    results.push(`Primary sidebar has ${primaryNavCount} visible items; keep it minimal.`);
  }
  if (appSource.includes('<details class="nav-more"')) {
    results.push('Sidebar secondary navigation returned; keep the left rail minimal.');
  }
  if (appSource.includes('class="mini-card"')) {
    results.push("Sidebar mini-card returned; keep AI/service details out of the main navigation.");
  }
  if (appSource.includes('<div class="insights glass-panel">')) {
    results.push("AI recommendation returned as a permanent third column; keep it collapsed in note detail.");
  }
  if (!appSource.includes('<details class="composer-more">')) {
    results.push("Composer templates should stay collapsed to reduce first-screen clutter.");
  }
  return results;
}
