import { ArrowUp, CheckCircle2, FileOutput } from "lucide-react";

const STEPS = [
  {
    n: "01",
    title: "Describe",
    body: "Prompt a diagram, table, or plot — or start from a template.",
    icon: ArrowUp,
  },
  {
    n: "02",
    title: "Compile & auto-fit",
    body: "We compile, repair errors, and check the figure against your paper width.",
    icon: CheckCircle2,
  },
  {
    n: "03",
    title: "Export",
    body: "Copy a paste-ready snippet, download a zip, or open a new Overleaf project.",
    icon: FileOutput,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-14">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          How it works
        </p>
        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Three steps. No TikZ wrestling.
        </h2>
      </div>

      <div className="grid gap-px border-2 border-foreground bg-border sm:grid-cols-3">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.n}
              className="bg-card p-5 transition-colors hover:bg-muted/30"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {step.n}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <h3 className="font-heading text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 font-heading text-sm text-muted-foreground">{step.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
