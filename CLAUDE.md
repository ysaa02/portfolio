# Portfolio — project rules for Claude

## Stack

Astro 7 static site with TypeScript (strict) and plain CSS. No UI framework, no Tailwind, no backend. Don't add dependencies without the owner's approval.

- Page: `src/pages/index.astro`; layout and head scripts: `src/layouts/Base.astro`; one component per section in `src/components/`.
- Content: `src/data/` (`profile.ts` plus JSON lists validated by `src/content.config.ts`). Edit content there, not in components.
- Styles: `src/styles/global.css`. Colors are tokens at the top; dark mode is `:root[data-theme="dark"]`.
- Commands: `npm run dev` (localhost:4321), `npm run build` (type check + build to `dist/`), `npm run preview`.
- Never push without the owner previewing locally first.

## Protected UI — do not change without an explicit request

The current design and interactions are final. Reviews and QA report findings; they don't apply them. Never redesign, restyle or remove existing UI as a side effect of other work.

In particular, the **boot loading screen** (`src/components/Loader.astro`, the `loading` line in `Base.astro`'s head script, and the loader styles in `global.css`) is off limits: its design (diamond spinner, "Elaisa Laguerta" rising in Instrument Serif with a diamond i-dot, slide-up exit), animation, timings (1.2s minimum spinner, 10s cap), position, behavior and appearance stay exactly as they are. Only change it when the owner names it in the request.

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
