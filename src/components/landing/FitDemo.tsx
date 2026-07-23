import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { FIGURE_TEMPLATES } from "@/lib/templates";

type FitMode = "column" | "fullpage";

/** Story beats for the column-fit demo. */
type Beat = "generate" | "compile" | "overflow" | "fit";

const BEAT_MS: Record<Beat, number> = {
  generate: 1600,
  compile: 1400,
  overflow: 1700,
  fit: 2400,
};

const BEAT_ORDER_COLUMN: Beat[] = ["generate", "compile", "overflow", "fit"];
const BEAT_ORDER_FULLPAGE: Beat[] = ["generate", "compile", "fit"];

/**
 * Product demo: honest overflow → detect → fit story with real template art.
 * Column mode intentionally shows content wider than the guides, then scales it in.
 */
export function FitDemo() {
  const [fit, setFit] = useState<FitMode>("column");
  const [beat, setBeat] = useState<Beat>("fit");
  const [seq, setSeq] = useState(0); // bump to restart the loop
  const frameRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);

  // Prefer a dense column figure; fall back safely.
  const template =
    FIGURE_TEMPLATES.find((t) => t.id === "cnn-mnist") ??
    FIGURE_TEMPLATES.find((t) => t.id === "model-comparison") ??
    FIGURE_TEMPLATES[0];

  const restart = useCallback((mode: FitMode = fit) => {
    setFit(mode);
    setSeq((n) => n + 1);
    if (reducedRef.current) {
      setBeat("fit");
      return;
    }
    setBeat("generate");
  }, [fit]);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedRef.current) {
      setBeat("fit");
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let index = 0;

    const order = fit === "fullpage" ? BEAT_ORDER_FULLPAGE : BEAT_ORDER_COLUMN;

    const tick = () => {
      if (cancelled) return;
      const current = order[index];
      setBeat(current);
      timer = window.setTimeout(() => {
        index = (index + 1) % order.length;
        tick();
      }, BEAT_MS[current]);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [fit, seq]);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reducedRef.current || !frameRef.current) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    frameRef.current.style.transform = `perspective(900px) rotateY(${x * 3}deg) rotateX(${-y * 2.5}deg)`;
  };

  const onPointerLeave = () => {
    if (!frameRef.current) return;
    frameRef.current.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg)";
  };

  const isColumn = fit === "column";
  // Guide width as % of the paper frame (approx IEEE column vs textwidth on letter).
  const guideInset = isColumn ? "22%" : "7%";

  // Content scale: overflow is wider than the column guide; fit clamps inside.
  const showOverflow = isColumn && beat === "overflow";
  const contentMaxWidth =
    beat === "generate" || beat === "compile"
      ? isColumn
        ? "88%"
        : "86%"
      : showOverflow
        ? "92%"
        : isColumn
          ? "54%"
          : "84%";

  const status =
    beat === "generate"
      ? { label: "Generating…", tone: "neutral" as const }
      : beat === "compile"
        ? { label: "Compiling…", tone: "neutral" as const }
        : showOverflow
          ? { label: "Overflow — past column", tone: "warn" as const }
          : {
              label: isColumn ? "Fits IEEE column" : "Fits full width",
              tone: "ok" as const,
            };

  const isGenerating = beat === "generate";
  const isCompiling = beat === "compile";

  return (
    <section id="fit-demo" className="mx-auto max-w-5xl px-6 py-14">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Product demo
          </p>
          <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Compiles. Then fits the column.
          </h2>
          <p className="mt-2 max-w-lg font-heading text-sm text-muted-foreground">
            Watch overflow get caught against ~8.5&nbsp;cm guides — then scaled to fit. Same check runs after every generate.
          </p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Fit mode">
          {(
            [
              { value: "column" as const, label: "Column ~8.5 cm" },
              { value: "fullpage" as const, label: "Full page ~17 cm" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => restart(option.value)}
              className={`border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                fit === option.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        {/* Paper stage */}
        <div
          ref={frameRef}
          className="flex flex-col border-2 border-foreground bg-card p-3 transition-transform duration-200 ease-out will-change-transform"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          {/* Pure white paper so PNG whites merge — no tinted fill under the figure */}
          <div className="relative min-h-[280px] flex-1 overflow-hidden border border-border bg-white sm:min-h-[320px]">
            {/* Figure — scales on white paper; multiply blends PNG white into the page */}
            <div className="absolute inset-0 z-[5] flex items-center justify-center p-6">
              <div
                className="relative"
                style={{
                  width: contentMaxWidth,
                  maxHeight: "78%",
                  opacity: isGenerating ? 0.45 : 1,
                  filter: isGenerating ? "blur(6px)" : "blur(0px)",
                  transition: [
                    "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
                    isCompiling
                      ? `opacity ${BEAT_MS.compile}ms ease-out, filter ${BEAT_MS.compile}ms ease-out`
                      : "opacity 200ms ease-out, filter 200ms ease-out",
                  ].join(", "),
                }}
              >
                <img
                  src={template.previewSrc}
                  alt={template.title}
                  className="mx-auto max-h-[260px] w-full object-contain mix-blend-multiply sm:max-h-[280px]"
                  decoding="async"
                  loading="lazy"
                />
                {/* Overflow hatch on the part past the guide (column only) */}
                {showOverflow && (
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-[38%] mix-blend-normal animate-in fade-in duration-300"
                    style={{
                      background:
                        "repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(180,83,9,0.14) 4px, rgba(180,83,9,0.14) 8px)",
                    }}
                    aria-hidden
                  />
                )}
              </div>
            </div>

            {/* Column / full-page guides — lines only, no fill (fill made the PNG box visible) */}
            <div
              className="pointer-events-none absolute inset-y-4 z-10 transition-[left,right] duration-500 ease-out"
              style={{ left: guideInset, right: guideInset }}
              aria-hidden
            >
              <div
                className={`absolute inset-y-0 left-0 w-px transition-colors duration-300 ${
                  showOverflow ? "bg-amber-600/70" : beat === "fit" ? "bg-emerald-600/50" : "bg-primary/55"
                }`}
              />
              <div
                className={`absolute inset-y-0 right-0 w-px transition-colors duration-300 ${
                  showOverflow ? "bg-amber-600/70" : beat === "fit" ? "bg-emerald-600/50" : "bg-primary/55"
                }`}
              />
              <div
                className={`absolute inset-0 border border-dashed bg-transparent transition-colors duration-300 ${
                  showOverflow
                    ? "border-amber-600/45"
                    : beat === "fit"
                      ? "border-emerald-600/40"
                      : "border-primary/30"
                }`}
              />
              <span
                className={`absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2 border bg-white px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
                  showOverflow
                    ? "border-amber-600/50 text-amber-800"
                    : "border-border text-muted-foreground"
                }`}
              >
                {isColumn ? "8.5 cm" : "17 cm"}
              </span>
            </div>

            {/* Generate vs compile — distinct overlays (not the same spinner twice) */}
            {beat === "generate" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-white/80 animate-in fade-in duration-300">
                {/* Blueprint sketching in */}
                <svg
                  viewBox="0 0 220 130"
                  className="w-40 text-primary/70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden
                >
                  <rect x="84" y="8" width="52" height="26" pathLength={100} className="blueprint-path" />
                  <path d="M 110 34 L 110 56" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.2s" }} />
                  <path d="M 110 56 L 40 56 L 40 88" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.4s" }} />
                  <path d="M 110 56 L 180 56 L 180 88" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.4s" }} />
                  <rect x="14" y="88" width="52" height="26" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.65s" }} />
                  <rect x="154" y="88" width="52" height="26" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.65s" }} />
                </svg>
                <div className="text-center">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-foreground">
                    Generating figure…
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Writing TikZ / tabular from prompt
                  </p>
                </div>
              </div>
            )}
            {/* Status badge — bottom-left; compiling uses same slot as “Fits IEEE column” */}
            {!isGenerating && (
              <div className="absolute bottom-3 left-3 z-30 flex flex-wrap items-center gap-1.5">
                <span
                  key={status.label}
                  className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide duration-300 animate-in fade-in slide-in-from-bottom-1 ${
                    status.tone === "ok"
                      ? "border-emerald-600/45 bg-emerald-500/10 text-emerald-800"
                      : status.tone === "warn"
                        ? "border-amber-600/50 bg-amber-500/10 text-amber-900"
                        : "border-border bg-background/95 text-muted-foreground"
                  }`}
                >
                  {beat === "compile" ? (
                    <span className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-primary/25 border-t-primary" />
                  ) : status.tone === "ok" ? (
                    "✓ "
                  ) : status.tone === "warn" ? (
                    "⚠ "
                  ) : null}
                  {status.label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline — equal-height steps, no dead vertical space */}
        <div className="flex min-h-0 flex-col border-2 border-foreground bg-card lg:min-h-full">
          <div className="shrink-0 border-b border-border px-4 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Pipeline
            </p>
          </div>
          <ol className="grid min-h-0 flex-1 grid-rows-3 font-mono text-xs">
            {(
              [
                {
                  n: "01",
                  title: "Generate",
                  body: "TikZ / tabular from your prompt",
                  active: beat === "generate",
                  done: beat !== "generate",
                },
                {
                  n: "02",
                  title: "Compile",
                  body: "Remote build + auto-repair on error",
                  active: beat === "compile",
                  done: beat === "overflow" || beat === "fit",
                },
                {
                  n: "03",
                  title: "Fit check",
                  body: isColumn
                    ? beat === "overflow"
                      ? "Edges past 8.5 cm — flagged"
                      : beat === "fit"
                        ? "Scaled to column — verified"
                        : "Raster-check against paper width"
                    : beat === "fit"
                      ? "Full width — verified"
                      : "Raster-check against full text width",
                  active: beat === "overflow" || beat === "fit",
                  done: beat === "fit",
                },
              ] as const
            ).map((step) => (
              <li
                key={step.n}
                className={`flex items-center border-b border-border px-4 transition-colors duration-300 last:border-b-0 ${
                  step.active ? "bg-muted/60" : "bg-card"
                }`}
              >
                <div className="flex w-full items-start gap-3 py-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[9px] ${
                      step.done && !step.active
                        ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-800"
                        : step.active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {step.done && !step.active ? "✓" : step.n}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`font-heading text-sm font-semibold ${
                        step.active || step.done ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{step.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="shrink-0 border-t border-border px-4 py-2.5 font-mono text-[10px] leading-snug text-muted-foreground">
            Toggle Column to replay overflow → fit. Full page skips the squeeze.
          </p>
        </div>
      </div>
    </section>
  );
}
