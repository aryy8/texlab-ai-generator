import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Mic,
  MoreHorizontal,
  Plus,
  Share,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/use-in-view";

type Beat = "prompt" | "respond" | "result";

const BEAT_MS: Record<Beat, number> = {
  prompt: 1600,
  respond: 2400,
  result: 3800,
};

const BEAT_ORDER: Beat[] = ["prompt", "respond", "result"];

const PROMPT =
  "Publication-quality TikZ feed-forward neural network: four layers with 4, 6, 6, and 2 circular neurons, fully connected. Steel-blue fills, Input / Hidden / Output labels — in latex code";

const GPT_CODE_START = `\\documentclass[tikz,border=8pt]{standalone}

\\usepackage{tikz}
\\usetikzlibrary{arrows.meta,positioning,calc}

\\begin{document}

\\begin{tikzpicture}[
    font=\\sffamily,
    >=Latex,
    neuron/.style={circle, draw, fill=blue!12},
]

  % Layer loops…
  \\node[neuron] (L1-1) {};
  % …`;

const GPT_CODE_END = `% Overall Caption
%---------------------------------------------------------
\\node[
    font=\\bfseries\\large
] at ($(L1.north)!0.5!(L4.north)+(0,1.1)$)
{Feed-forward Neural Network};

\\end{tikzpicture}

\\end{document}`;

const GPT_BLURBS = [
  "Four layers of circular neurons (4–6–6–2)",
  "Fully connected edges between adjacent layers",
  "Sans-serif labels: Input, Hidden, Hidden, Output",
  "Parametric spacing you can edit in the preamble",
];

const DIFFS = [
  { bad: "Code only — no PDF preview", good: "Compiled preview beside the source" },
  { bad: "You fix compile errors yourself", good: "Auto-repair + fit check" },
  { bad: "May overflow the paper column", good: "Validated for column / full width" },
];

interface VsChatGPTProps {
  mockDark: boolean;
}

export function VsChatGPT({ mockDark }: VsChatGPTProps) {
  const { ref, inView } = useInView<HTMLElement>();
  const [beat, setBeat] = useState<Beat>("result");
  const [reduced, setReduced] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) {
      setBeat("result");
      return;
    }
    if (!inView) {
      setBeat("result");
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      const current = BEAT_ORDER[i];
      setBeat(current);
      timer = window.setTimeout(() => {
        i = (i + 1) % BEAT_ORDER.length;
        tick();
      }, BEAT_MS[current]);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [reduced, inView]);

  // Scroll chat to the ending prose when the result beat lands.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    if (beat === "result") {
      const run = () => {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: reduced ? "auto" : "smooth",
        });
      };
      // Double rAF so the result DOM is laid out before measuring height.
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(run);
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    }
    if (beat === "prompt") {
      el.scrollTop = 0;
    }
  }, [beat, reduced]);

  const gptBusy = beat === "respond";
  const gptDone = beat === "result";
  const txBusy = beat === "respond";
  const txDone = beat === "result";

  return (
    <section ref={ref} className="mx-auto max-w-5xl px-6 py-14">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Why teXlab
        </p>
        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Same prompt. Different outcome.
        </h2>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ChatGPT chrome */}
        <div
          className={cn(
            "flex h-[380px] flex-col overflow-hidden rounded-2xl border shadow-lg",
            mockDark
              ? "border-[#2f2f2f] bg-[#212121] text-[#ececec]"
              : "border-[#e5e5e5] bg-white text-[#0d0d0d]",
          )}
        >
          <header
            className={cn(
              "flex h-10 shrink-0 items-center justify-between px-3",
              mockDark ? "text-[#ececec]" : "text-[#0d0d0d]",
            )}
          >
            <button type="button" className="flex items-center gap-1 text-[13px] font-medium">
              ChatGPT
              <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
            </button>
            <div className="flex items-center gap-2 opacity-70">
              <Share className="h-4 w-4" aria-hidden />
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </div>
          </header>

          <div
            ref={chatScrollRef}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* User bubble */}
            <div className="flex shrink-0 justify-end">
              <div
                className={cn(
                  "max-w-[88%] rounded-[22px] px-3.5 py-2.5",
                  mockDark ? "bg-[#2f2f2f]" : "bg-[#f4f4f4]",
                )}
              >
                <p className="line-clamp-3 text-[12px] leading-relaxed">
                  {PROMPT}
                  {beat === "prompt" && !reduced && (
                    <span
                      className={cn(
                        "ml-0.5 inline-block h-3 w-px animate-pulse align-middle",
                        mockDark ? "bg-[#ececec]" : "bg-[#0d0d0d]",
                      )}
                    />
                  )}
                </p>
              </div>
            </div>

            {(gptBusy || gptDone) && (
              <div className="relative shrink-0 overflow-hidden">
                <div
                  className={cn(
                    "overflow-hidden rounded-2xl",
                    mockDark ? "bg-[#2f2f2f]" : "bg-[#f4f4f4]",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-[11px]",
                      mockDark ? "text-[#b4b4b4]" : "text-[#5d5d5d]",
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="opacity-70">&lt;/&gt;</span> LaTeX
                    </span>
                    <Copy className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  </div>
                  <pre
                    className={cn(
                      "overflow-hidden px-3 pb-3 font-mono text-[10px] leading-[1.55]",
                      gptBusy ? "max-h-[140px]" : "max-h-[88px]",
                      mockDark ? "text-[#ececec]" : "text-[#0d0d0d]",
                      gptBusy && "opacity-75",
                    )}
                  >
                    {gptDone ? GPT_CODE_END : GPT_CODE_START}
                  </pre>
                </div>
                {gptBusy && (
                  <div
                    className={cn(
                      "pointer-events-none absolute bottom-2 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full shadow-sm",
                      mockDark
                        ? "border border-white/10 bg-[#303030]/95 text-[#ececec]"
                        : "border border-black/10 bg-white/90 text-[#0d0d0d]",
                    )}
                  >
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                  </div>
                )}
              </div>
            )}

            {gptBusy && (
              <p className={cn("shrink-0 text-[12px]", mockDark ? "text-[#8e8e8e]" : "text-[#5d5d5d]")}>
                Generating LaTeX code…
              </p>
            )}

            {gptDone && (
              <div className="shrink-0">
                <p className="text-[12px] leading-snug">
                  This produces a publication-style neural network with:
                </p>
                <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug">
                  {GPT_BLURBS.map((line) => (
                    <li key={line} className={mockDark ? "text-[#cfcfcf]" : "text-[#303030]"}>
                      <span className="mr-1.5">•</span>
                      {line}
                    </li>
                  ))}
                </ul>

                <div
                  className={cn(
                    "mt-2 space-y-1 rounded-xl px-2.5 py-2",
                    mockDark ? "bg-[#2a2a2a]" : "bg-[#fff7ed]",
                  )}
                >
                  {DIFFS.map((d) => (
                    <p
                      key={d.bad}
                      className={cn(
                        "font-mono text-[9px] leading-snug",
                        mockDark ? "text-[#b4b4b4]" : "text-[#6b6b6b]",
                      )}
                    >
                      <span className="mr-1 text-red-400">×</span>
                      {d.bad}
                    </p>
                  ))}
                </div>

                <div
                  className={cn(
                    "mt-2 flex items-center gap-3 opacity-50",
                    mockDark ? "text-[#ececec]" : "text-[#5d5d5d]",
                  )}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                  <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                  <Share className="h-3.5 w-3.5" aria-hidden />
                </div>
              </div>
            )}

            <div ref={chatEndRef} className="h-px shrink-0" aria-hidden />
          </div>

          <div className="shrink-0 px-3 pb-3 pt-1">
            <div
              className={cn(
                "flex h-12 items-center gap-2.5 rounded-full px-3.5",
                mockDark
                  ? "bg-[#303030]"
                  : "border border-[#e5e5e5] bg-[#f4f4f4]",
              )}
            >
              <Plus
                className={cn("h-[18px] w-[18px] shrink-0", mockDark ? "text-white" : "text-[#0d0d0d]")}
                strokeWidth={1.75}
                aria-hidden
              />
              <span
                className={cn(
                  "flex-1 text-[15px] leading-none",
                  mockDark ? "text-[#8e8e8e]" : "text-[#8e8e8e]",
                )}
              >
                Ask anything
              </span>
              <Mic
                className={cn("h-[18px] w-[18px] shrink-0", mockDark ? "text-white" : "text-[#0d0d0d]")}
                strokeWidth={1.75}
                aria-hidden
              />
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  mockDark ? "bg-white" : "bg-[#0d0d0d]",
                )}
              >
                <AudioLines
                  className={cn("h-4 w-4", mockDark ? "text-black" : "text-white")}
                  strokeWidth={2.25}
                  aria-hidden
                />
              </span>
            </div>
          </div>
        </div>

        {/* teXlab — fixed same height */}
        <div
          className={cn(
            "workspace-desk flex h-[380px] flex-col overflow-hidden rounded-2xl border border-[var(--ws-divider)] shadow-lg",
            mockDark ? "dark" : "",
          )}
        >
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--ws-divider)] bg-[var(--ws-bg)] px-3">
            <span className="font-heading text-xs font-bold tracking-tighter text-[var(--ws-text)]">
              te<span className="font-mono">X</span>lab
            </span>
            <span
              className={cn(
                "flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide",
                txDone
                  ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : txBusy
                    ? "border-[var(--ws-input-border)] text-[var(--ws-text)]"
                    : "border-[var(--ws-input-border)] text-[var(--ws-text-muted)]",
              )}
            >
              {txBusy && <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />}
              {txDone && <Check className="h-2.5 w-2.5" aria-hidden />}
              {txBusy ? "Compiling…" : txDone ? "Ready" : "Idle"}
            </span>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-2">
            <div className="flex min-h-0 flex-col border-r border-[var(--ws-divider)] bg-[var(--ws-bg)]">
              <div className="shrink-0 border-b border-[var(--ws-divider)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--ws-text-muted)]">
                Agent
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">
                <div className="ml-auto max-w-[95%] shrink-0 rounded-2xl bg-[var(--ws-input)] px-2.5 py-1.5">
                  <p className="line-clamp-4 font-heading text-[10px] leading-relaxed text-[var(--ws-text)]">
                    {PROMPT}
                  </p>
                </div>
                {txBusy && (
                  <p className="text-shimmer shrink-0 font-mono text-[10px]">Writing LaTeX…</p>
                )}
                {txDone && (
                  <div className="min-h-0 space-y-1 overflow-hidden">
                    <p className="font-heading text-[10px] text-[var(--ws-text-muted)]">
                      Figure drafted. Preview ready.
                    </p>
                    {DIFFS.map((d) => (
                      <p
                        key={d.good}
                        className="font-mono text-[9px] text-emerald-700 dark:text-emerald-400"
                      >
                        ✓ {d.good}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="relative flex min-h-0 flex-col bg-[var(--ws-bg)]">
              <div className="shrink-0 border-b border-[var(--ws-divider)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--ws-text-muted)]">
                Preview
              </div>
              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-white p-2">
                {txBusy && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                      Compiling
                    </span>
                  </div>
                )}
                <img
                  src="/templates/neural-network.png"
                  alt=""
                  className={cn(
                    "absolute inset-0 m-auto max-h-[90%] max-w-[92%] object-contain transition-opacity duration-400",
                    txDone ? "opacity-100" : "opacity-0",
                  )}
                  decoding="async"
                />
                {beat === "prompt" && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                    PDF preview
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex h-8 shrink-0 items-center justify-between border-t border-[var(--ws-divider)] bg-[var(--ws-bar)] px-3 font-mono text-[9px] text-[var(--ws-text-muted)]">
            <span>{txDone ? "compiled · fits column" : "texlab / main"}</span>
            <span>pdfTeX</span>
          </div>
        </div>
      </div>
    </section>
  );
}
