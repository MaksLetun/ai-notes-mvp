import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const env = loadEnv();

const report = runQaReport();
const repair = env.OPENROUTER_API_KEY
  ? await requestRepairPatch(report)
  : {
      status: "skipped",
      reason: "OPENROUTER_API_KEY is not set.",
    };

let applyResult = { status: "skipped", reason: "No patch requested." };

if (repair.status === "completed" && repair.result?.shouldPatch && repair.result?.patch) {
  applyResult = applyPatchAndCheck(repair.result.patch);
}

const finalReport = {
  generatedAt: new Date().toISOString(),
  qa: report,
  repair,
  apply: applyResult,
};

writeFileSync("repair-report.json", `${JSON.stringify(finalReport, null, 2)}\n`);
writeFileSync("repair-report.md", renderRepairReport(finalReport));

console.log(`AI repair status: ${repair.status}`);
console.log(`Patch apply status: ${applyResult.status}`);

if (applyResult.status === "failed" || repair.status === "failed") {
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

function runQaReport() {
  const result = spawnSync("node", ["scripts/ai-qa-agent.js"], {
    encoding: "utf8",
  });
  const qaReport = existsSync("qa-report.json") ? JSON.parse(readFileSync("qa-report.json", "utf8")) : null;

  return {
    status: result.status === 0 ? "passed" : "failed",
    stdout: trimForReport(result.stdout),
    stderr: trimForReport(result.stderr),
    report: qaReport,
  };
}

async function requestRepairPatch(qa) {
  const prompt = buildRepairPrompt(qa);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.OPENROUTER_SITE_URL || "http://localhost:4173",
        "X-Title": env.OPENROUTER_APP_NAME || "AI Notes MVP Repair",
      },
      body: JSON.stringify({
        model: env.OPENROUTER_REPAIR_MODEL || env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: [
              "You are a conservative senior engineer fixing a Russian AI notes web app.",
              "Return JSON only. Do not include secrets. Prefer tests and small focused fixes.",
              "Only produce a patch when the evidence is strong and the change is low-risk.",
            ].join(" "),
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
      model: env.OPENROUTER_REPAIR_MODEL || env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
      result: parseJsonObject(content),
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error.message,
    };
  }
}

function buildRepairPrompt(qa) {
  return JSON.stringify({
    task: "Review the QA report and selected repository files. If there is a clear bug or missing guardrail, return a unified diff patch. If not, return shouldPatch false and explain the next manual improvement.",
    requiredJsonShape: {
      shouldPatch: false,
      rationale: "short Russian explanation",
      patch: "unified diff string or empty string",
      expectedChecks: ["checks that should pass"],
    },
    guardrails: [
      "Patch must be a valid git unified diff.",
      "Patch must not touch .env or secrets.",
      "Patch should be small and focused.",
      "Do not rewrite the app architecture.",
      "Prefer adding or strengthening tests when fixing parser or UI behavior.",
    ],
    qa,
    files: collectRepoContext(),
  });
}

function collectRepoContext() {
  const paths = [
    "package.json",
    "src/app.js",
    "src/note-analyzer.js",
    "src/text-utils.js",
    "scripts/ui-smoke-audit.js",
    "tests/fixtures/note-cases.js",
    "tests/note-analyzer.test.js",
    "tests/browser/app-journeys.spec.js",
  ];

  return Object.fromEntries(
    paths
      .filter((path) => existsSync(path))
      .map((path) => [path, trimForReport(readFileSync(path, "utf8"), 12_000)]),
  );
}

function applyPatchAndCheck(patch) {
  const check = spawnSync("git", ["apply", "--check", "-"], {
    input: patch,
    encoding: "utf8",
  });
  if (check.status !== 0) {
    return {
      status: "failed",
      reason: "Patch did not pass git apply --check.",
      stdout: trimForReport(check.stdout),
      stderr: trimForReport(check.stderr),
    };
  }

  const apply = spawnSync("git", ["apply", "-"], {
    input: patch,
    encoding: "utf8",
  });
  if (apply.status !== 0) {
    return {
      status: "failed",
      reason: "Patch failed during git apply.",
      stdout: trimForReport(apply.stdout),
      stderr: trimForReport(apply.stderr),
    };
  }

  const command = env.REPAIR_CHECK_COMMAND || "npm run check";
  const verify = spawnSync(command, {
    shell: true,
    encoding: "utf8",
  });

  if (verify.status !== 0) {
    return {
      status: "failed",
      reason: `Verification command failed: ${command}`,
      stdout: trimForReport(verify.stdout),
      stderr: trimForReport(verify.stderr),
    };
  }

  return {
    status: "applied",
    command,
    stdout: trimForReport(verify.stdout),
    stderr: trimForReport(verify.stderr),
  };
}

function parseJsonObject(content) {
  try {
    return JSON.parse(content);
  } catch {
    return { shouldPatch: false, rationale: "Model returned invalid JSON.", raw: content };
  }
}

function renderRepairReport(report) {
  const lines = [
    "# AI Repair Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `QA status: ${report.qa.status}`,
    `Repair status: ${report.repair.status}`,
    `Patch status: ${report.apply.status}`,
    "",
  ];

  if (report.repair.result) {
    lines.push("## Repair Decision", "");
    lines.push("```json");
    lines.push(JSON.stringify({
      shouldPatch: report.repair.result.shouldPatch,
      rationale: report.repair.result.rationale,
      expectedChecks: report.repair.result.expectedChecks,
    }, null, 2));
    lines.push("```", "");
  }

  if (report.apply.reason) {
    lines.push("## Apply Notes", "");
    lines.push(report.apply.reason, "");
  }

  return `${lines.join("\n")}\n`;
}

function trimForReport(value = "", limit = 5_000) {
  const trimmed = value.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}\n...truncated...` : trimmed;
}
