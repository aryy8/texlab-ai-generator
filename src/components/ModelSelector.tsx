import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  GENERATION_MODELS,
  modelDisplayName,
  type GenerationModelId,
} from "@/lib/models";

interface ModelSelectorProps {
  value: GenerationModelId;
  onChange: (model: GenerationModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const auto = value === "auto";

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GENERATION_MODELS;
    return GENERATION_MODELS.filter(
      (model) =>
        model.label.toLowerCase().includes(q) || model.description.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="Model"
          className="ws-menu-trigger flex h-7 max-w-[9rem] items-center gap-0.5 rounded-md px-1.5 font-mono text-[11px] transition-colors disabled:opacity-40"
        >
          <span className="truncate">{modelDisplayName(value)}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        className="ws-menu w-56 rounded-[10px] p-0 shadow-lg"
      >
        <div className="border-b border-[var(--ws-input-border)] px-2.5 py-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models"
            className="w-full bg-transparent font-mono text-[11px] text-[var(--ws-text)] placeholder:text-[var(--ws-text-muted)] focus:outline-none"
          />
        </div>

        <div className={`px-2.5 py-2.5 ${auto ? "" : "border-b border-[var(--ws-input-border)]"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-[var(--ws-text)]">Auto</p>
              <p className="mt-0.5 text-[10px] leading-snug text-[var(--ws-text-muted)]">
                Balanced quality and speed, recommended for most tasks
              </p>
            </div>
            <Switch
              checked={auto}
              className="mt-0.5 scale-[0.72] data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-[var(--ws-input-border)]"
              onCheckedChange={(checked) => {
                onChange(checked ? "auto" : "openai/gpt-4o-mini");
              }}
              aria-label="Use automatic model selection"
            />
          </div>
        </div>

        {!auto && (
          <div className="max-h-44 overflow-y-auto py-1">
            {filteredModels.map((model) => {
              const active = value === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                  className={`ws-menu-item flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors ${
                    active ? "ws-menu-item-active" : ""
                  }`}
                >
                  <span className="min-w-0 truncate font-mono text-[11px]">{model.label}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
            {filteredModels.length === 0 && (
              <p className="px-2.5 py-2 font-mono text-[10px] text-[var(--ws-text-muted)]">
                No models found
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
