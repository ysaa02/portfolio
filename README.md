# Portfolio

A personal portfolio with a terminal-style look, built with [Astro](https://astro.build). It builds to static HTML, CSS and a little JavaScript, so it can be hosted anywhere; it runs on Cloudflare Workers.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
npm run dev        # http://localhost:4321, reloads as you edit
```

To check the production build:

```sh
npm run build      # type-checks, then writes the site to dist/
npm run preview    # serves dist/ at http://localhost:4321
```

## Editing content

All text lives in `src/data/`. Replace each `[PLACEHOLDER]`:

| File | What it holds |
|---|---|
| `profile.ts` | Name, handle, loading-screen name, role, intro, education, email, social links |
| `projects.json` | Project cards: title, description, tags, link |
| `skills.json` | Skill tiles |
| `awards.json`, `certifications.json` | Numbered cards: title, issuer, year |
| `testimonials.json` | Quotes |

To add a card, add an entry with a unique `id` and the next `order` number. `npm run build` fails with a clear message if a field is missing or has the wrong type.

## Structure

```
src/
  pages/index.astro        the page, assembled from components
  layouts/Base.astro       <head>, theme script, boot screen
  components/              one component per section (Nav, Hero, Projects, ...)
  data/                    content (see above)
  content.config.ts        content schemas
  styles/global.css        all styles; color tokens at the top
```

Light and dark colors are the two token blocks at the top of `src/styles/global.css`.

## Testing

Run `npm run build` before committing: it fails on type errors and invalid content. In Claude Code, `/site-qa` runs browser checks (loader, theme, carousel, responsive layouts, Lighthouse).

## Deploy (Cloudflare Workers)

Live at https://elaisa-laguerta-portfolio.laguertaelaisa.workers.dev. The site is served as static assets by a Cloudflare Worker, configured in `wrangler.jsonc`.

```sh
npx wrangler@4 login   # once per computer
npm run deploy         # builds, then uploads dist/
```

## Commits

Conventional Commits, enforced by `.githooks/commit-msg`. Enable it once per clone:

```sh
git config core.hooksPath .githooks
```
