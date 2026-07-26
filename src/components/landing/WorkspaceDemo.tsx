import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArrowUp,
  Check,
  ChevronDown,
  CircleX,
  Copy,
  GitBranch,
  Loader2,
  Moon,
  Paperclip,
  Sparkles,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { LatexCode } from "@/components/LatexCode";
import { FIGURE_TEMPLATES } from "@/lib/templates";

/**
 * Faithful mock of /app: same chrome, 30 | 35 | 35 panel ratios,
 * and the real generate → compile → ready animations.
 */

type Beat = "idle" | "prompt" | "generate" | "compile" | "ready";

const BEAT_MS: Record<Beat, number> = {
  idle: 1600,
  prompt: 2400,
  generate: 3000,
  compile: 2000,
  ready: 3600,
};

const BEAT_ORDER: Beat[] = ["idle", "prompt", "generate", "compile", "ready"];

const GENERATION_STAGES = [
  "Reading your description...",
  "Planning the layout...",
  "Writing LaTeX code...",
  "Polishing details...",
  "Almost there...",
];

const OUTPUT_TYPES = ["Diagram", "Table", "Equation", "Plot"] as const;

const DEMO_PROMPT =
  "Model inference serving: Client → Internet → Load balancer → GPU nodes → Feature store";

/** Shortened library source so LatexCode looks like the desk after generate. */
const DEMO_LATEX = `\\documentclass[border=10pt]{standalone}
\\usepackage{tikz}
\\usetikzlibrary{positioning, arrows.meta, shapes.symbols, fit, backgrounds}
\\definecolor{tlblue}{HTML}{2E6B8A}
\\definecolor{tlteal}{HTML}{3D8B7A}
\\definecolor{tlorange}{HTML}{B86B2C}
\\definecolor{tlgray}{HTML}{3F4A56}
% cloud / server / gpu / db icon macros…
\\begin{document}
\\begin{tikzpicture}[
  >={Stealth[length=2.4mm]},
  external/.style={draw=tlgray!55, dashed, fill=tlgray!8},
  process/.style={draw=tlblue!75!black, fill=tlblue!11},
  req/.style={draw=tlgray!65, ->},
  read/.style={draw=tlteal!70!black, ->, dashed},
]
  \\node[external] (client) {Client};
  \\node[process] (lb) at (5.7,0) {Load\\\\balancer};
  \\node (node1) at (8.55,1.45) {\\serverpic\\hspace{4pt}\\gpupic};
  \\node (node2) at (8.55,-1.45) {\\serverpic\\hspace{4pt}\\gpupic};
  \\node (db) at (12.1,0) {\\dbpic};
  \\draw[req] (client) -- (lb);
  \\draw[req] (lb) -- (node1);
  \\draw[req] (lb) -- (node2);
  \\draw[read] (node1) -- (db);
  \\draw[read] (node2) -- (db);
  % dashed Inference cluster fit=(node1)(node2)…
\\end{tikzpicture}
\\end{document}`;

const DEMO_TEMPLATE = FIGURE_TEMPLATES.find((t) => t.id === "inference-serving");
const CHIP_TITLES = [
  ...FIGURE_TEMPLATES.slice(0, 4).map((t) => t.title),
  DEMO_TEMPLATE?.title ?? "Inference serving",
];
const ACTIVE_CHIP = DEMO_TEMPLATE?.title ?? "Inference serving";
const DEMO_PREVIEW = "/templates/inference-serving.png";

function BlueprintOverlay({ stageLabel }: { stageLabel: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[var(--ws-bg)]">
      <svg
        viewBox="0 0 220 130"
        className="w-40 text-primary/70"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <rect x="84" y="8" width="52" height="26" pathLength={100} className="blueprint-path" />
        <path d="M 110 34 L 110 56" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.25s" }} />
        <path d="M 110 56 L 40 56 L 40 88" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.45s" }} />
        <path d="M 110 56 L 180 56 L 180 88" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.45s" }} />
        <rect x="14" y="88" width="52" height="26" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.75s" }} />
        <rect x="154" y="88" width="52" height="26" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.75s" }} />
      </svg>
      <span className="text-shimmer font-mono text-[10px] font-semibold uppercase tracking-widest">
        {stageLabel}
      </span>
    </div>
  );
}

interface WorkspaceDemoProps {
  mockDark: boolean;
}

export function WorkspaceDemo({ mockDark }: WorkspaceDemoProps) {
  const [beat, setBeat] = useState<Beat>("ready");
  const [typed, setTyped] = useState("");
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setBeat("ready");
      setTyped(DEMO_PROMPT);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let index = 0;

    const tick = () => {
      if (cancelled) return;
      const current = BEAT_ORDER[index];
      setBeat(current);
      timer = window.setTimeout(() => {
        index = (index + 1) % BEAT_ORDER.length;
        tick();
      }, BEAT_MS[current]);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (beat !== "prompt") {
      setTyped(beat === "idle" ? "" : DEMO_PROMPT);
      return;
    }
    setTyped("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(DEMO_PROMPT.slice(0, i));
      if (i >= DEMO_PROMPT.length) window.clearInterval(id);
    }, 22);
    return () => window.clearInterval(id);
  }, [beat]);

  useEffect(() => {
    if (beat !== "generate") {
      setStageIndex(0);
      return;
    }
    setStageIndex(0);
    const id = window.setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, GENERATION_STAGES.length - 1));
    }, 580);
    return () => window.clearInterval(id);
  }, [beat]);

  const isIdle = beat === "idle";
  const isPrompt = beat === "prompt";
  const isGenerating = beat === "generate";
  const isCompiling = beat === "compile";
  const isReady = beat === "ready";
  const hasOutput = isCompiling || isReady;
  const showUserBubble = isGenerating || isCompiling || isReady;
  const showEmptyWelcome = isIdle || isPrompt;

  const pipelineLabel = isGenerating
    ? "Generating…"
    : isCompiling
      ? "Compiling…"
      : isReady
        ? "Ready"
        : "Idle";
  const pipelineBusy = isGenerating || isCompiling;
  const pipelineOk = isReady;

  return (
    <section id="workspace-demo" className="mx-auto max-w-5xl px-6 py-14">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Workspace demo
          </p>
          <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            The same desk. Prompt to preview.
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/app"
            className="inline-flex items-center border border-foreground bg-foreground px-3 py-1.5 font-mono text-[11px] text-background transition-opacity hover:opacity-90"
          >
            Open workspace
          </Link>
        </div>
      </div>

      {/* Desk shell; theme from shared mock toggle */}
      <div
        className={`workspace-desk overflow-hidden rounded-md border border-[var(--ws-divider)] ${
          mockDark
            ? "dark shadow-2xl shadow-black/50"
            : "shadow-lg shadow-slate-900/10"
        }`}
      >
        <div className="flex aspect-[16/10] w-full flex-col overflow-hidden">
          {/* Header — mirrors Workspace.tsx */}
          <header className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--ws-divider)] bg-[var(--ws-bg)] px-3">
            <div className="flex items-center gap-2.5">
              <span className="font-heading text-sm font-bold tracking-tighter text-[var(--ws-text)]">
                te<span className="font-mono">X</span>lab
              </span>
              <span className="hidden border border-[var(--ws-input-border)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--ws-text-muted)] sm:inline">
                workspace
              </span>
              <nav className="ml-1 hidden items-center gap-0.5 md:flex" aria-label="Figure type">
                {OUTPUT_TYPES.map((label) => (
                  <span
                    key={label}
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] ${
                      label === "Diagram"
                        ? "bg-[var(--ws-input)] text-[var(--ws-text)]"
                        : "text-[var(--ws-text-muted)]"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </nav>
              <span
                className={`flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                  pipelineOk
                    ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : pipelineBusy
                      ? "border-primary/30 bg-primary/10 text-foreground"
                      : "border-border/70 text-muted-foreground"
                }`}
              >
                {pipelineBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                {pipelineLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground"
                title={mockDark ? "Light mode (controlled above)" : "Dark mode (controlled above)"}
                aria-hidden
                tabIndex={-1}
              >
                {mockDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
              <span className="hidden h-7 items-center gap-1.5 rounded-md border border-border px-2.5 font-mono text-xs text-muted-foreground sm:inline-flex">
                <Archive className="h-3.5 w-3.5" />
                My figures
              </span>
              <span className="px-1.5 font-mono text-xs text-muted-foreground">Home</span>
            </div>
          </header>

          {/* Body — 30% agent | 35% source | 35% preview (workspace defaults 30 / 50-of-70 / 50-of-70) */}
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,30%)_minmax(0,35%)_minmax(0,35%)]">
            {/* Agent */}
            <aside className="flex min-h-0 flex-col border-b border-[var(--ws-divider)] bg-[var(--ws-bg)] lg:border-b-0">
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--ws-divider)] px-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--ws-text)]" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-text-muted)]">
                    Agent
                  </span>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                  {hasOutput || isGenerating ? "Refine" : "Generate"}
                </span>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-hidden px-4 py-4">
                {showEmptyWelcome && (
                  <div className="px-1 py-4">
                    <p className="font-heading text-base font-semibold tracking-tight text-[var(--ws-text)]">
                      What figure should we build?
                    </p>
                    <p className="mt-1.5 font-heading text-sm leading-relaxed text-[var(--ws-text-muted)]">
                      Describe a diagram, table, or plot — teXlab will generate, compile, and fit it.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {CHIP_TITLES.map((title) => (
                        <span
                          key={title}
                          className={`rounded-lg border px-2.5 py-1.5 font-mono text-[10px] transition-colors ${
                            isPrompt && title === ACTIVE_CHIP
                              ? "border-[var(--ws-input-border-focus)] bg-[var(--ws-input)] text-[var(--ws-text)]"
                              : "border-[var(--ws-input-border)] bg-[var(--ws-bar)] text-[var(--ws-text-muted)]"
                          }`}
                        >
                          {title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {showUserBubble && (
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl bg-[var(--ws-input)] px-3.5 py-2.5">
                      <p className="whitespace-pre-wrap font-heading text-[13px] leading-relaxed text-[var(--ws-text)]">
                        {DEMO_PROMPT}
                      </p>
                    </div>
                  </div>
                )}

                {isGenerating && (
                  <div className="flex justify-start">
                    <div className="max-w-[94%]">
                      <p className="mb-1 font-mono text-[10px] text-muted-foreground">teXlab</p>
                      <p className="text-shimmer font-mono text-[11px] font-medium">
                        {GENERATION_STAGES[stageIndex]}
                      </p>
                    </div>
                  </div>
                )}

                {isCompiling && (
                  <div className="flex justify-start">
                    <div className="max-w-[94%]">
                      <p className="mb-1 font-mono text-[10px] text-muted-foreground">teXlab</p>
                      <p className="font-mono text-[11px] text-muted-foreground">Compiling PDF…</p>
                    </div>
                  </div>
                )}

                {isReady && (
                  <div className="flex justify-start">
                    <div className="max-w-[94%]">
                      <p className="mb-1 font-mono text-[10px] text-muted-foreground">teXlab</p>
                      <p className="whitespace-pre-wrap font-heading text-[13px] leading-relaxed text-[var(--ws-text)]">
                        Figure drafted. Preview ready — inference serving with GPU cluster.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="ws-composer shrink-0 px-3 py-3">
                <div className="ws-composer-box">
                  <div className="min-h-[4.5rem] px-3 py-2.5 font-heading text-sm leading-relaxed text-[var(--ws-text)]">
                    {isPrompt ? (
                      <>
                        {typed}
                        {typed.length < DEMO_PROMPT.length && (
                          <span className="skeleton-caret ml-0.5 inline-block h-3.5 w-px bg-[var(--ws-text)] align-middle" />
                        )}
                      </>
                    ) : (
                      <span className="text-[var(--ws-text-muted)]">
                        {hasOutput || isGenerating
                          ? 'Ask for a change… e.g. "make boxes wider"'
                          : "Ask teXlab to build a figure…"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 px-2 pb-2">
                    <span className="ws-menu-trigger flex h-7 items-center gap-0.5 rounded-md px-1.5 font-mono text-[11px]">
                      Auto
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </span>
                    <span className="ws-menu-trigger flex h-7 items-center gap-0.5 rounded-md px-1.5 font-mono text-[11px]">
                      Format
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md ws-icon-btn">
                        <Paperclip className="h-3.5 w-3.5" />
                      </span>
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full ws-send ${
                          isPrompt && typed.length > 12 ? "" : "opacity-50"
                        }`}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowUp className="h-3.5 w-3.5" />
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 px-0.5 font-mono text-[9px] text-muted-foreground/60">
                  Enter to send · Shift+Enter for newline
                </p>
              </div>
            </aside>

            {/* Source */}
            <div className="ws-panel flex min-h-0 flex-col border-b border-[var(--ws-divider)] bg-[var(--ws-bg)] lg:border-b-0 lg:border-l">
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--ws-divider)] px-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Source
                  </span>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-foreground">
                    Paste
                  </span>
                </div>
                <span className="flex h-7 items-center gap-1 px-2 font-mono text-[10px] text-muted-foreground">
                  <Copy className="h-3 w-3" /> Copy
                </span>
              </div>

              {hasOutput ? (
                <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
                  <LatexCode code={DEMO_LATEX} />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Code
                  </p>
                  <p className="max-w-[16rem] font-heading text-sm text-muted-foreground">
                    {isGenerating
                      ? "Writing LaTeX…"
                      : "Your figure source appears here after you generate."}
                  </p>
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="ws-panel flex min-h-0 flex-col bg-[var(--ws-bg)] lg:border-l lg:border-[var(--ws-divider)]">
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--ws-divider)] px-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Preview
                  </span>
                  {isReady && (
                    <span className="rounded-md border border-emerald-600/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      ✓ Standalone
                    </span>
                  )}
                </div>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[var(--ws-bg)] p-2">
                {!hasOutput && !isGenerating && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    PDF preview
                  </p>
                )}

                {isGenerating && <BlueprintOverlay stageLabel={GENERATION_STAGES[stageIndex]} />}

                {isCompiling && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--ws-bg)]">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                    <span className="text-shimmer font-mono text-[10px] font-semibold uppercase tracking-widest">
                      Compiling…
                    </span>
                  </div>
                )}

                {hasOutput && (
                  <img
                    src={DEMO_PREVIEW}
                    alt=""
                    className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
                      isReady ? "opacity-100" : "opacity-0"
                    }`}
                    decoding="async"
                    loading="lazy"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="ws-footer flex h-7 shrink-0 select-none items-stretch justify-between overflow-hidden border-t font-mono text-[11px]">
            <div className="flex items-stretch">
              <span className="flex items-center gap-1.5 border-r border-[var(--ws-divider)] px-3 text-[var(--ws-text)]/80">
                <GitBranch className="h-3 w-3" />
                texlab/main
              </span>
              <span className="flex items-center gap-1.5 px-3">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    generating…
                  </>
                ) : isCompiling ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    compiling…
                  </>
                ) : isReady ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    compiled in 1.4s
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3" />
                    ready
                  </>
                )}
              </span>
              <span className="hidden items-center gap-2 border-l border-[var(--ws-divider)] px-3 sm:flex">
                <span className="flex items-center gap-1">
                  <CircleX className="h-3 w-3" />0
                </span>
                <span className="flex items-center gap-1">
                  <TriangleAlert className="h-3 w-3" />0
                </span>
              </span>
            </div>
            <div className="flex items-stretch">
              <span className="flex items-center border-l border-[var(--ws-divider)] px-3">LaTeX</span>
              <span className="hidden items-center border-l border-[var(--ws-divider)] px-3 md:flex">
                pdfTeX
              </span>
            </div>
          </footer>
        </div>
      </div>
    </section>
  );
}
