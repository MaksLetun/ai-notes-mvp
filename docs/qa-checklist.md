# QA Checklist

Use this checklist after every product/UI iteration.

## Core User Path

- Open the app from a clean local state.
- Add a note with a person, deadline, task, and signal word.
- Use a quick template and confirm it fills the note input and workspace.
- Confirm the note appears at the top of Inbox.
- Confirm people, deadline, topic, signal, summary, decisions, and tasks are extracted.
- Search for the person and confirm focus stays in the search field.
- Clear search and confirm the full list returns.

## Note State

- Mark a note as favorite.
- Mark a note as private.
- Edit a note and confirm topic, deadline, people, and summary update after save.
- Manually change topic, signal, people, and reminder in edit mode.
- Create follow-up, calendar draft, and agenda draft.
- Confirm new or edited notes create pending AI Review suggestions.
- Accept an AI Review suggestion and confirm it creates an action plus audit log entry.
- Dismiss an AI Review suggestion and confirm it moves to recent decisions.
- Archive the note.
- Confirm active Inbox no longer shows it.
- Switch to Archive filter and confirm it is visible there.

## Views

- Spaces show active notes grouped by workspace.
- Today shows deadlines, open actions, and signals.
- Calendar shows today, tomorrow, later, and no-date columns.
- Command palette opens, navigates to a view, and closes.
- Favorites shows only favorite active notes.
- Threads show cards and a detailed timeline.
- AI Review shows pending suggestions, pipeline jobs, and recent decisions.
- Follow-up includes reminder notes and local follow-up actions.
- Actions shows all created actions with open, in-progress, done, and all filters.
- Activity log shows note, AI, action, settings, and integration events.
- Action status changes move cards between filters.
- Opening a source note from an action returns to Inbox with the note selected.
- Calendar includes calendar and agenda drafts.
- Digest includes deadlines, signals, and recent actions.
- Settings can toggle privacy and digest options.
- Settings can change AI data boundary, sensitive masking, external confirmation, and desktop-ready mode.
- Privacy hide mode removes private notes from normal views.
- Settings can export and import JSON state.

## Safety

- Browser console has no errors.
- Dense text does not overlap on desktop.
- No horizontal overflow on desktop or mobile viewports.
- Empty filters show an empty state instead of unrelated note details.
- Archived notes do not affect People, Threads, Signals, or Digest counts.

## Automated Parser QA

- Add real phrases to `tests/fixtures/note-cases.js` when a parsing issue appears.
- Run `node --test` after parser changes.
- The corpus should cover people, deadlines, topics, signals, decisions, and task extraction.
- Keep examples natural and messy, matching how notes are actually written.

## Automated UI QA

- Run `node scripts/ui-smoke-audit.js` after navigation, import/export, settings, or layout changes.
- Keep command palette, JSON portability, and privacy hide flows covered by either browser journeys or static audit checks.
- When browser automation is unavailable, strengthen repo-owned audit checks instead of skipping critical UI wiring.
