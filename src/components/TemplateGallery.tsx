import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { FIGURE_TEMPLATES, type FigureTemplate } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * Fixed slots on a 4×3 board. Focus expands that cell's tracks in place;
 * neighbors shrink so the grid stays flush — no reordering, no float.
 */
const SLOTS: Array<{
  id: string;
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}> = [
  { id: "inference-serving", colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 3 },
  { id: "resnet-block", colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2 },
  { id: "training-loss", colStart: 4, colEnd: 5, rowStart: 1, rowEnd: 2 },
  { id: "model-comparison", colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3 },
  { id: "flowchart-decision", colStart: 4, colEnd: 5, rowStart: 2, rowEnd: 3 },
  { id: "encoder-decoder", colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
  { id: "neural-network", colStart: 2, colEnd: 3, rowStart: 3, rowEnd: 4 },
  { id: "training-pipeline", colStart: 3, colEnd: 5, rowStart: 3, rowEnd: 4 },
];

const COLS = 4;
const ROWS = 3;
const GROW = 1.5;
const SHRINK = 0.8;

function resolveSlots() {
  return SLOTS.map((slot) => {
    const template = FIGURE_TEMPLATES.find((t) => t.id === slot.id);
    if (!template) return null;
    return { ...slot, template };
  }).filter((x): x is (typeof SLOTS)[number] & { template: FigureTemplate } => Boolean(x));
}

function tracksForFocus(
  count: number,
  spanStart: number,
  spanEnd: number,
  reduced: boolean,
): string {
  if (reduced) {
    return Array.from({ length: count }, () => "minmax(0,1fr)").join(" ");
  }
  // spanStart/spanEnd are 1-based grid lines; tracks are [start, end)
  return Array.from({ length: count }, (_, i) => {
    const trackIndex = i + 1;
    const hot = trackIndex >= spanStart && trackIndex < spanEnd;
    return hot ? `minmax(0,${GROW}fr)` : `minmax(0,${SHRINK}fr)`;
  }).join(" ");
}

interface TemplateGalleryProps {
  onSelect: (templateId: string) => void;
  onBrowseAll?: () => void;
}

function Cell({
  template,
  title,
  outputType,
  isFocus,
  onSelect,
  onFocus,
  className,
  style,
}: {
  template: FigureTemplate;
  title: string;
  outputType: string;
  isFocus: boolean;
  onSelect: () => void;
  onFocus: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onFocus}
      className={cn(
        "group relative overflow-hidden border bg-white text-left",
        "transition-[border-color,box-shadow] duration-500 ease-out",
        isFocus ? "z-[1] border-foreground shadow-sm" : "border-border hover:border-foreground/45",
        className,
      )}
      style={style}
    >
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <img
          src={template.previewSrc}
          alt=""
          className={cn(
            "max-h-full max-w-full object-contain transition-transform duration-500 ease-out",
            isFocus ? "scale-100" : "scale-[0.96]",
          )}
          decoding="async"
          loading="lazy"
          draggable={false}
        />
      </div>
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent px-3 pb-2.5 pt-10 transition-opacity duration-400",
          isFocus ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <p className="truncate font-heading text-sm font-semibold tracking-tight">{title}</p>
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {outputType}
        </p>
      </div>
    </button>
  );
}

export function TemplateGallery({ onSelect, onBrowseAll }: TemplateGalleryProps) {
  const slots = useMemo(() => resolveSlots(), []);
  const [focus, setFocus] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced || slots.length < 2) return;
    const id = window.setInterval(() => {
      setFocus((i) => (i + 1) % slots.length);
    }, 3400);
    return () => window.clearInterval(id);
  }, [reduced, slots.length]);

  const active = slots[focus];

  const gridStyle = useMemo(() => {
    if (!active) return undefined;
    return {
      gridTemplateColumns: tracksForFocus(COLS, active.colStart, active.colEnd, reduced),
      gridTemplateRows: tracksForFocus(ROWS, active.rowStart, active.rowEnd, reduced),
      transition: reduced
        ? undefined
        : "grid-template-columns 600ms cubic-bezier(0.22, 1, 0.36, 1), grid-template-rows 600ms cubic-bezier(0.22, 1, 0.36, 1)",
    } as const;
  }, [active, reduced]);

  return (
    <section className="mx-auto max-w-5xl px-6 pb-10 pt-2">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Templates
          </p>
          <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Figures, arranged.
          </h2>
        </div>
        {onBrowseAll && (
          <button
            type="button"
            onClick={onBrowseAll}
            className="border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            Browse all {FIGURE_TEMPLATES.length}
          </button>
        )}
      </div>

      {/* Mobile stack */}
      <div className="flex flex-col gap-3 md:hidden">
        {slots.map((slot, i) => (
          <Cell
            key={slot.id}
            template={slot.template}
            title={slot.template.title}
            outputType={slot.template.outputType}
            isFocus={i === focus}
            onSelect={() => onSelect(slot.id)}
            onFocus={() => setFocus(i)}
            className="min-h-[180px]"
          />
        ))}
      </div>

      {/* Desktop bento — fixed positions, expanding tracks */}
      <div
        className="hidden h-[min(70vh,540px)] gap-3 md:grid"
        style={gridStyle}
      >
        {slots.map((slot, i) => (
          <Cell
            key={slot.id}
            template={slot.template}
            title={slot.template.title}
            outputType={slot.template.outputType}
            isFocus={i === focus}
            onSelect={() => onSelect(slot.id)}
            onFocus={() => setFocus(i)}
            style={{
              gridColumn: `${slot.colStart} / ${slot.colEnd}`,
              gridRow: `${slot.rowStart} / ${slot.rowEnd}`,
            }}
          />
        ))}
      </div>
    </section>
  );
}
