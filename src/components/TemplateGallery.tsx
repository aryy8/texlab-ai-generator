import { FIGURE_TEMPLATES, type FigureTemplate } from "@/lib/templates";
import { cn } from "@/lib/utils";

/** Previews whose TikZ ink sits heavy on the right — nudge the img left in the card. */
const PREVIEW_SHIFT_LEFT = new Set(["resnet-block", "encoder-decoder"]);

function TemplatePreview({ template }: { template: FigureTemplate }) {
  return (
    <img
      src={template.previewSrc}
      alt={`Preview of ${template.title}`}
      className={cn(
        // max-* keeps the bitmap sized to content so flex centering on the parent works
        "max-h-full max-w-full object-contain object-center p-2",
        PREVIEW_SHIFT_LEFT.has(template.id) && "-translate-x-3 sm:-translate-x-4",
        template.id === "training-pipeline" && "mx-auto translate-x-0",
      )}
      decoding="async"
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget;
        img.style.display = "none";
        const fallback = img.nextElementSibling;
        if (fallback instanceof HTMLElement) fallback.style.display = "flex";
      }}
    />
  );
}

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
      <div className="relative flex h-36 w-full items-center justify-center overflow-hidden border-b border-border bg-white">
        <TemplatePreview template={template} />
        <div
          className="absolute inset-0 hidden items-center justify-center bg-muted/30 font-mono text-[10px] text-muted-foreground"
          aria-hidden
        >
          Preview loading…
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 text-left">
        <span className="font-heading text-sm font-semibold leading-tight group-hover:text-primary">
          {template.title}
        </span>
        <span className="line-clamp-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {template.prompt}
        </span>
        <span className="mt-auto font-mono text-[9px] uppercase tracking-wide text-muted-foreground/70">
          {template.outputType} · {template.documentFit}
        </span>
      </div>
    </button>
  );
}

interface TemplateGalleryProps {
  onSelect: (templateId: string) => void;
}

export function TemplateGallery({ onSelect }: TemplateGalleryProps) {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-8 pt-2">
      <div className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Try a template
        </p>
        <p className="mt-1 font-heading text-sm text-muted-foreground">
          Each card shows a real output from that template&apos;s prompt — what you get when you click Generate.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FIGURE_TEMPLATES.map((template) => (
          <TemplateCard key={template.id} template={template} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
