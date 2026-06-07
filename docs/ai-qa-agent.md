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
- AI review through OpenRouter when `OPENROUTER_API_KEY` is available.

## How To Improve It

When a weird app behavior appears, add a natural phrase to `tests/fixtures/note-cases.js` with the expected output. The agent will keep checking it on every run.

## Autonomous Background Fixer

The Codex app has a recurring automation:

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
