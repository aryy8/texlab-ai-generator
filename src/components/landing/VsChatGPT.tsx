/**
 * Comparison section — paired rows so both columns stay even.
 */
export function VsChatGPT() {
  const rows = [
    {
      chatgpt: "Often won’t compile on first try",
      texlab: "Compile + auto-repair loop",
    },
    {
      chatgpt: "Overflows the paper column",
      texlab: "Fit validation for ~8.5 cm / full width",
    },
    {
      chatgpt: "No live preview of the LaTeX it wrote",
      texlab: "Compiled PDF preview next to the code",
    },
    {
      chatgpt: "A dump of code to paste somehow",
      texlab: "Paste snippet · zip · Open Overleaf",
    },
  ];

  const footer = {
    chatgpt: "! Undefined control sequence. Emergency stop.",
    texlab: "✓ Compiled · fits column · preview ready",
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Why teXlab
        </p>
        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Not just another ChatGPT TikZ dump
        </h2>
      </div>

      <div className="border-2 border-foreground bg-card">
        {/* Header */}
        <div className="grid border-b border-border bg-muted/40 sm:grid-cols-2">
          <div className="border-b border-border px-4 py-2 sm:border-b-0 sm:border-r">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Raw ChatGPT TikZ
            </span>
          </div>
          <div className="px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-foreground">
              teXlab
            </span>
          </div>
        </div>

        {/* Paired comparison rows — same min-height on both cells */}
        {rows.map((row) => (
          <div key={row.chatgpt} className="grid border-b border-border sm:grid-cols-2">
            <div className="flex min-h-[44px] items-center border-b border-border px-4 py-3 font-mono text-xs text-muted-foreground sm:border-b-0 sm:border-r">
              <span>
                <span className="mr-2 text-destructive/80">×</span>
                {row.chatgpt}
              </span>
            </div>
            <div className="flex min-h-[44px] items-center px-4 py-3 font-mono text-xs text-foreground">
              <span>
                <span className="mr-2 text-emerald-700">✓</span>
                {row.texlab}
              </span>
            </div>
          </div>
        ))}

        {/* Footer row — matched height, single line each */}
        <div className="grid sm:grid-cols-2">
          <div className="flex min-h-[44px] items-center border-b border-border bg-muted/20 px-4 py-3 font-mono text-[10px] leading-snug text-muted-foreground sm:border-b-0 sm:border-r">
            {footer.chatgpt}
          </div>
          <div className="flex min-h-[44px] items-center bg-emerald-500/10 px-4 py-3 font-mono text-[10px] leading-snug text-emerald-900">
            {footer.texlab}
          </div>
        </div>
      </div>
    </section>
  );
}
