import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

/** B&W grain gradient — top dissolves into the checker page (no hard edge). */
export function LandingFooter() {
  return (
    <div className="relative mt-6 sm:mt-10">
      <div className="landing-gradient-footer relative h-[min(22rem,44vh)] sm:h-[min(26rem,42vh)]">
        <div className="landing-gradient-footer__fade absolute inset-0" aria-hidden />
        <div className="landing-gradient-footer__grain absolute inset-0" aria-hidden />

        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-end px-6 pb-12 text-center sm:pb-16">
          <p
            className="font-heading text-[clamp(3.5rem,14vw,7.5rem)] font-bold leading-[0.82] tracking-[-0.06em] text-foreground"
            aria-label="teXlab"
          >
            te<span className="font-mono">X</span>lab
          </p>

          <p className="mt-4 max-w-sm font-heading text-sm text-foreground/70">
            Figures that compile and fit — then leave for your paper.
          </p>

          <Link
            to="/app"
            className="group mt-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-foreground/80 transition-colors hover:text-foreground"
          >
            Open workspace
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
