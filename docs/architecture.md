# MVP Architecture

## Current Prototype

The first version is intentionally simple and local:

- `index.html` mounts the app.
- `src/styles.css` contains the Liquid Glass visual system and responsive layout.
- `src/app.js` contains temporary UI rendering, local storage, and mock AI analysis.
- Browser `localStorage` keeps notes between sessions.
- The current local data model already separates notes, actions, AI suggestions, processing jobs, integrations, settings, and audit events.
- AI suggestions are reviewed by the user before they become actions or future external calendar/Telegram operations.

This keeps iteration fast while the product shape is still changing.

## Target Architecture

```text
client/
  macOS wrapper or web app
  note capture UI
  people / threads / reminders / signals views

api/
  auth
  notes
  reminders
  calendar connectors
  telegram connector
  ai-agent

data/
  users
  notes
  people
  threads
  ai_suggestions
  processing_jobs
  reminders
  integrations
  audit/privacy events
```

## AI Agent Flow

1. User writes a raw note.
2. App sends the note plus minimal safe context to the AI agent.
3. Agent returns structured JSON:
   - topic
   - people
   - dates and reminders
   - urgency or signal level
   - suggested next action
   - links to existing threads
4. App asks for confirmation only when creating external events or sending messages.
5. Confirmed actions go to calendar, Telegram, or future task systems.

## Pre-Integration Guardrails

- AI output lands in the Review center first.
- External actions require explicit confirmation.
- Private notes can be hidden from main views.
- Sensitive context can be masked before future API calls.
- The audit log records note changes, accepted suggestions, dismissed suggestions, settings changes, and integration events.
- OpenRouter keys must stay behind the VPS API and never ship to the browser or desktop client.

## OpenRouter Integration

The OpenRouter service should be isolated from UI components. The UI should call an internal endpoint, not OpenRouter directly, so API keys never ship to the browser.

Recommended production flow:

```text
Browser / macOS app -> VPS API -> OpenRouter -> VPS API -> Client
```

## macOS Path

Start web-first, then wrap after the workflows stabilize:

- Tauri if we want lightweight local desktop app and strong filesystem boundaries.
- Electron if we need faster ecosystem support and richer integrations.

Keep the main app UI framework-agnostic enough to migrate into either wrapper.

## Privacy Notes

Notes can contain sensitive personal or work information. Future versions should include:

- encrypted storage;
- local-first mode;
- clear AI data boundary;
- per-note sensitivity flags;
- audit trail for integrations;
- confirmation before any external calendar or message creation.
