import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared light/dark control for landing mockups (light = default). */
export function MockThemeToggle({
  dark,
  onDarkChange,
  className,
}: {
  dark: boolean;
  onDarkChange: (dark: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch mockups to light mode" : "Switch mockups to dark mode"}
      onClick={() => onDarkChange(!dark)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full bg-foreground/[0.08] transition-colors hover:bg-foreground/[0.12]",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground shadow-sm transition-transform duration-200 ease-out",
          dark ? "translate-x-5" : "translate-x-0",
        )}
      >
        {dark ? (
          <Moon className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        ) : (
          <Sun className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        )}
      </span>
    </button>
  );
}
