# Architecture

teXlab is a React/Vite web app that turns natural-language prompts into LaTeX via OpenRouter-hosted models, with live PDF previews compiled remotely by texlive.net's latexcgi service. There is no local TeX toolchain.

## Module map

- `api/` — Vercel-style serverless HTTP handlers (`generate-latex.js`, `compile-latex.js`, `export-overleaf.js`).
- `api/_lib/` — Shared OpenRouter client and security helpers (rate limiting, input validation, prompt-leak checks); the underscore prefix keeps them from being deployed as public routes.
- `src/pages/` — Route-level experiences: figure/table generation (`Index`) and 404 handling.
- `src/lib/` — Browser API client (`openrouter.ts`), compile client (`latex-compiler.ts`), figure export/fit (`figure-export.ts`, `fit-validation.ts`), templates, local history, Overleaf zip export, and utilities.
- `src/components/` — Shared UI including `LatexCode`, `FigureHistoryDrawer`, and shadcn/Radix primitives.
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
2. Initialization: `App` installs `QueryClientProvider`, `TooltipProvider`, toast providers, and `BrowserRouter`, then routes `/` to `Index`.
3. Input: `Index` owns prompt plus structured preferences (output-type, style, color, density, canvas aspect, arrow style, document fit) presented as an icon segmented control, style pills, and a "Format" popover; users can also attach up to four references (images or .tex/.bib/.txt/.csv text) via a paperclip. The textarea enforces the same length cap as the server.
4. Request: `Index.handleGenerate` calls `generateLaTeX` in `src/lib/openrouter.ts`, which posts the prompt, preferences, and references to `/api/generate-latex`.
5. Routing: in development, `apiDevPlugin.configureServer` maps that URL to `api/generate-latex.js`; on Vercel, the file is the serverless route.
6. Guarding: the handler checks method, per-IP rate limit (`checkRateLimit`), prompt validity (`validatePrompt`), every preference against server-owned whitelists, and each reference (kind, size, count) before touching the AI provider.
7. Provider call: the handler calls `createCompletion` in `api/_lib/openrouter-client.js` with a hardened system prompt; image references are passed as multimodal `image_url` content parts.
8. Model selection: `createCompletion` walks an ordered fallback list chosen by `OPENROUTER_TIER` (`paid` → `PAID_OPENROUTER_MODELS`, otherwise `FREE_OPENROUTER_MODELS`; `OPENROUTER_MODEL` overrides either); rate limits, timeouts, credit (402), missing-model (404), and 5xx errors advance to the next model, auth failures stop immediately. When image references are present, the list is filtered to vision-capable models.
9. Normalization: successful output passes through `normalizeLatex` (fence stripping, TikZ library repair) and a system-prompt-leak check before being returned as `{ content }`.
10. Response: `generateLaTeX` returns the content to `Index.handleGenerate`, which stores it as `output`. Errors surface as sanitized toast messages.
11. Preview: an effect in `Index` wraps the output via `buildPreviewDocument` (`src/lib/figure-export.ts`) and calls `compileLatex`. Post-compile, `fit-validation.ts` checks for edge cropping; one automatic fit-refine may run if content overflows the chosen paper width.
12. Auto-repair: up to two automatic `mode: "repair"` rounds on compile errors, then fit-only refine if validation fails.
13. Refinement: Refine bar sends `mode: "refine"` with optional rasterized preview image for vision models.
14. Version history and local persistence: versions tab bar plus `figure-history.ts` (localStorage) auto-save after successful compile.
15. Export: paste-ready snippet tab, Download .zip, and Open in Overleaf via `/api/export-overleaf` (short-lived public zip URL for Overleaf Snip API).

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
