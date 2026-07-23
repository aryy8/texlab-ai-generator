import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type {
  ArrowStyle,
  AspectRatio,
  ColorMode,
  Density,
  DocumentFit,
  OutputType,
} from "@/lib/openrouter";

const COLOR_OPTIONS: Array<{
  value: ColorMode;
  label: string;
  swatches: string[];
}> = [
  { value: "monochrome", label: "Mono", swatches: ["#111827", "#6b7280", "#d1d5db"] },
  { value: "academic", label: "Academic", swatches: ["#1e3a5f", "#64748b", "#b45309"] },
  { value: "pastel", label: "Pastel", swatches: ["#93c5fd", "#a7f3d0", "#fbcfe8"] },
  { value: "vivid", label: "Vivid", swatches: ["#2563eb", "#dc2626", "#16a34a"] },
];

const DENSITY_OPTIONS: Array<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
];

const ASPECT_RATIO_OPTIONS: Array<{ value: AspectRatio; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "square", label: "Square" },
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
  { value: "wide", label: "Wide" },
];

const ARROW_STYLE_OPTIONS: Array<{ value: ArrowStyle; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "stealth", label: "Stealth" },
  { value: "dashed", label: "Dashed" },
  { value: "numbered", label: "Numbered" },
];

const DOCUMENT_FIT_OPTIONS: Array<{ value: DocumentFit; label: string }> = [
  { value: "column", label: "Column" },
  { value: "fullpage", label: "Full" },
  { value: "snippet", label: "Paste" },
  { value: "standalone", label: "Standalone" },
];

function CompactPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`ws-pill rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors ${
            value === option.value ? "ws-pill-active" : ""
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--ws-text-muted)]">
        {label}
      </p>
      {children}
    </div>
  );
}

export interface FormatSelectorProps {
  outputType: OutputType;
  styleOptions: Array<{ value: string; label: string }>;
  style: string;
  colorMode: ColorMode;
  density: Density;
  documentFit: DocumentFit;
  arrowStyle: ArrowStyle;
  aspectRatio: AspectRatio;
  onStyleChange: (value: string) => void;
  onColorChange: (value: ColorMode) => void;
  onDensityChange: (value: Density) => void;
  onDocumentFitChange: (value: DocumentFit) => void;
  onArrowStyleChange: (value: ArrowStyle) => void;
  onAspectRatioChange: (value: AspectRatio) => void;
  disabled?: boolean;
}

export function FormatSelector({
  outputType,
  styleOptions,
  style,
  colorMode,
  density,
  documentFit,
  arrowStyle,
  aspectRatio,
  onStyleChange,
  onColorChange,
  onDensityChange,
  onDocumentFitChange,
  onArrowStyleChange,
  onAspectRatioChange,
  disabled,
}: FormatSelectorProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"look" | "output">("look");
  const showArrows = outputType === "diagram" || outputType === "plot";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="Figure format"
          className="ws-menu-trigger flex h-7 items-center gap-0.5 rounded-md px-1.5 font-mono text-[11px] transition-colors disabled:opacity-40"
        >
          <span>Format</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="ws-menu w-64 rounded-[10px] p-0 shadow-lg"
      >
        <div className="flex border-b border-[var(--ws-input-border)]">
          {(["look", "output"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 py-2 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                tab === key
                  ? "border-b border-[var(--ws-text)] text-[var(--ws-text)]"
                  : "text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]"
              }`}
            >
              {key === "look" ? "Look" : "Output"}
            </button>
          ))}
        </div>

        <div className="max-h-[min(280px,45vh)] overflow-y-auto p-2.5">
          {tab === "look" ? (
            <div className="space-y-3">
              <Section label="Style">
                <CompactPills options={styleOptions} value={style} onChange={onStyleChange} />
              </Section>
              <Section label="Color">
                <div className="grid grid-cols-2 gap-1">
                  {COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onColorChange(option.value)}
                      className={`flex items-center justify-between rounded-md border px-2 py-1 font-mono text-[10px] transition-colors ${
                        colorMode === option.value
                          ? "border-[var(--ws-text)] bg-[var(--ws-bar)] text-[var(--ws-text)]"
                          : "border-[var(--ws-input-border)] text-[var(--ws-text-muted)] hover:border-[var(--ws-input-border-focus)] hover:text-[var(--ws-text)]"
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className="flex gap-0.5" aria-hidden>
                        {option.swatches.map((swatch) => (
                          <span
                            key={swatch}
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
            </div>
          ) : (
            <div className="space-y-3">
              <Section label="Detail">
                <CompactPills options={DENSITY_OPTIONS} value={density} onChange={onDensityChange} />
              </Section>
              <Section label="Paper fit">
                <CompactPills
                  options={DOCUMENT_FIT_OPTIONS}
                  value={documentFit}
                  onChange={onDocumentFitChange}
                />
              </Section>
              {showArrows && (
                <Section label="Arrows">
                  <CompactPills
                    options={ARROW_STYLE_OPTIONS}
                    value={arrowStyle}
                    onChange={onArrowStyleChange}
                  />
                </Section>
              )}
              <Section label="Canvas">
                <CompactPills
                  options={ASPECT_RATIO_OPTIONS}
                  value={aspectRatio}
                  onChange={onAspectRatioChange}
                />
              </Section>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
