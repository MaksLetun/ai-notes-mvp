# GitHub Actions

The repository has two workflows.

## CI

File:

```text
.github/workflows/ci.yml
```

Runs on every push to `main` and every pull request into `main`.

Checks:

```bash
npm run check
```

This covers:

- syntax checks;
- UI smoke audit;
- parser tests;
- Playwright browser journeys.

## AI QA

File:

```text
.github/workflows/ai-qa.yml
```

Runs:

- manually through GitHub Actions;
- every 6 hours by schedule.

It runs:

```bash
npm run check
node scripts/ai-qa-agent.js
```

Then uploads:

- `qa-report.md`;
- `qa-report.json`.
- `browser-report.json`;
- Playwright `test-results` when present.

## Required Secret

Add this repository secret in GitHub:

```text
OPENROUTER_API_KEY
```

Do not commit real API keys to the repository.

Optional repository variable:

```text
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

## Autonomy Model

GitHub Actions currently performs checks and produces reports. Code-changing autonomy should happen through a safe PR flow:

1. agent creates a branch;
2. agent adds tests or fixes;
3. checks run;
4. user reviews and merges.

Direct writes to `main` are intentionally avoided.

## VPS Next Step

For 24/7 repair automation outside the local Mac, use the VPS as a runner or cron host:

- clone the repository;
- add `.env` on VPS;
- run `node scripts/ai-qa-agent.js` on a schedule;
- optionally create PR branches from the VPS.
