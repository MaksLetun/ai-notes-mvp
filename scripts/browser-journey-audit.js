import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["playwright", "test"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

process.exit(result.status ?? 1);
