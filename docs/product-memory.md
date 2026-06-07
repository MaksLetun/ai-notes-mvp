# Product Memory

## Vision

Personal AI workspace for notes, commitments, follow-ups, people context, projects, decisions, and everyday tasks. The user writes rough notes in natural language; the app turns them into structure, reminders, people cards, threads, signals, and suggested next actions.

## Initial MVP

- Local web app for fast review and iteration.
- Quick note capture as the first screen.
- Local AI-like parser for the first prototype.
- Future OpenRouter agent service separated from UI logic.
- Auto detection of people, topic, reminder, urgency/signal level, decisions, tasks, summary, and suggested action.
- Views: Inbox, Today, People, Threads, Follow-up, Calendar plan, Digest, Signals, Integrations, Settings.
- AI Review center exists as the confirmation layer between raw analysis and real actions.
- Pipeline jobs exist for note capture, local analysis, and user review.
- Audit log exists for user trust: note changes, AI decisions, actions, settings, and integration events.
- Local actions from a note: create follow-up, calendar draft, agenda draft, meeting prep, or post-meeting summary.
- Note states: active, archived, favorite, and private.
- Workspaces/spaces: work, personal, finance, learning. Later these can become user-created folders.
- Thread detail includes timeline, note count, reminders, decisions, tasks, and summary draft action.
- Notes can be edited; saving re-runs local analysis and keeps note state.
- Manual analysis corrections are supported for topic, reminder, people, and signal. These are stored as overrides on the note.
- Actions have statuses: open, in progress, done. The Actions view is the central place for follow-ups, agenda drafts, calendar drafts, prep, and summaries.
- Local JSON export and import are available until account sync exists.
- Today dashboard shows upcoming reminders, open actions, and important signals.
- Quick templates exist for meeting, task, idea, decision, and personal notes.
- Command palette exists for fast navigation and common actions.
- Calendar plan uses a board grouped by today, tomorrow, later, and no date.
- Privacy settings can hide private notes from main views while keeping the explicit private filter.
- AI boundary settings define local-only, selected-note, or all-note context modes before real API integration.
- Sensitive masking and external-action confirmation are product requirements, not optional extras.
- Desktop-ready mode keeps the web MVP compatible with a future macOS wrapper and server-backed AI API.
- Integration cards exist as product stubs for OpenRouter, Yandex Calendar, Telegram, and account sync.
- Local persistence through browser storage.
- Design direction: macOS-inspired Liquid Glass, but with readable solid content areas for dense working text.

## Later Integrations

- OpenRouter API for real note analysis and recommendations.
- Telegram bot for quick text and voice capture.
- Calendar integrations, starting with Yandex Calendar, then Google and Outlook.
- Account system and sync between Mac and phone.
- VPS deployment for multi-user access.
- Native macOS wrapper later, likely via Tauri or Electron after the web MVP stabilizes.

## Universal Features To Preserve

- People cards with history, promises, open questions, and last contact.
- Topic threads for work, projects, meetings, finances, learning, health, ideas, home, and personal tasks.
- Daily and weekly digests.
- Meeting or task prep based on prior notes.
- Post-meeting mode for decisions, commitments, and follow-ups.
- Best-practice assistant for decisions, planning, communication, prioritization, and next-step recommendations.
- Privacy by design: encryption, local-first options, sensitive-note controls, and clear data boundaries.
