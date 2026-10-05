# Portfolio — project rules for Claude

## Stack

Static site: `index.html`, `assets/styles.css`, `assets/main.js`. Plain HTML/CSS/JS, no framework, no build step, no backend, no npm dependencies. Keep it that way unless the owner asks otherwise. Colors are tokens at the top of `styles.css`; dark mode is `:root[data-theme="dark"]`.

## Protected UI — do not change without an explicit request

The current design and interactions are final. Reviews and QA report findings; they don't apply them. Never redesign, restyle or remove existing UI as a side effect of other work.

In particular, the **boot loading screen** (`.loader` in `index.html`, the loader styles in `styles.css`, the boot-screen block in `main.js`) is off limits: its design, animation, typing speeds, 3.5s minimum, 10s cap, position, behavior and appearance stay exactly as they are. Only change it when the owner names it in the request.

## Commits — Conventional Commits

Format: `type(optional-scope): summary` — imperative, lower case, no trailing period, under 72 characters.

Types: `feat` (new user-visible feature), `fix` (bug fix), `style` (formatting only, no behavior change), `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `revert`. Scopes that fit this repo: `loader`, `hero`, `projects`, `skills`, `nav`, `theme`, `a11y`, `seo`, `deps`.

- One logical change per commit; split unrelated changes into separate commits.
- Never use vague summaries such as "update", "changes", "fix stuff", "wip" or "final".
- `.githooks/commit-msg` enforces the format. Enable it once per clone with `git config core.hooksPath .githooks`.

## Documentation

Keep `README.md` current when setup, structure or behavior changes: what the site is, how to run it locally, how to edit content, and how to test it. Put deeper notes under `docs/` only if the README outgrows a single page.

## Development workflow

Research → Design Review → Build → QA → Code Review → Benchmark → Performance → Security → Conventional Commit

| Step | Tool |
|---|---|
| Research | `deep-research` skill |
| Design review | `/ui-review` (uses the `a11y-debugging` skill) |
| Build | `frontend-design` skill, only for new UI the owner asked for |
| QA | `/site-qa` |
| Code review | `/code-review`, `/simplify` |
| Benchmark | `/portfolio-benchmark` |
| Performance | `/site-qa perf` (Lighthouse and traces via `debug-optimize-lcp`) |
| Security | `/security-review` |
| Commit | Conventional Commits rules above |
