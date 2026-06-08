# Web Deploy

The public web MVP is a static, local-first notes app.

## What Is Deployed

GitHub Pages deploys only:

- `index.html`
- `src/`
- `.nojekyll`

The deploy artifact does not include `.env`, QA reports, tests, workflows, or local files.

## Data Model

Notes are stored in the user's browser `localStorage`.

This means:

- every user has their own local notes;
- no shared database is required;
- no account is required;
- notes do not sync between devices yet;
- clearing browser storage removes local notes.

## Integrations

The public web MVP does not connect Telegram, calendars, or OpenRouter from the client.

Future integrations should go through a backend/proxy so secrets are never shipped to the browser.
