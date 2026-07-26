import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FIGURE_TEMPLATES, type FigureTemplate } from "@/lib/templates";
import { cn } from "@/lib/utils";

type Filter = "all" | "diagram" | "table" | "plot" | "equation";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "diagram", label: "Diagrams" },
  { id: "table", label: "Tables" },
  { id: "plot", label: "Plots" },
  { id: "equation", label: "Equations" },
];

const PREVIEW_SHIFT_LEFT = new Set(["resnet-block", "encoder-decoder"]);

function TemplateCard({
  template,
  onSelect,
}: {
  template: FigureTemplate;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className="group flex flex-col border border-border bg-card text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/50 hover:shadow-md"
    >
      <div className="relative flex h-32 w-full items-center justify-center overflow-hidden border-b border-border bg-white sm:h-36">
        <img
          src={template.previewSrc}
          alt={`Preview of ${template.title}`}
          className={cn(
            "max-h-full max-w-full object-contain object-center p-2",
            PREVIEW_SHIFT_LEFT.has(template.id) && "-translate-x-3",
          )}
          decoding="async"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="font-heading text-sm font-semibold leading-tight group-hover:text-primary">
          {template.title}
        </span>
        <span className="line-clamp-2 font-heading text-[11px] leading-relaxed text-muted-foreground">
          {template.description}
        </span>
        <span className="mt-auto pt-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground/70">
          {template.outputType} · {template.documentFit}
        </span>
      </div>
    </button>
  );
}

interface TemplateCatalogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string) => void;
}

/** Full template grid — opened from navbar (and “Browse all” on the landing showcase). */
export function TemplateCatalog({ open, onOpenChange, onSelect }: TemplateCatalogProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const templates = useMemo(() => {
    if (filter === "all") return FIGURE_TEMPLATES;
    return FIGURE_TEMPLATES.filter((t) => t.outputType === filter);
  }, [filter]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88vh,820px)] w-[min(96vw,960px)] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-border p-0">
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-border px-5 py-3.5 pr-12 text-left">
          <div>
            <DialogTitle className="font-heading text-base font-semibold tracking-tight">
              Templates
            </DialogTitle>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              {templates.length} of {FIGURE_TEMPLATES.length} · click to load into the composer
            </p>
          </div>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-5 py-2.5">
          {FILTERS.map((option) => {
            const count =
              option.id === "all"
                ? FIGURE_TEMPLATES.length
                : FIGURE_TEMPLATES.filter((t) => t.outputType === option.id).length;
            if (option.id !== "all" && count === 0) return null;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={cn(
                  "shrink-0 border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  filter === option.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {option.label}
                <span className="ml-1.5 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} onSelect={handleSelect} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
