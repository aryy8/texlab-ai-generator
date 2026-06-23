import { useState, useEffect } from "react";
import { generateLaTeX } from "@/lib/openrouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Copy, Check, ArrowRight, Sparkles, FileText } from "lucide-react";

const PLACEHOLDER_PROMPTS = [
  "A complex neural network architecture flowchart using TikZ...",
  "An IEEE conference 2-column table comparing machine learning models...",
  "A high-quality academic graph showing training loss over 100 epochs...",
  "A flowchart showing the compilation process of a LaTeX document...",
  "An NLP pipeline for text classification using bagofwords and SVM...",
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
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [placeholderText, setPlaceholderText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const currentPrompt = PLACEHOLDER_PROMPTS[promptIndex];

    if (isDeleting) {
      if (placeholderText.length > 0) {
        timeout = setTimeout(() => {
          setPlaceholderText(currentPrompt.substring(0, placeholderText.length - 1));
        }, 25);
      } else {
        setIsDeleting(false);
        setPromptIndex((prev) => (prev + 1) % PLACEHOLDER_PROMPTS.length);
      }
    } else {
      if (placeholderText.length < currentPrompt.length) {
        timeout = setTimeout(() => {
          setPlaceholderText(currentPrompt.substring(0, placeholderText.length + 1));
        }, 50);
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2500);
      }
    }

    return () => clearTimeout(timeout);
  }, [placeholderText, isDeleting, promptIndex]);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setIsGenerating(true);
    setIsPreviewLoading(true);
    try {
      const latex = await generateLaTeX(input);
      setOutput(latex);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to generate LaTeX.";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPreviewUrl = (latex: string) => {
    // 1. Remove markdown code blocks if present
    let cleanedLatex = latex.replace(/```latex\n?/gi, '').replace(/```\n?/g, '').trim();

    // 2. Extract preamble-only commands the LLM might generate
    const preambleRegex = /\\(usepackage|usetikzlibrary|pgfplotsset).*?(?:\{[^}]+\}|\[[^\]]+\])+/gi;
    const preambleMatches = cleanedLatex.match(preambleRegex) || [];
    const preamble = preambleMatches.join('\n');
    let body = cleanedLatex.replace(preambleRegex, '').trim();

    // 3. Remove document wrappers more robustly
    body = body.replace(/\\documentclass[\s\S]*?\{[\s\S]*?\}/gi, '');
    body = body.replace(/\\begin\s*\{document\}/gi, '');
    body = body.replace(/\\end\s*\{document\}/gi, '');
    body = body.trim();

    const fullDoc = `\\documentclass[border=10pt,varwidth]{standalone}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{amsmath,amssymb}
\\usepackage{array}
\\usepackage{booktabs}
\\usepackage{multirow}
\\usepackage{xcolor}
\\usetikzlibrary{arrows.meta, positioning, shapes.geometric, fit, backgrounds, calc}
\\pgfplotsset{compat=1.14}
${preamble}
\\begin{document}
${body}
\\end{document}`;

    return `https://latexonline.cc/compile?text=${encodeURIComponent(fullDoc)}`;
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
          <div className="flex items-center gap-4">
            <Link to="/workspace">
              <Button variant="outline" size="sm" className="font-mono text-xs hidden sm:flex border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors">
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Full Paper Workspace
              </Button>
            </Link>
            <a
              href="https://www.latex-project.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              LaTeX docs ↗
            </a>
          </div>
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
            placeholder={`e.g. ${placeholderText}|`}
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

      {/* Secondary Features */}
      <section className="max-w-5xl mx-auto px-6 pb-8">

        {/* Minimal Workspace Link */}
        <Link to="/workspace" className="block w-full mt-2">
          <div className="bg-muted/30 border border-border hover:border-primary/50 transition-colors rounded-lg p-4 flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="bg-background p-2 rounded-md shadow-sm border border-border group-hover:border-primary/30 transition-colors">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-heading font-semibold text-sm">Need to format a full research paper?</p>
                <p className="text-muted-foreground text-xs font-sans mt-0.5">Convert MS Word or notes into IEEE/ACM formats in the Full Paper Workspace.</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all transform group-hover:translate-x-1" />
          </div>
        </Link>
      </section>

      {/* Output */}
      {output && (
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Code Panel */}
            <div className="bg-card border-2 border-foreground flex flex-col h-[600px]">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Code — <LatexLogo />
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
              <pre className="px-4 py-4 overflow-auto flex-1">
                <code className="font-mono text-sm text-foreground leading-relaxed">
                  {output}
                </code>
              </pre>
            </div>

            {/* Preview Panel */}
            <div className="bg-card border-2 border-foreground flex flex-col h-[600px]">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Preview
                </span>
              </div>
              <div className="flex-1 bg-white overflow-hidden flex items-center justify-center p-2 relative">
                {isGenerating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground font-mono text-sm gap-3 z-10 bg-white">
                    <Sparkles className="w-5 h-5 animate-pulse text-primary" />
                    <span className="animate-pulse tracking-widest uppercase text-xs font-semibold">Generating Code...</span>
                  </div>
                )}

                {isPreviewLoading && !isGenerating && output && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground font-mono text-sm gap-4 z-10 bg-white">
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    </div>
                    <span className="animate-pulse tracking-widest uppercase text-xs font-semibold">Compiling Diagram...</span>
                  </div>
                )}

                {output && (
                  <iframe
                    src={getPreviewUrl(output)}
                    className={`w-full h-full border-0 transition-opacity duration-300 ${(isGenerating || isPreviewLoading) ? 'opacity-0' : 'opacity-100'}`}
                    title="LaTeX Preview"
                    onLoad={() => setIsPreviewLoading(false)}
                  />
                )}
              </div>
            </div>
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
