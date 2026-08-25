import { cn } from "@/lib/utils";

type BlueprintBusyProps = {
  message: string;
  className?: string;
};

/**
 * Animated hierarchy wireframe shown in the code panel while generating.
 */
export function BlueprintBusy({ message, className }: BlueprintBusyProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center gap-5 bg-[var(--ws-bg)] px-6 text-center",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <svg
        viewBox="0 0 220 130"
        className="w-44 text-[var(--ws-text-muted)] opacity-80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <rect x="84" y="8" width="52" height="26" pathLength={100} className="blueprint-path" />
        <path d="M 110 34 L 110 56" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.25s" }} />
        <path
          d="M 110 56 L 40 56 L 40 88"
          pathLength={100}
          className="blueprint-path"
          style={{ animationDelay: "0.45s" }}
        />
        <path
          d="M 110 56 L 180 56 L 180 88"
          pathLength={100}
          className="blueprint-path"
          style={{ animationDelay: "0.45s" }}
        />
        <rect
          x="14"
          y="88"
          width="52"
          height="26"
          pathLength={100}
          className="blueprint-path"
          style={{ animationDelay: "0.75s" }}
        />
        <rect
          x="154"
          y="88"
          width="52"
          height="26"
          pathLength={100}
          className="blueprint-path"
          style={{ animationDelay: "0.75s" }}
        />
      </svg>
      <span className="text-shimmer max-w-[16rem] font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ws-text-muted)]">
        {message}
      </span>
    </div>
  );
}
