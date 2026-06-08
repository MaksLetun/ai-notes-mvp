import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { analyzeNote } from "../src/note-analyzer.js";
import { noteCases } from "../tests/fixtures/note-cases.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const env = loadEnv();

const localReport = runLocalQa();
const uiReport = runUiSmokeAudit();
const browserReport = runBrowserJourneyAudit();
const aiReport = env.OPENROUTER_API_KEY
  ? await runOpenRouterQa(localReport, uiReport, browserReport)
  : {
      status: "skipped",
      reason: "OPENROUTER_API_KEY is not set. Local QA completed without AI review.",
    };

const report = {
  generatedAt: new Date().toISOString(),
  local: localReport,
  ui: uiReport,
  browser: browserReport,
  ai: aiReport,
};

writeFileSync("qa-report.json", `${JSON.stringify(report, null, 2)}\n`);
writeFileSync("qa-report.md", renderMarkdownReport(report));

console.log(`QA report saved: ${resolve("qa-report.md")}`);
console.log(`Local checks: ${localReport.summary.passed}/${localReport.summary.total} passed`);
console.log(`UI smoke audit: ${uiReport.status}`);
console.log(`Browser journey audit: ${browserReport.status}`);
console.log(`AI review: ${aiReport.status}`);

if (localReport.summary.failed > 0 || uiReport.status === "failed" || browserReport.status === "failed" || aiReport.status === "failed") {
  process.exitCode = 1;
}

function loadEnv() {
  const values = { ...process.env };
  if (!existsSync(".env")) return values;

  const content = readFileSync(".env", "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in values)) values[key] = value;
  }
  return values;
}

function runLocalQa() {
  const cases = noteCases.map((item) => {
    const analysis = analyzeNote(item.text, item.createdAt);
    const findings = compareAnalysis(item.expect, analysis);
    return {
      text: item.text,
      expected: item.expect,
      actual: pickAnalysisFields(analysis),
      passed: findings.length === 0,
      findings,
    };
  });

  const failedCases = cases.filter((item) => !item.passed);
  return {
    summary: {
      total: cases.length,
      passed: cases.length - failedCases.length,
      failed: failedCases.length,
    },
    cases,
  };
}

function runUiSmokeAudit() {
  const result = spawnSync("node", ["scripts/ui-smoke-audit.js"], {
    encoding: "utf8",
  });
  return {
    status: result.status === 0 ? "passed" : "failed",
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function runBrowserJourneyAudit() {
  const result = spawnSync("node", ["scripts/browser-journey-audit.js"], {
    encoding: "utf8",
  });
  return {
    status: result.status === 0 ? "passed" : "failed",
    stdout: trimForReport(result.stdout),
    stderr: trimForReport(result.stderr),
  };
}

function compareAnalysis(expected, actual) {
  const findings = [];
  compareField("people", expected.people, actual.people, findings);
  compareField("reminder", expected.reminder, actual.reminder, findings);
  if ("reminderKind" in expected) compareField("reminderKind", expected.reminderKind, actual.reminderKind, findings);
  compareField("topic", expected.topic, actual.topic, findings);
  if ("signal" in expected) compareField("signal", expected.signal, actual.signal, findings);
  if ("hasTask" in expected) compareField("hasTask", expected.hasTask, actual.tasks.length > 0, findings);
  if ("hasDecision" in expected) compareField("hasDecision", expected.hasDecision, actual.decisions.length > 0, findings);
  return findings;
}

function compareField(field, expected, actual, findings) {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return;
  findings.push({ field, expected, actual });
}

function pickAnalysisFields(analysis) {
  return {
    people: analysis.people,
    reminder: analysis.reminder,
    reminderKind: analysis.reminderKind,
    topic: analysis.topic,
    signal: analysis.signal,
    urgency: analysis.urgency,
    tasks: analysis.tasks,
    decisions: analysis.decisions,
    action: analysis.action,
  };
}

async function runOpenRouterQa(localReport, uiReport, browserReport) {
  const prompt = buildAiPrompt(localReport, uiReport, browserReport);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.OPENROUTER_SITE_URL || "http://localhost:4173",
        "X-Title": env.OPENROUTER_APP_NAME || "AI Notes MVP QA",
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "You are a strict QA agent for a Russian AI notes app. Return concise JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_object",
        },
      }),
    });

    if (!response.ok) {
      return {
        status: "failed",
        reason: `OpenRouter returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    return {
      status: "completed",
      model: env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
      result: parseJsonObject(content),
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error.message,
    };
  }
}

function buildAiPrompt(localReport, uiReport, browserReport) {
  return JSON.stringify({
    task: "Act as an autonomous QA user for a Russian AI notes app. Review parser QA, static UI smoke results, and real browser journey results. Find risky gaps, propose new parser test phrases, UI journeys, and prioritized fixes.",
    requiredJsonShape: {
      summary: "short Russian summary",
      risks: ["array of product/parser/UI risks"],
      proposedTestCases: [
        {
          text: "natural Russian note",
          expectedPeople: ["Name"],
          expectedReminder: "date label or null",
          expectedTopic: "topic",
          reason: "why this case matters",
        },
      ],
      proposedUiJourneys: [
        {
          name: "journey name",
          steps: ["specific user actions"],
          expected: ["observable outcomes"],
          reason: "why this journey matters",
        },
      ],
      nextFixes: ["ordered list of fixes"],
    },
    localReport,
    uiReport,
    browserReport,
  });
}

function parseJsonObject(content) {
  try {
    return JSON.parse(content);
  } catch {
    return { raw: content };
  }
}

function renderMarkdownReport(report) {
  const lines = [
    "# AI QA Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Local Parser QA",
    "",
    `Passed: ${report.local.summary.passed}/${report.local.summary.total}`,
    "",
  ];

  for (const item of report.local.cases) {
    lines.push(`### ${item.passed ? "PASS" : "FAIL"}: ${item.text}`);
    if (item.findings.length) {
      for (const finding of item.findings) {
        lines.push(`- ${finding.field}: expected ${JSON.stringify(finding.expected)}, actual ${JSON.stringify(finding.actual)}`);
      }
    } else {
      lines.push("- No findings.");
    }
    lines.push("");
  }

  lines.push("## UI Smoke Audit", "");
  lines.push(`Status: ${report.ui.status}`);
  if (report.ui.stdout) lines.push(`- ${report.ui.stdout}`);
  if (report.ui.stderr) lines.push(`- ${report.ui.stderr}`);
  lines.push("");

  lines.push("## Browser Journey Audit", "");
  lines.push(`Status: ${report.browser.status}`);
  if (report.browser.stdout) lines.push("```text", report.browser.stdout, "```");
  if (report.browser.stderr) lines.push("```text", report.browser.stderr, "```");
  lines.push("");

  lines.push("## AI Review", "");
  if (report.ai.status === "completed") {
    lines.push(`Model: ${report.ai.model}`, "");
    lines.push("```json");
    lines.push(JSON.stringify(report.ai.result, null, 2));
    lines.push("```");
  } else {
    lines.push(`${report.ai.status}: ${report.ai.reason}`);
  }

  return `${lines.join("\n")}\n`;
}

function trimForReport(value = "") {
  const trimmed = value.trim();
  return trimmed.length > 5_000 ? `${trimmed.slice(0, 5_000)}\n...truncated...` : trimmed;
}
