import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const auto = value === "auto";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="chip"
          size="sm"
          disabled={disabled}
          className="h-8 max-w-[7.5rem] gap-1 rounded-none px-2 font-mono text-[11px] sm:max-w-[8.5rem]"
        >
          <span className="truncate">{modelDisplayName(value)}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 rounded-none p-1.5">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="font-mono text-[11px] font-medium">Auto</span>
          <Switch
            checked={auto}
            className="scale-75"
            onCheckedChange={(checked) => {
              onChange(checked ? "auto" : "openai/gpt-4o-mini");
            }}
            aria-label="Use automatic model selection"
          />
        </div>

        <div className="my-0.5 border-t border-border" />

        <div className="max-h-40 overflow-y-auto">
          {GENERATION_MODELS.map((model) => {
            const active = !auto && value === model.id;
            return (
              <button
                key={model.id}
                type="button"
                disabled={auto}
                onClick={() => {
                  onChange(model.id);
                  setOpen(false);
                }}
                className={`w-full truncate rounded-sm px-2 py-1.5 text-left font-mono text-[11px] transition-colors ${
                  auto
                    ? "cursor-not-allowed opacity-35"
                    : active
                      ? "bg-foreground text-background"
                      : "hover:bg-muted"
                }`}
              >
                {model.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
