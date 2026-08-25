import { cn } from "@/lib/utils";

const COLS = 28;
const ROWS = 18;

type SketchingPreviewProps = {
  label?: string;
  /** Fill the entire preview pane instead of a floating card. */
  fill?: boolean;
  className?: string;
};

/**
 * ChatGPT-style dotted "sketching" placeholder for preview loading states.
 */
export function SketchingPreview({
  label = "Compiling",
  fill = false,
  className,
}: SketchingPreviewProps) {
  const dots = COLS * ROWS;

  return (
    <div
      className={cn("sketching-preview", fill && "sketching-preview--fill", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <p className="sketching-preview__label text-shimmer">{label}</p>
      <div
        className="sketching-preview__grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
        aria-hidden
      >
        {Array.from({ length: dots }, (_, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const delay = col * 38 + row * 24;
          return (
            <span
              key={i}
              className="sketching-preview__dot"
              style={{ animationDelay: `${delay}ms` }}
            />
          );
        })}
      </div>
    </div>
  );
}
