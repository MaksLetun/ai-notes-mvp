import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const candidates = [
  {
    command: join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "playwright.cmd" : "playwright"),
    args: ["test"],
    shell: false,
  },
  {
    command: "npm",
    args: ["exec", "--", "playwright", "test"],
    shell: process.platform === "win32",
  },
  {
    command: "npx",
    args: ["playwright", "test"],
    shell: process.platform === "win32",
  },
];

let lastResult = null;

for (const candidate of candidates) {
  if (candidate.command.includes("node_modules") && !existsSync(candidate.command)) {
    continue;
  }

  const result = spawnSync(candidate.command, candidate.args, {
    encoding: "utf8",
    shell: candidate.shell,
  });

  if (result.error?.code === "ENOENT") {
    lastResult = result;
    continue;
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

if (lastResult?.error) {
  console.error(lastResult.error.message);
} else {
  console.error("Playwright runner is unavailable. Install dependencies before browser audit.");
}
process.exit(1);
