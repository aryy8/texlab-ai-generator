import { useState } from "react";
import { generateLaTeX } from "@/lib/openrouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, Check, ArrowRight, Sparkles } from "lucide-react";

const EXAMPLES = [
  "A flowchart showing the compilation process of a LaTeX document",
  "A 3x4 table comparing programming languages by paradigm, typing, and speed",
  "A Venn diagram of frontend, backend, and fullstack skills",
  "A tree diagram of sorting algorithms",
];

const LatexLogo = () => (
  <span className="latex-logo">
    L<span className="a">A</span>T<span className="e">E</span>X
  </span>
);

const Index = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setIsGenerating(true);
    try {
      const latex = await generateLaTeX(input);
      setOutput(latex);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate LaTeX. Please check your API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen checker-bg">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-heading text-xl font-bold tracking-tighter">
              te<span className="font-mono">X</span>lab
            </span>
            <span className="text-[10px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 uppercase tracking-widest">
              beta
            </span>
          </div>
          <a
            href="https://www.latex-project.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            LaTeX docs ↗
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        <div className="max-w-2xl">
          <h1 className="font-heading text-5xl sm:text-6xl font-bold tracking-tighter leading-[0.9] mb-4">
            Natural language
            <br />
            to <LatexLogo />
          </h1>
          <p className="text-muted-foreground font-heading text-lg max-w-md">
            Describe your diagram or table in plain English. Get production-ready LaTeX code instantly.
          </p>
        </div>
      </section>

      {/* Input */}
      <section className="max-w-5xl mx-auto px-6 pb-6">
        <div className="bg-card border-2 border-foreground">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Describe
            </span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. A flowchart showing user authentication flow with login, verification, and dashboard steps..."
            className="w-full bg-transparent px-4 py-4 text-foreground font-heading text-base placeholder:text-muted-foreground/60 focus:outline-none resize-none min-h-[120px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
            }}
          />
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs font-mono text-muted-foreground">
              ⌘ + Enter to generate
            </span>
            <Button
              onClick={handleGenerate}
              disabled={!input.trim() || isGenerating}
              variant="default"
              size="sm"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="animate-pulse">Generating</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  Generate <ArrowRight className="w-3.5 h-3.5" />
                </span>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Examples */}
      <section className="max-w-5xl mx-auto px-6 pb-8">
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <Button
              key={ex}
              variant="chip"
              size="sm"
              onClick={() => setInput(ex)}
            >
              {ex.length > 50 ? ex.slice(0, 50) + "…" : ex}
            </Button>
          ))}
        </div>
      </section>

      {/* Output */}
      {output && (
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="bg-card border-2 border-foreground">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Output — <LatexLogo />
              </span>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    <Check className="w-3.5 h-3.5" /> Copied
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </span>
                )}
              </Button>
            </div>
            <pre className="px-4 py-4 overflow-x-auto">
              <code className="font-mono text-sm text-foreground leading-relaxed">
                {output}
              </code>
            </pre>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            teXlab © 2026
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            NLP → <LatexLogo />
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
