import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, Check, ArrowRight, Sparkles, FileText, Download, Code, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { generatePaperLaTeX } from "@/lib/openrouter";

const FORMATS = [
    { id: "ieee", name: "IEEE Conference" },
    { id: "acm", name: "ACM Standard" },
    { id: "article", name: "Standard Academic Article" },
    { id: "report", name: "Technical Report" },
];

const LatexLogo = () => (
    <span className="latex-logo">
        L<span className="a">A</span>T<span className="e">E</span>X
    </span>
);

const Workspace = () => {
    const [input, setInput] = useState("");
    const [output, setOutput] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(FORMATS[0].id);
    const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

    const handleGenerate = async () => {
        if (!input.trim()) return;
        setIsGenerating(true);
        setIsPreviewLoading(true);
        try {
            const rawLatex = await generatePaperLaTeX(input, selectedFormat);
            // Clean up markdown code blocks to ensure it starts with \documentclass
            const cleanedLatex = rawLatex.replace(/```latex\n?/gi, '').replace(/```\n?/g, '').trim();
            setOutput(cleanedLatex);
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate LaTeX paper. Please check your API key.");
            setIsGenerating(false);
            setIsPreviewLoading(false);
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
        const encoded = encodeURIComponent(latex);
        return `https://latexonline.cc/compile?text=${encoded}`;
    };

    return (
        <div className="h-screen flex flex-col checker-bg overflow-hidden">
            {/* Nav */}
            <nav className="border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
                <div className="mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="font-heading text-xl font-bold tracking-tighter hover:opacity-80 transition-opacity">
                            te<span className="font-mono">X</span>lab
                        </Link>
                        <div className="h-4 w-px bg-border hidden sm:block"></div>
                        <span className="text-sm font-mono text-muted-foreground hidden sm:flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Workspace
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {output && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const blob = new Blob([output], { type: "text/plain" });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = "paper.tex";
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                            >
                                <Download className="w-4 h-4 mr-2" /> Download .tex
                            </Button>
                        )}
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

            {/* Main Workspace Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Pane - Input */}
                <div className="w-1/2 flex flex-col border-r border-border bg-card">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                                Document Content
                            </span>
                        </div>
                        <select
                            value={selectedFormat}
                            onChange={(e) => setSelectedFormat(e.target.value)}
                            className="bg-transparent border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            {FORMATS.map((f) => (
                                <option key={f.id} value={f.id}>
                                    Format: {f.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 p-4 flex flex-col min-h-0">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Paste your raw text or rough draft here (e.g. Title, Abstract, Introduction, Methods, ...)"
                            className="flex-1 w-full bg-transparent text-foreground font-sans text-sm placeholder:text-muted-foreground/60 focus:outline-none resize-none leading-relaxed"
                        />
                    </div>
                    <div className="px-4 py-3 border-t border-border bg-muted/20 flex justify-between items-center">
                        <span className="text-xs font-mono text-muted-foreground">
                            {input.length} characters
                        </span>
                        <Button
                            onClick={handleGenerate}
                            disabled={!input.trim() || isGenerating}
                            className="shadow-sm"
                        >
                            {isGenerating ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-pulse">Formatting Paper...</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4" /> Convert to <LatexLogo />
                                </span>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Right Pane - Output & Preview */}
                <div className="w-1/2 flex flex-col bg-card">
                    <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
                                Result <LatexLogo />
                            </span>
                            {output && (
                                <div className="flex bg-muted p-1 rounded-md">
                                    <button
                                        onClick={() => setViewMode('preview')}
                                        className={`px-3 py-1 text-xs font-mono rounded-sm flex items-center gap-1.5 transition-colors ${viewMode === 'preview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        <Eye className="w-3.5 h-3.5" /> Preview
                                    </button>
                                    <button
                                        onClick={() => setViewMode('code')}
                                        className={`px-3 py-1 text-xs font-mono rounded-sm flex items-center gap-1.5 transition-colors ${viewMode === 'code' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        <Code className="w-3.5 h-3.5" /> Code
                                    </button>
                                </div>
                            )}
                        </div>
                        {output && (
                            <Button variant="ghost" size="sm" onClick={handleCopy}>
                                {copied ? (
                                    <span className="flex items-center gap-1.5 text-xs text-primary">
                                        <Check className="w-3.5 h-3.5" /> Copied Code
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-xs">
                                        <Copy className="w-3.5 h-3.5" /> Copy Code
                                    </span>
                                )}
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 bg-white relative overflow-hidden flex flex-col">
                        {!output && !isGenerating && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50 z-10 px-8 text-center bg-muted/10">
                                <FileText className="w-12 h-12 mb-4 opacity-50" />
                                <p className="font-heading text-lg font-medium text-foreground/70">No Document Generated Yet</p>
                                <p className="font-mono text-sm max-w-sm mt-2">Paste your text on the left, select a format, and click "Convert to LaTeX" to see the full compiled paper here.</p>
                            </div>
                        )}

                        {isGenerating && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground font-mono text-sm gap-3 z-20 bg-white/95 backdrop-blur-sm">
                                <Sparkles className="w-6 h-6 animate-pulse text-primary" />
                                <span className="animate-pulse tracking-widest uppercase text-xs font-semibold">Structuring LaTeX Document...</span>
                            </div>
                        )}

                        {isPreviewLoading && !isGenerating && output && viewMode === 'preview' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground font-mono text-sm gap-4 z-20 bg-white/95 backdrop-blur-sm">
                                <div className="flex items-center justify-center">
                                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                </div>
                                <span className="animate-pulse tracking-widest uppercase text-xs font-semibold text-primary">Compiling PDF Engine...</span>
                                <span className="text-[10px] opacity-70 mb-2">This might take a moment for large documents</span>

                                <div className="mt-4 p-4 border border-orange-200 bg-orange-50 rounded-md max-w-sm text-center">
                                    <p className="text-xs text-orange-800 font-sans">
                                        <strong>Having trouble previewing?</strong><br />
                                        Very large documents might fail to compile in this live preview. Switch to the <strong>Code</strong> tab to download or copy the raw .tex file.
                                    </p>
                                </div>
                            </div>
                        )}

                        {output && viewMode === 'preview' && (
                            <div className="flex-1 relative">
                                <iframe
                                    src={getPreviewUrl(output)}
                                    className={`absolute inset-0 w-full h-full border-0 transition-opacity duration-500 ${(isGenerating || isPreviewLoading) ? 'opacity-0' : 'opacity-100'}`}
                                    title="LaTeX Preview"
                                    onLoad={() => setIsPreviewLoading(false)}
                                    onError={() => setIsPreviewLoading(false)}
                                />
                            </div>
                        )}

                        {output && viewMode === 'code' && (
                            <div className="flex-1 relative bg-[#0d1117] overflow-auto p-4 custom-scrollbar">
                                <pre className="font-mono text-sm text-[#e6edf3] leading-relaxed">
                                    <code>{output}</code>
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Workspace;
