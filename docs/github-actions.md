# GitHub Actions

The repository uses GitHub Actions only for ordinary checks and web deployment.

Autonomous AI QA/repair workflows are disabled.

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

## Web Deploy

File:

```text
.github/workflows/pages.yml
```

Runs on every push to `main` and manually through GitHub Actions.

The deploy artifact includes only:

- `index.html`;
- `src/`;
- `.nojekyll`.

The public web app is local-first and stores notes in the user's browser storage.

## Secrets

Do not commit real API keys to the repository.

Future OpenRouter integration should use a backend/proxy, not a browser-exposed API key.
