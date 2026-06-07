# AI QA Agent

The project has a local autonomous QA agent for parser and product logic checks.

## Setup

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Set:

```text
OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

The `.env` file is ignored by git. Never commit real API keys.

## Run

```bash
node scripts/ai-qa-agent.js
```

or, when `npm` is available:

```bash
npm run qa:ai
```

## Output

- `qa-report.md`
- `qa-report.json`

Both files are ignored by git.

## What It Checks

- Local parser corpus in `tests/fixtures/note-cases.js`.
- People extraction.
- Reminder extraction.
- Topic detection.
- Signals.
- Tasks and decisions.
- UI smoke audit through `scripts/ui-smoke-audit.js`.
- Navigation/view wiring, critical interaction selectors, and responsive CSS guardrails.
- Real browser journeys through Playwright:
  - note creation;
  - AI Review acceptance;
  - action status changes;
  - manual people/deadline editing;
  - calendar visibility;
  - privacy hiding;
  - mobile overflow checks.
- AI review through OpenRouter when `OPENROUTER_API_KEY` is available.

## How To Improve It

When a weird app behavior appears, add a natural phrase to `tests/fixtures/note-cases.js` with the expected output. The agent will keep checking it on every run.

## Autonomous Background Fixer

The project has two automation layers.

### GitHub AI Repair

File:

```text
.github/workflows/ai-repair.yml
```

It runs manually or every 6 hours. The repair workflow:

- runs the full QA agent;
- asks OpenRouter for a small unified diff only when the evidence is strong;
- applies the patch;
- runs `npm run check`;
- pushes a `codex/ai-repair-*` branch;
- opens a pull request for review.

It does not silently rewrite `main`.

### Local Codex Automation

The Codex app can also have a recurring local automation:

```text
Autonomous AI Notes QA Fixer
```

It runs every 6 hours in this workspace. Its job is to:

- run the AI QA agent;
- inspect AI-proposed parser cases and UI journeys;
- add strong cases to tests or audit checks;
- implement focused fixes;
- rerun syntax, UI smoke, and parser tests;
- report what changed and what remains risky.

The automation must not print or commit `.env` secrets.
