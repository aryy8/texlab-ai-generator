# Architecture

## Scope

This repository is the teXlab AI LaTeX generator, not the Rust TexLab language server. It contains no crates, LSP transport, `initialize`, `textDocument/didOpen`, LSP completion handlers, or local TeX compiler.

## Module map

- `api/` — Vercel-style HTTP handlers; `api/_lib/` holds the shared OpenRouter client and security helpers (underscore prefix keeps them from being deployed as public routes).
- `src/pages/` — Route-level generator experiences: diagram/table generation, full-paper generation, and 404 handling.
- `src/lib/` — Browser API calls (`openrouter.ts`) and shared class-name composition (`utils.ts`).
- `src/components/` — Shared navigation plus the vendored shadcn/Radix UI primitive library.
- `src/hooks/` — Shared toast state and responsive viewport detection.
- `src/test/` — Vitest/JSDOM setup and the current smoke test.
- `src/main.tsx` — Browser entry point.
- `src/App.tsx` — Global providers and route table.
- `src/index.css`, `src/App.css` — Global design tokens, Tailwind layers, utilities, and app styling.
- `public/` — Static favicon and crawler policy.
- `vite-plugin-api-dev.ts` — Local adapter that runs the production API handlers inside Vite.
- `vite.config.ts` — Vite dev/build configuration, aliases, environment loading, and plugins.
- `tailwind.config.ts`, `postcss.config.js`, `components.json` — Styling and shadcn configuration.
- `vitest.config.ts`, `eslint.config.js`, `tsconfig*.json` — Test, lint, and TypeScript boundaries.
- `index.html` — Browser shell and metadata.
- `package.json`, lockfiles — Scripts and dependency resolution.
- `README.md` — Product purpose and local setup.

## Request lifecycle

There is no LSP lifecycle to trace. The closest complete application lifecycle is:

1. Startup: `index.html` loads `src/main.tsx`; `createRoot` renders `App`.
2. Initialization: `App` installs `QueryClientProvider`, `TooltipProvider`, toast providers, and `BrowserRouter`, then routes `/` to `Index`.
3. Input: `Index` owns prompt state; no document-open notification or server-side document store exists.
4. Completion request: `Index.handleGenerate` calls `generateLaTeX` in `src/lib/openrouter.ts`.
5. HTTP hop: `generateLaTeX` posts to `/api/generate-latex`.
6. Local routing: in development, `apiDevPlugin.configureServer` maps that URL to `api/generate-latex.js`; on Vercel, the file is the serverless route.
7. Provider call: `handler` validates input and rate limits, then calls `createCompletion` in `api/_lib/openrouter-client.js`.
8. Model selection: `createCompletion` uses `getConfiguredModels` and `requestCompletion`; HTTP 429 responses advance through the ordered model list.
9. Output normalization: `requestCompletion` passes model output through `normalizeLatex`.
10. Response: `handler` returns `content`; `generateLaTeX` returns it to `Index.handleGenerate`, which stores it as `output`.
11. Compilation: `Index.getPreviewUrl` creates a standalone document URL; the preview iframe asks `latexonline.cc/compile` to compile it.

The paper route is parallel: `Workspace.handleGenerate` → `generatePaperLaTeX` → `/api/generate-paper` → `handler` → `createCompletion` → `Workspace.getPreviewUrl`.

## Completion providers

No LSP completion providers exist. AI completion is centralized in `api/_lib/openrouter-client.js`; validation and rate limiting live in `api/_lib/security.js`.

- `DEFAULT_OPENROUTER_MODELS` defines the ordered hosted-model fallback list.
- `getConfiguredModels` permits an `OPENROUTER_MODEL` environment override.
- `requestCompletion` owns the OpenRouter HTTP call.
- `createCompletion` coordinates fallback and exposes one interface to both API handlers.
- `normalizeLatex` applies shared post-generation LaTeX normalization.
- Prompt specialization remains in `api/generate-latex.js` and `api/generate-paper.js`, not in provider-specific classes.

## Compilation and build orchestration

- Browser LaTeX compilation lives in `Index.getPreviewUrl` and `Workspace.getPreviewUrl`; setting generated `output` mounts/updates the iframe and triggers `latexonline.cc`.
- There is no local `pdflatex`, compile queue, artifact cache, or compile-on-save watcher.
- Frontend production builds are triggered by `npm run build`/`npm run build:dev`, both invoking Vite.
- Local development is triggered by `npm run dev`; `vite.config.ts` installs React/SWC and `apiDevPlugin`.
- Tests are triggered by `npm test`; `vitest.config.ts` supplies JSDOM and `src/test/setup.ts`.

## Deliberate tradeoffs

- API keys stay in server handlers instead of browser code, trading a server hop for credential isolation.
- Local Vite reuses the production API handlers through `apiDevPlugin` instead of maintaining a second development backend.
- Compilation is delegated to LaTeXOnline instead of bundling TeX, keeping deployment small while accepting external-service, URL-size, and diagnostics constraints.
- Model prompting is paired with `normalizeLatex` instead of trusting model output alone, trading some output rewriting for more reliable TikZ prerequisites.
- Model fallback occurs for rate limiting but stops on other failures, favoring availability without masking billing or configuration errors.
- Diagram generation and paper generation use separate handlers/prompts but share transport and provider code, preserving task-specific behavior without duplicating integration logic.
- shadcn primitives are stored in-repository instead of consumed as an opaque component package, favoring customization at the cost of a larger module surface.
- Page-local state is used instead of a global document model, fitting two independent workflows but providing no cross-route session persistence.
- Application TypeScript strictness is relaxed, favoring iteration speed over maximum static guarantees.
