import { Copy, Download, ExternalLink } from "lucide-react";

const ITEMS = [
  {
    title: "Copy paste-ready snippet",
    body: "Figure/table float sized for your column — drop into the paper.",
    icon: Copy,
  },
  {
    title: "Download .zip",
    body: "Standalone + snippet + preamble helpers in one project archive.",
    icon: Download,
  },
  {
    title: "Open in Overleaf",
    body: "Official snip API — opens a new project with your figure files.",
    icon: ExternalLink,
  },
];

export function ExportProof() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-20 pt-14 sm:pb-24">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Export
        </p>
        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Into your paper — not stuck in chat
        </h2>
        <p className="mt-2 max-w-xl font-heading text-sm text-muted-foreground">
          Overleaf opens a <span className="text-foreground">new</span> project from teXlab (snip). Copy or zip if you already have a paper open.
        </p>
      </div>

      <div className="grid gap-px border-2 border-foreground bg-border sm:grid-cols-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex gap-3 bg-card p-5 transition-colors hover:bg-muted/30"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <h3 className="font-heading text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
