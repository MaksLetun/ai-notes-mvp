# AI Notes MVP

Local-first prototype of a universal AI workspace for notes, reminders, people, projects, and decisions.

## Run

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Current Scope

- Liquid Glass-inspired interface.
- Quick note capture.
- Local mock AI analysis.
- Shared note analyzer module with automated QA corpus for people, dates, topics, signals, decisions, and tasks.
- People, threads, reminders, calendar plan, digest, integrations, settings, and signals views.
- Today dashboard for deadlines, open actions, and important signals.
- AI Review center for proposed follow-ups, calendar drafts, decisions, and thread links.
- Processing pipeline for captured notes before external integrations are connected.
- Audit log for accepted/dismissed AI suggestions, note changes, settings, and actions.
- Quick note templates for meetings, tasks, ideas, decisions, and personal notes.
- Command palette for fast navigation and common actions.
- Local action creation from notes: follow-up, calendar draft, and agenda draft.
- Extracted summaries, decisions, and tasks inside note details.
- Note states: active, archived, favorite, and private.
- Spaces for broad organization: work, personal, finance, learning.
- Thread detail view with timeline, decisions, tasks, and summary draft action.
- Note editing with re-analysis after save.
- Manual correction for topic, signal, reminder, and people.
- Actions board with open, in-progress, and done statuses.
- Local JSON export and import.
- Calendar board grouped by today, tomorrow, later, and no date.
- Privacy setting can hide private notes from main views.
- Prototype privacy, AI data-boundary, masking, confirmation, and desktop-ready settings.
- Browser localStorage persistence.

## Check

```bash
node --check src/app.js && node --check src/note-analyzer.js && node --check src/openrouter-agent.js && node --check scripts/ai-qa-agent.js && node --test
```

Manual QA checklist: `docs/qa-checklist.md`.

Parser QA examples: `tests/fixtures/note-cases.js`.

Autonomous AI QA agent:

```bash
node scripts/ai-qa-agent.js
```

Setup notes: `docs/ai-qa-agent.md`.

## Future Scope

- OpenRouter agent.
- Telegram bot.
- Yandex Calendar and other calendar providers.
- User accounts and sync.
- VPS deployment.
- Native macOS app wrapper.
