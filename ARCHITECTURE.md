# Architecture

teXlab is a React/Vite web app that turns natural-language prompts into LaTeX via OpenRouter-hosted models, with live PDF previews compiled remotely by LaTeXOnline. There is no local TeX toolchain.

## Module map

- `api/` — Vercel-style serverless HTTP handlers (`generate-latex.js`, `generate-paper.js`).
- `api/_lib/` — Shared OpenRouter client and security helpers (rate limiting, input validation, prompt-leak checks); the underscore prefix keeps them from being deployed as public routes.
- `src/pages/` — Route-level experiences: diagram/table generation (`Index`), full-paper generation (`Workspace`), and 404 handling.
- `src/lib/` — Browser API client (`openrouter.ts`) and class-name composition (`utils.ts`).
- `src/components/` — Shared navigation plus the vendored shadcn/Radix UI primitive library.
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
3. Input: `Index` owns prompt state; the textarea enforces the same length cap as the server.
4. Request: `Index.handleGenerate` calls `generateLaTeX` in `src/lib/openrouter.ts`, which posts to `/api/generate-latex`.
5. Routing: in development, `apiDevPlugin.configureServer` maps that URL to `api/generate-latex.js`; on Vercel, the file is the serverless route.
6. Guarding: the handler checks method, per-IP rate limit (`checkRateLimit`), and prompt validity (`validatePrompt`) before touching the AI provider.
7. Provider call: the handler calls `createCompletion` in `api/_lib/openrouter-client.js` with a hardened system prompt.
8. Model selection: `createCompletion` walks an ordered fallback list (`DEFAULT_OPENROUTER_MODELS`, overridable via `OPENROUTER_MODEL`); HTTP 429 and timeouts advance to the next model, other failures stop immediately.
9. Normalization: successful output passes through `normalizeLatex` (fence stripping, TikZ library repair) and a system-prompt-leak check before being returned as `{ content }`.
10. Response: `generateLaTeX` returns the content to `Index.handleGenerate`, which stores it as `output`. Errors surface as sanitized toast messages.
11. Preview: `Index.getPreviewUrl` wraps the output in a standalone document and points the preview iframe at `latexonline.cc/compile?text=...`.

The paper route is parallel: `Workspace.handleGenerate` → `generatePaperLaTeX` → `/api/generate-paper` → handler (adds a format whitelist: ieee/acm/article/report) → `createCompletion` → `Workspace.getPreviewUrl`, which sends the full document unchanged.

## Security layer

- The OpenRouter key lives only in server env (`OPEN_ROUTER_API`); the browser never sees it.
- `api/_lib/security.js`: per-IP rate limiting (in-memory, per warm instance), prompt type/length validation, and output markers to catch system-prompt extraction.
- `generate-paper` whitelists `format` because it is interpolated into the system prompt (prompt-injection vector otherwise).
- Upstream error bodies are logged server-side only; clients receive generic messages.
- OpenRouter calls carry a 60s timeout so a hung upstream cannot hold a function open.
- `vercel.json` sets `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and `Permissions-Policy`; preview iframes use `referrerPolicy="no-referrer"`.
- Known limit: the in-memory rate limiter resets on serverless cold starts; a shared store (e.g. Upstash) is the planned upgrade.

## Compilation and build orchestration

- LaTeX compilation is delegated to LaTeXOnline via GET-query iframes in `Index.getPreviewUrl` and `Workspace.getPreviewUrl`; there is no local `pdflatex`, compile queue, or artifact cache.
- The GET endpoint rejects request URLs beyond ~8 KB (HTTP 414), so large papers can fail to preview; the planned fix is a backend compile endpoint that POSTs a tar archive to LaTeXOnline's `/data`.
- Frontend production builds: `npm run build` / `npm run build:dev` (Vite). Local development: `npm run dev` (Vite + `apiDevPlugin`). Tests: `npm test` (Vitest/JSDOM).

## Deliberate tradeoffs

- Compilation is delegated to LaTeXOnline instead of bundling TeX, keeping deployment small while accepting external-service, URL-size, and diagnostics constraints.
- Local Vite reuses the production API handlers through `apiDevPlugin` instead of maintaining a second development backend.
- Model prompting is paired with `normalizeLatex` instead of trusting model output alone, trading some output rewriting for more reliable TikZ prerequisites.
- Model fallback retries only transient failures (rate limits, timeouts), favoring availability without masking billing or configuration errors.
- Diagram and paper generation use separate handlers/prompts but share transport, security, and provider code.
- Rate limiting is in-memory rather than backed by shared storage, trading strictness for zero infrastructure.
- shadcn primitives are stored in-repository instead of consumed as an opaque package, favoring customization at the cost of a larger module surface.
- Page-local state is used instead of a global document model, fitting two independent workflows but providing no cross-route session persistence.
- Application TypeScript strictness is relaxed, favoring iteration speed over maximum static guarantees.
