# Architecture

teXlab is a React/Vite web app that turns natural-language prompts into LaTeX via OpenRouter-hosted models, with live PDF previews compiled remotely by texlive.net's latexcgi service. There is no local TeX toolchain.

## Module map

- `api/` — Vercel-style serverless HTTP handlers (`generate-latex.js`, `compile-latex.js`, `export-overleaf.js`).
- `api/_lib/` — Shared OpenRouter client and security helpers (rate limiting, input validation, prompt-leak checks); the underscore prefix keeps them from being deployed as public routes.
- `src/pages/` — `Index` (marketing landing + Describe CTA), `Workspace` (`/app` Lovable-style desk: chat left, code + preview right), and 404 handling.
- `src/lib/` — Browser API client (`openrouter.ts`), compile client (`latex-compiler.ts`), figure export/fit (`figure-export.ts`, `fit-validation.ts`), templates, local history, Overleaf zip export, workspace handoff (`workspace-handoff.ts`), and utilities.
- `src/components/` — Shared UI including `LatexCode`, `FigureHistoryDrawer`, `TemplateGallery`, landing proof sections (`landing/`), and shadcn/Radix primitives.
- `src/hooks/` — Shared toast state and responsive viewport detection.
- `src/test/` — Vitest/JSDOM setup and the current smoke test.
- `src/main.tsx` — Browser entry point.
- `src/App.tsx` — Global providers and route table.
- `src/index.css`, `src/App.css` — Design tokens, Tailwind layers, and app styling.
- `public/` — Static favicon and crawler policy.
- `vite-plugin-api-dev.ts` — Local adapter that runs the production API handlers inside the Vite dev server.
- `vite.config.ts` — Dev/build configuration, aliases, environment loading, and plugins.
- `vercel.json` — SPA rewrite and security response headers.
- `tailwind.config.ts`, `postcss.config.js`, `components.json` — Styling and shadcn configuration.
- `vitest.config.ts`, `eslint.config.js`, `tsconfig*.json` — Test, lint, and TypeScript boundaries.
- `.env.example` — Documented server-side environment variables.
- `README.md` — Product purpose and local setup.

## Request lifecycle (diagram generation)

1. Startup: `index.html` loads `src/main.tsx`; `createRoot` renders `App`.
2. Initialization: `App` installs providers and routes `/` → `Index` (landing), `/app` → lazy `Workspace`.
3. Landing input: `Index` owns prompt plus preferences (type, style, color, density, aspect, arrows, document fit) and up to four references; Generate saves a handoff via `workspace-handoff.ts` (sessionStorage + location state) and navigates to `/app`.
4. Workspace boot: `Workspace` consumes the handoff (or `?template=`), hydrates preferences, and optionally auto-starts generation.
5. Request: `generateLaTeX` in `src/lib/openrouter.ts` posts to `/api/generate-latex`.
6. Routing: in development, `apiDevPlugin` maps that URL to `api/generate-latex.js`; on Vercel, the file is the serverless route.
7. Guarding: the handler checks method, per-IP rate limit, prompt validity, preference whitelists, and references before touching the AI provider.
8. Provider call: `createCompletion` with a hardened system prompt; image references as multimodal parts.
9. Model selection: ordered fallback by `OPENROUTER_TIER` / `OPENROUTER_MODEL`; vision filter when images are present.
10. Normalization: `normalizeLatex` + prompt-leak check → `{ content }`.
11. Workspace UI: full-height desk — AI chat (generate/refine) on the left; LaTeX source + PDF preview on the right; status bar for compile/fit.
12. Preview: `buildPreviewDocument` + `compileLatex`; `fit-validation.ts` may trigger one fit-refine.
13. Auto-repair: up to two `mode: "repair"` rounds on compile errors.
14. Refinement / history: refine bar + version chips + `figure-history.ts` localStorage.
15. Export: paste snippet, Download .zip, Open in Overleaf (client snip form POST; optional `/api/export-overleaf` token path).

Landing below the fold adds proof sections (`FitDemo`, `HowItWorks`, `VsChatGPT`, `ExportProof`) that reuse the same visual language as the Describe card — not a separate marketing skin.

## Security layer

- The OpenRouter key lives only in server env (`OPEN_ROUTER_API`); the browser never sees it.
- `api/_lib/security.js`: per-IP rate limiting (in-memory, per warm instance), prompt type/length validation, and output markers to catch system-prompt extraction.
- `generate-latex` whitelists all preference fields because they are interpolated into the system prompt (prompt-injection vector otherwise).
- Upstream error bodies are logged server-side only; clients receive generic messages.
- OpenRouter calls carry a 60s timeout so a hung upstream cannot hold a function open.
- `vercel.json` sets `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and `Permissions-Policy`; preview iframes use `referrerPolicy="no-referrer"`.
- Known limit: the in-memory rate limiter resets on serverless cold starts; a shared store (e.g. Upstash) is the planned upgrade.

## Compilation and build orchestration

- LaTeX compilation is delegated to texlive.net's latexcgi via same-origin `/api/compile-latex` (proxied from `compileLatex` in `src/lib/latex-compiler.ts`); multipart POST, no URL-size limit, ~1-2s per compile. There is no local `pdflatex`, compile queue, or artifact cache.
- Failed compiles return the TeX log as text (HTTP 422); `extractErrors` on the client pulls the `!`-prefixed error lines so both pages can render readable diagnostics.
- Frontend production builds: `npm run build` / `npm run build:dev` (Vite). Local development: `npm run dev` (Vite + `apiDevPlugin`). Tests: `npm test` (Vitest/JSDOM).

## Deliberate tradeoffs

- Compilation is proxied through `/api/compile-latex` instead of calling texlive.net from the browser, because texlive.net does not send CORS headers.
- Local Vite reuses the production API handlers through `apiDevPlugin` instead of maintaining a second development backend.
- Model prompting is paired with `normalizeLatex` instead of trusting model output alone, trading some output rewriting for more reliable TikZ prerequisites.
- Model fallback retries only transient failures (rate limits, timeouts), favoring availability without masking billing or configuration errors.
- Diagram and paper generation use separate handlers/prompts but share transport, security, and provider code.
- Rate limiting is in-memory rather than backed by shared storage, trading strictness for zero infrastructure.
- shadcn primitives are stored in-repository instead of consumed as an opaque package, favoring customization at the cost of a larger module surface.
- Page-local state is used instead of a global document model, fitting two independent workflows but providing no cross-route session persistence.
- Application TypeScript strictness is relaxed, favoring iteration speed over maximum static guarantees.
