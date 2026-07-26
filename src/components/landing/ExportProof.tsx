import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "desk" | "zoom";

const ACTIONS = [
  { id: "zip" as const, label: ".zip", icon: Download },
  { id: "overleaf" as const, label: "Overleaf", icon: ExternalLink },
  { id: "copy" as const, label: "Copy", icon: Copy },
];

interface ExportProofProps {
  mockDark: boolean;
}

/**
 * Workspace desk → zoom into Source export actions.
 * Focus uses a per-button border (always border-2 so it fades, not jumps).
 */
export function ExportProof({ mockDark }: ExportProofProps) {
  const [phase, setPhase] = useState<Phase>("desk");
  const [active, setActive] = useState(-1);
  const [copied, setCopied] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) {
      setPhase("zoom");
      setActive(0);
      return;
    }
    let cancelled = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timers.push(id);
    };

    const loop = () => {
      setPhase("desk");
      setActive(-1);
      setCopied(false);
      later(() => {
        if (cancelled) return;
        setPhase("zoom");
        // Let zoom finish, then step focus across actions
        later(() => {
          if (cancelled) return;
          let i = 0;
          const step = () => {
            if (cancelled) return;
            setActive(i);
            if (ACTIONS[i].id === "copy") {
              later(() => {
                if (!cancelled) setCopied(true);
              }, 450);
              later(() => {
                if (!cancelled) setCopied(false);
              }, 1150);
            } else {
              setCopied(false);
            }
            i += 1;
            if (i < ACTIONS.length) {
              later(step, 1500);
            } else {
              later(loop, 2200);
            }
          };
          step();
        }, 780);
      }, 2000);
    };

    loop();
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [reduced]);

  const zoomed = phase === "zoom";

  return (
    <section className="mx-auto max-w-5xl px-6 pb-20 pt-14 sm:pb-24">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Export
        </p>
        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Copy, zip, or Overleaf — from the Source bar.
        </h2>
      </div>

      <div
        className={cn(
          "workspace-desk relative overflow-hidden rounded-lg border border-[var(--ws-divider)]",
          mockDark ? "dark shadow-2xl shadow-black/40" : "shadow-lg shadow-slate-900/10",
        )}
      >
        <div className="relative h-[400px] overflow-hidden bg-[var(--ws-bg)]">
          <div
            className={cn(
              "absolute transition-[inset,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
              zoomed
                ? "inset-10 origin-top-right scale-[1.55]"
                : "inset-0 origin-top-right scale-100",
            )}
          >
            <div className="flex h-full min-h-0">
              <aside className="flex w-[40%] flex-col border-r border-[var(--ws-divider)] bg-[var(--ws-bg)]">
                <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--ws-divider)] px-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--ws-text)]" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-text-muted)]">
                      Agent
                    </span>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                    Refine
                  </span>
                </div>
                <div className="flex-1 space-y-3 overflow-hidden p-3">
                  <div className="ml-auto max-w-[95%] rounded-2xl bg-[var(--ws-input)] px-3 py-2">
                    <p className="line-clamp-5 font-heading text-[11px] leading-relaxed text-[var(--ws-text)]">
                      A clean NLP pipeline flowchart for text classification: raw text → tokenization
                      → bag-of-words → TF-IDF → SVM → metrics.
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[10px] text-muted-foreground">teXlab</p>
                    <p className="font-heading text-[12px] text-[var(--ws-text)]">
                      Figure drafted. Compiling preview and checking paper fit…
                    </p>
                    <p className="mt-1.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                      Diagram · flowchart
                    </p>
                  </div>
                </div>
              </aside>

              <section className="flex min-w-0 flex-1 flex-col bg-[var(--ws-bg)]">
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

                  <div className="flex items-center gap-2">
                    {ACTIONS.map((action, i) => {
                      const Icon = action.icon;
                      const on = zoomed && i === active;
                      const showCopied = action.id === "copy" && copied && on;
                      return (
                        <span
                          key={action.id}
                          className={cn(
                            // Equal width slots so .zip / Overleaf / Copy sit evenly
                            "flex h-7 w-[5.25rem] shrink-0 items-center justify-center gap-1 rounded-md px-1 font-mono text-[10px] leading-none",
                            "transition-[color,background-color,box-shadow] duration-500 ease-out",
                            on
                              ? cn(
                                  "bg-[var(--ws-input)] text-[var(--ws-text)]",
                                  mockDark
                                    ? "shadow-[0_0_0_1.5px_#fff]"
                                    : "shadow-[0_0_0_1.5px_hsl(var(--foreground))]",
                                )
                              : "text-[var(--ws-text-muted)] shadow-none",
                          )}
                        >
                          {showCopied ? (
                            <Check className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
                          ) : (
                            <Icon className="h-3 w-3 shrink-0" aria-hidden />
                          )}
                          <span className="leading-none">{showCopied ? "Copied" : action.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
                  <div className="flex gap-3 font-mono text-[11px] leading-relaxed">
                    <div className="select-none text-right text-muted-foreground/40">
                      {Array.from({ length: 14 }, (_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    <pre className="overflow-hidden text-[11px] text-[var(--ws-text)]/85">
{`% Add to your preamble if missing:
\\usepackage{tikz}
\\usepackage{xcolor}
\\definecolor{tlblue}{HTML}{2E6B8A}
\\definecolor{tlteal}{HTML}{3D8B7A}
\\begin{figure}[t]
  \\centering
  \\resizebox{\\columnwidth}{!}{%
    \\input{figures/nlp-pipeline.tex}%
  }
  \\caption{NLP classification pipeline.}
  \\label{fig:nlp-pipeline}
\\end{figure}`}
                    </pre>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div
            className={cn(
              "pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center transition-opacity duration-500",
              zoomed ? "opacity-100" : "opacity-0",
            )}
          >
            <p className="rounded-md border border-[var(--ws-divider)] bg-[var(--ws-bg)]/95 px-3 py-1.5 font-mono text-[10px] text-[var(--ws-text-muted)] shadow-sm backdrop-blur-sm">
              Source bar · .zip · Overleaf · Copy
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
