import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  generateLaTeX,
  refineLaTeX,
  repairLaTeX,
  type AspectRatio,
  type ArrowStyle,
  type ColorMode,
  type Density,
  type DocumentFit,
  type OutputType,
  type Reference,
} from "@/lib/openrouter";
import { compileLatex, type CompileResult } from "@/lib/latex-compiler";
import { detectFromPrompt } from "@/lib/detect";
import { pdfUrlToPngDataUrl } from "@/lib/pdf-preview";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LatexCode } from "@/components/LatexCode";
import { Link } from "react-router-dom";
import {
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  FileText,
  Wand2,
  History,
  SlidersHorizontal,
  Paperclip,
  X,
  ChevronDown,
  Maximize2,
  Workflow,
  Table as TableIcon,
  Sigma,
  LineChart,
  GitBranch,
  Loader2,
  CircleX,
  TriangleAlert,
} from "lucide-react";

interface LatexVersion {
  latex: string;
  label: string;
}

const MAX_REFERENCES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 20_000;

const PLACEHOLDER_PROMPTS = [
  "A complex neural network architecture flowchart using TikZ...",
  "An IEEE conference 2-column table comparing machine learning models...",
  "A high-quality academic graph showing training loss over 100 epochs...",
  "A flowchart showing the compilation process of a LaTeX document...",
  "An NLP pipeline for text classification using bagofwords and SVM...",
];

const OUTPUT_TYPE_OPTIONS: Array<{
  value: OutputType;
  label: string;
  icon: typeof Workflow;
}> = [
  { value: "diagram", label: "Diagram", icon: Workflow },
  { value: "table", label: "Table", icon: TableIcon },
  { value: "equation", label: "Equation", icon: Sigma },
  { value: "plot", label: "Plot", icon: LineChart },
];

const STYLE_OPTIONS: Record<OutputType, Array<{ value: string; label: string }>> = {
  diagram: [
    { value: "flowchart", label: "Flowchart" },
    { value: "architecture", label: "Architecture" },
    { value: "neural-network", label: "Neural network" },
    { value: "timeline", label: "Timeline" },
    { value: "hierarchy", label: "Hierarchy" },
  ],
  table: [
    { value: "academic", label: "Academic" },
    { value: "comparison", label: "Comparison" },
    { value: "results", label: "Results" },
    { value: "ablation", label: "Ablation" },
    { value: "compact", label: "Compact" },
  ],
  equation: [
    { value: "aligned", label: "Aligned" },
    { value: "derivation", label: "Derivation" },
    { value: "boxed", label: "Boxed result" },
    { value: "cases", label: "Cases" },
  ],
  plot: [
    { value: "line", label: "Line" },
    { value: "bar", label: "Bar" },
    { value: "scatter", label: "Scatter" },
    { value: "multi-series", label: "Multi-series" },
  ],
};

const COLOR_OPTIONS: Array<{
  value: ColorMode;
  label: string;
  swatches: string[];
}> = [
  { value: "monochrome", label: "Monochrome", swatches: ["#111827", "#6b7280", "#d1d5db"] },
  { value: "academic", label: "Academic", swatches: ["#1e3a5f", "#64748b", "#b45309"] },
  { value: "pastel", label: "Pastel", swatches: ["#93c5fd", "#a7f3d0", "#fbcfe8"] },
  { value: "vivid", label: "Vivid", swatches: ["#2563eb", "#dc2626", "#16a34a"] },
];

const DENSITY_OPTIONS: Array<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
];

const ASPECT_RATIO_OPTIONS: Array<{ value: AspectRatio; label: string; ratio: string }> = [
  { value: "auto", label: "Auto", ratio: "" },
  { value: "square", label: "Square", ratio: "1:1" },
  { value: "landscape", label: "Landscape", ratio: "4:3" },
  { value: "portrait", label: "Portrait", ratio: "3:4" },
  { value: "wide", label: "Wide", ratio: "16:9" },
];

const ARROW_STYLE_OPTIONS: Array<{ value: ArrowStyle; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "stealth", label: "Stealth" },
  { value: "dashed", label: "Dashed" },
  { value: "numbered", label: "Numbered" },
];

const DOCUMENT_FIT_OPTIONS: Array<{ value: DocumentFit; label: string; hint: string }> = [
  { value: "standalone", label: "Standalone", hint: "Full document, auto size" },
  { value: "snippet", label: "Paper snippet", hint: "Paste-ready body only" },
  { value: "column", label: "Column width", hint: "Fits ~8.5cm IEEE column" },
  { value: "fullpage", label: "Full page", hint: "Spans full text width" },
];

const GENERATION_STAGES = [
  "Reading your description...",
  "Planning the layout...",
  "Writing LaTeX code...",
  "Polishing details...",
  "Almost there...",
];

// Skeleton shaped like a real LaTeX document: indent levels and tinted
// segments (command / argument / plain text) instead of uniform gray bars.
type SkeletonTone = "cmd" | "arg" | "text";
const CODE_SKELETON_LINES: Array<{ indent: number; segments: Array<[SkeletonTone, number]> } | null> = [
  { indent: 0, segments: [["cmd", 26], ["arg", 30]] },
  { indent: 0, segments: [["cmd", 20], ["arg", 34]] },
  { indent: 0, segments: [["cmd", 22], ["arg", 18]] },
  null,
  { indent: 0, segments: [["cmd", 28]] },
  { indent: 1, segments: [["cmd", 30], ["text", 22]] },
  { indent: 1, segments: [["cmd", 18], ["arg", 28]] },
  { indent: 2, segments: [["cmd", 12], ["arg", 18], ["text", 26]] },
  { indent: 2, segments: [["cmd", 12], ["arg", 24], ["text", 16]] },
  { indent: 2, segments: [["cmd", 12], ["arg", 16], ["text", 30]] },
  { indent: 2, segments: [["cmd", 14], ["arg", 20], ["text", 18]] },
  null,
  { indent: 2, segments: [["cmd", 14], ["text", 34]] },
  { indent: 2, segments: [["cmd", 14], ["text", 24]] },
  { indent: 2, segments: [["cmd", 10], ["arg", 22], ["text", 20]] },
  { indent: 2, segments: [["cmd", 14], ["text", 28]] },
  { indent: 3, segments: [["cmd", 10], ["text", 22]] },
  { indent: 3, segments: [["cmd", 10], ["arg", 16], ["text", 18]] },
  { indent: 2, segments: [["cmd", 16], ["text", 20]] },
  null,
  { indent: 2, segments: [["cmd", 12], ["arg", 26]] },
  { indent: 2, segments: [["cmd", 12], ["arg", 18], ["text", 22]] },
  { indent: 1, segments: [["cmd", 28]] },
  { indent: 1, segments: [["cmd", 20], ["text", 16]] },
  { indent: 0, segments: [["cmd", 24]] },
  { indent: 0, segments: [["cmd", 18], ["arg", 20]] },
  null,
  { indent: 0, segments: [["cmd", 22]] },
];

const SKELETON_TONE_CLASS: Record<SkeletonTone, string> = {
  cmd: "bg-primary/30",
  arg: "bg-foreground/15",
  text: "bg-muted",
};

const LatexLogo = () => (
  <span className="latex-logo">
    L<span className="a">A</span>T<span className="e">E</span>X
  </span>
);

const FormatSection = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="mb-3 last:mb-0">
    <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    {children}
  </div>
);

function PillRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`border px-2.5 py-1 font-mono text-xs transition-colors ${
            value === option.value
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const Index = () => {
  const [input, setInput] = useState("");
  const [versions, setVersions] = useState<LatexVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const output = versions[activeVersion]?.latex ?? "";
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewStage, setPreviewStage] = useState<"compiling" | "repairing">("compiling");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const compileAbortRef = useRef<AbortController | null>(null);
  const repairAttemptsRef = useRef(0);
  // Caches compiled results per document string so switching version tabs is
  // instant instead of recompiling.
  const compileCacheRef = useRef<Map<string, CompileResult>>(new Map());
  const outputSectionRef = useRef<HTMLElement | null>(null);
  const [placeholderText, setPlaceholderText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [outputType, setOutputType] = useState<OutputType | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  // Auto-detection drives type/style until the user picks one manually.
  const manualSelectionRef = useRef(false);
  // Once a type exists, the picker collapses to just that type; expanding it
  // again lets the user switch to a different type.
  const [typeExpanded, setTypeExpanded] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>("academic");
  const [density, setDensity] = useState<Density>("normal");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("auto");
  const [arrowStyle, setArrowStyle] = useState<ArrowStyle>("solid");
  const [documentFit, setDocumentFit] = useState<DocumentFit>("standalone");
  const [references, setReferences] = useState<Reference[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [cursorPos, setCursorPos] = useState({ ln: 1, col: 1 });
  const [compileMs, setCompileMs] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachButtonRef = useRef<HTMLButtonElement | null>(null);
  const describeCardRef = useRef<HTMLDivElement | null>(null);
  const dragDepthRef = useRef(0);

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

  // The API always needs a concrete type/style; fall back to diagram/flowchart
  // when the user hasn't chosen and detection came up empty.
  const resolvedType: OutputType = outputType ?? "diagram";
  const resolvedStyle = style ?? STYLE_OPTIONS[resolvedType][0].value;
  const preferences = {
    outputType: resolvedType,
    style: resolvedStyle,
    colorMode,
    density,
    aspectRatio,
    arrowStyle,
    documentFit,
  };
  const activeType = outputType ? OUTPUT_TYPE_OPTIONS.find((option) => option.value === outputType) ?? null : null;

  const selectType = (value: OutputType) => {
    manualSelectionRef.current = true;
    setOutputType(value);
    setStyle(STYLE_OPTIONS[value][0].value);
    setTypeExpanded(false);
  };

  const selectStyle = (value: string) => {
    manualSelectionRef.current = true;
    setStyle(value);
  };

  // Debounced auto-detection: keep guessing type/style from the prompt until
  // the user overrides it manually.
  useEffect(() => {
    if (manualSelectionRef.current) return;
    const handle = setTimeout(() => {
      const detected = detectFromPrompt(input);
      setOutputType(detected.type);
      setStyle(detected.style);
      if (detected.type) setTypeExpanded(false);
    }, 350);
    return () => clearTimeout(handle);
  }, [input]);

  // macOS-minimize style animation: a floating thumbnail of the attached file
  // flies from the drop point into the paperclip button, squashing genie-like
  // on the way. The reference chip is added only when the ghost "lands".
  const flyReferenceToClip = (reference: Reference, origin: { x: number; y: number }, delay: number, onLand: () => void) => {
    const target = attachButtonRef.current?.getBoundingClientRect();
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!target || reducedMotion || typeof document.body.animate !== "function") {
      onLand();
      return;
    }

    const size = 96;
    const ghost = document.createElement("div");
    ghost.style.cssText = [
      "position:fixed",
      `left:${origin.x - size / 2}px`,
      `top:${origin.y - size / 2}px`,
      `width:${size}px`,
      `height:${size}px`,
      "z-index:9999",
      "pointer-events:none",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "gap:4px",
      "overflow:hidden",
      "border:1px solid rgba(15,23,42,.25)",
      "background:#fff",
      "border-radius:10px",
      "box-shadow:0 16px 40px rgba(15,23,42,.3)",
      "will-change:transform,opacity",
    ].join(";");

    if (reference.kind === "image") {
      const img = document.createElement("img");
      img.src = reference.content;
      img.alt = "";
      img.style.cssText = "width:100%;height:100%;object-fit:cover;";
      ghost.appendChild(img);
    } else {
      const label = document.createElement("span");
      label.textContent = reference.name;
      label.style.cssText =
        "font-family:monospace;font-size:9px;max-width:84px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155;padding:0 4px;";
      const icon = document.createElement("span");
      icon.textContent = "{ }";
      icon.style.cssText = "font-family:monospace;font-size:20px;color:#0f172a;";
      ghost.append(icon, label);
    }
    document.body.appendChild(ghost);

    const dx = target.left + target.width / 2 - origin.x;
    const dy = target.top + target.height / 2 - origin.y;
    const bend = dx > 0 ? -10 : 10; // genie-style lean toward the travel direction

    const animation = ghost.animate(
      [
        { transform: "translate(0px, 0px) scale(1, 1) skewY(0deg)", opacity: 1 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.45}px) scale(0.72, 0.9) skewY(${bend * 0.5}deg)`, opacity: 0.95, offset: 0.4 },
        { transform: `translate(${dx * 0.78}px, ${dy * 0.88}px) scale(0.3, 0.55) skewY(${bend}deg)`, opacity: 0.85, offset: 0.75 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.04, 0.08) skewY(0deg)`, opacity: 0.15 },
      ],
      { duration: 620, delay, easing: "cubic-bezier(0.55, 0.06, 0.35, 1)", fill: "forwards" },
    );

    animation.onfinish = () => {
      ghost.remove();
      // Little "caught it" pop on the paperclip.
      attachButtonRef.current?.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.4)" }, { transform: "scale(1)" }],
        { duration: 260, easing: "ease-out" },
      );
      onLand();
    };
  };

  const handleFiles = async (fileList: FileList | null, origin?: { x: number; y: number }) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const slotsLeft = MAX_REFERENCES - references.length;
    if (slotsLeft <= 0) {
      toast.error(`You can attach at most ${MAX_REFERENCES} references.`);
      return;
    }

    const additions: Reference[] = [];
    for (const file of files.slice(0, slotsLeft)) {
      const isImage = file.type.startsWith("image/");
      const isText = /\.(tex|bib|txt|csv|md)$/i.test(file.name) || file.type.startsWith("text/");

      if (isImage) {
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(`${file.name} is larger than 5MB.`);
          continue;
        }
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        additions.push({ kind: "image", name: file.name, content });
      } else if (isText) {
        if (file.size > MAX_TEXT_BYTES) {
          toast.error(`${file.name} is too large (max 20KB of text).`);
          continue;
        }
        const content = await file.text();
        additions.push({ kind: "text", name: file.name, content });
      } else {
        toast.error(`${file.name}: unsupported type. Use an image or .tex/.bib/.txt/.csv/.md file.`);
      }
    }

    if (additions.length > 0) {
      // Without a drop point (file picker), launch from the card's center.
      const card = describeCardRef.current?.getBoundingClientRect();
      const from = origin ?? {
        x: card ? card.left + card.width / 2 : window.innerWidth / 2,
        y: card ? card.top + card.height / 2 : window.innerHeight / 2,
      };
      additions.forEach((addition, index) => {
        flyReferenceToClip(addition, from, index * 110, () => {
          setReferences((prev) =>
            prev.length >= MAX_REFERENCES ? prev : [...prev, addition],
          );
        });
      });
    }
    if (files.length > slotsLeft) {
      toast.info(`Only the first ${slotsLeft} file(s) were added (max ${MAX_REFERENCES}).`);
    }
  };

  const removeReference = (index: number) => {
    setReferences((prev) => prev.filter((_, i) => i !== index));
  };

  // Replaces the active version's code in place (used by the auto-repair pass,
  // which fixes a version rather than creating a new one).
  const replaceActiveLatex = (latex: string) => {
    setVersions((prev) => prev.map((v, i) => (i === activeVersion ? { ...v, latex } : v)));
  };

  const handleGenerate = async () => {
    if (!input.trim()) return;
    // Reflect the resolved type/style in the UI so the user sees what was used
    // when they generated without picking anything.
    if (!outputType || !style) {
      setOutputType(resolvedType);
      setStyle(resolvedStyle);
    }
    setIsGenerating(true);
    // The output section renders as soon as generation starts, so bring the
    // staged progress into view immediately rather than after the result.
    requestAnimationFrame(() => {
      outputSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    try {
      const latex = await generateLaTeX(input, preferences, references);
      repairAttemptsRef.current = 0;
      setVersions([{ latex, label: "Original" }]);
      setActiveVersion(0);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to generate LaTeX.";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!refineInput.trim() || !output) return;
    setIsRefining(true);
    try {
      // Attach a rasterized snapshot of the current preview so the vision
      // model can see cropping / overflow / overlap, not just the source.
      const refineRefs = [...references];
      if (previewUrl && !previewError) {
        const previewImage = await pdfUrlToPngDataUrl(previewUrl);
        if (previewImage) {
          refineRefs.push({
            kind: "image",
            name: "current-preview",
            content: previewImage,
          });
        }
      }

      const latex = await refineLaTeX(refineInput, output, preferences, refineRefs);
      if (latex.trim() === output.trim()) {
        toast.info("The model returned unchanged code. Try describing the change more specifically, e.g. which nodes or labels to move.");
        return;
      }
      repairAttemptsRef.current = 0;
      // versions.length (render-time) is the index the appended item will take.
      setActiveVersion(versions.length);
      setVersions((prev) => [...prev, { latex, label: `Revision ${prev.length}` }]);
      setRefineInput("");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to refine LaTeX.";
      toast.error(message);
    } finally {
      setIsRefining(false);
    }
  };

  const handleSwitchVersion = (index: number) => {
    if (index === activeVersion) return;
    // Cached compiles apply instantly and shouldn't trigger another repair.
    repairAttemptsRef.current = 2;
    setActiveVersion(index);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildPreviewDocument = (latex: string) => {
    // 1. Remove markdown code blocks if present
    const cleanedLatex = latex.replace(/```latex\n?/gi, '').replace(/```\n?/g, '').trim();

    // 2. Extract preamble-only commands the LLM might generate
    const preambleRegex = /\\(usepackage|usetikzlibrary|pgfplotsset).*?(?:\{[^}]+\}|\[[^\]]+\])+/gi;
    const preambleMatches = cleanedLatex.match(preambleRegex) || [];
    const preamble = preambleMatches.join('\n');
    let body = cleanedLatex.replace(preambleRegex, '').trim();

    // 3. Remove document wrappers more robustly
    body = body.replace(/\\documentclass[\s\S]*?\{[\s\S]*?\}/gi, '');
    body = body.replace(/\\begin\s*\{document\}/gi, '');
    body = body.replace(/\\end\s*\{document\}/gi, '');

    // 4. In snippet/column/full-page modes the model returns float wrappers
    // (figure/table/caption/label) that cannot compile inside standalone;
    // strip them so the artifact itself still previews.
    body = body.replace(/\\begin\s*\{(figure|table)\*?\}(\[[^\]]*\])?/gi, '');
    body = body.replace(/\\end\s*\{(figure|table)\*?\}/gi, '');
    body = body.replace(/\\centering/gi, '');
    // \caption may carry an optional short title and nested braces.
    body = body.replace(/\\caption\s*\*?\s*(\[[^\]]*\])?\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/gi, '');
    body = body.replace(/\\label\s*\{[^}]*\}/gi, '');
    body = body.trim();

    const isBoxContent = /\\begin\s*\{(tikzpicture|tabular|longtable)\}/i.test(body);

    // Column / full-page fits target a fixed width; scale box content to it so
    // the preview reflects how it will sit in a paper.
    if (isBoxContent && (documentFit === "column" || documentFit === "fullpage")) {
      const targetWidth = documentFit === "column" ? "8.5cm" : "17cm";
      body = `\\resizebox{${targetWidth}}{!}{%\n${body}\n}`;
    }

    // varwidth caps the page at a text-line width (~8.5cm) and standalone
    // crops anything wider, clipping large diagrams/tables. Box content
    // (tikz, tabular) sizes itself, so only text/math needs varwidth.
    const classOptions = isBoxContent ? "border=10pt" : "border=10pt,varwidth";

    const fullDoc = `\\documentclass[${classOptions}]{standalone}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{amsmath,amssymb}
\\usepackage{array}
\\usepackage{booktabs}
\\usepackage{multirow}
\\usepackage{xcolor}
\\usepackage{graphicx}
\\usetikzlibrary{arrows.meta, positioning, shapes.geometric, fit, backgrounds, calc}
\\pgfplotsset{compat=1.14}
${preamble}
\\begin{document}
${body}
\\end{document}`;

    return fullDoc;
  };

  useEffect(() => {
    if (!output) return;

    compileAbortRef.current?.abort();
    const controller = new AbortController();
    compileAbortRef.current = controller;

    const applyResult = (result: CompileResult) => {
      setPreviewUrl(result.status === "success" ? result.pdfUrl : null);
      setPreviewError(result.status === "error" ? result.log : null);
      setIsPreviewLoading(false);
    };

    const doc = buildPreviewDocument(output);
    const cached = compileCacheRef.current.get(doc);
    if (cached) {
      applyResult(cached);
      return () => controller.abort();
    }

    setIsPreviewLoading(true);
    setPreviewStage("compiling");
    setPreviewError(null);

    const startedAt = performance.now();
    const run = async () => {
      const result = await compileLatex(doc, controller.signal);
      if (controller.signal.aborted) return;

      if (result.status === "error" && repairAttemptsRef.current < 2) {
        // Up to two automatic repair rounds: send the error log back to the
        // model, then let the effect re-run with the corrected code.
        repairAttemptsRef.current += 1;
        setPreviewStage("repairing");
        const repaired = await repairLaTeX(result.log, output, preferences);
        if (controller.signal.aborted) return;
        if (repaired.trim() !== output.trim()) {
          replaceActiveLatex(repaired);
          return;
        }
        // Identical code back means the model could not fix it; show the error.
      }

      compileCacheRef.current.set(doc, result);
      if (result.status === "success") {
        setCompileMs(performance.now() - startedAt);
      }
      applyResult(result);
    };

    run().catch((error) => {
      if (controller.signal.aborted) return;
      console.error(error);
      setPreviewError(
        error instanceof Error
          ? error.message
          : "Preview service unreachable. Check your connection and try again.",
      );
      setIsPreviewLoading(false);
    });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [output]);

  useEffect(() => {
    if (!isGenerating && !isRefining) {
      setStageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, GENERATION_STAGES.length - 1));
    }, 2200);
    return () => clearInterval(interval);
  }, [isGenerating, isRefining]);

  useEffect(() => {
    if (versions.length === 0) return;
    // Scroll when a new version is added (generate/refine), not on tab switch.
    requestAnimationFrame(() => {
      outputSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [versions.length]);

  return (
    <div className="flex min-h-screen flex-col checker-bg">
      {/* Nav — floating pill */}
      {/* Width matches the code+preview grid (max-w-6xl minus px-6). */}
      <nav className="sticky top-4 z-50 mx-auto mt-4 w-[min(69rem,calc(100%-3rem))] border border-foreground/30 bg-background/40 shadow-lg shadow-foreground/5 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex h-14 items-center justify-between px-6">
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

      {/* Grows to push the footer to the viewport bottom; block layout inside
          so centered max-w sections keep their full width. */}
      <main className="flex-1">

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-12 pb-8">
        <div className="max-w-2xl">
          <h1 className="font-heading text-5xl sm:text-6xl font-bold tracking-tighter leading-[0.9] mb-4">
            Natural language
            <br />
            to <LatexLogo />
          </h1>
          <p className="text-muted-foreground font-heading text-lg max-w-md">
            Describe your diagram or table in plain English. Get publication-ready LaTeX code instantly.
          </p>
        </div>
      </section>

      {/* Input */}
      <section className="max-w-5xl mx-auto px-6 pb-6">
        <div
          ref={describeCardRef}
          className={`relative bg-card border-2 transition-colors ${
            isDraggingOver ? "border-primary bg-primary/5" : "border-foreground"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current += 1;
            setIsDraggingOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current -= 1;
            if (dragDepthRef.current <= 0) {
              dragDepthRef.current = 0;
              setIsDraggingOver(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current = 0;
            setIsDraggingOver(false);
            handleFiles(e.dataTransfer.files, { x: e.clientX, y: e.clientY });
          }}
        >
          {isDraggingOver && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80">
              <div className="flex items-center gap-2 border-2 border-dashed border-primary px-4 py-3 font-mono text-sm text-primary">
                <Paperclip className="h-4 w-4" />
                Drop to attach
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Describe
            </span>
          </div>
          <textarea
            value={input}
            maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`e.g. ${placeholderText}|`}
            className="w-full bg-transparent px-4 py-4 text-foreground font-heading text-base placeholder:text-muted-foreground/60 focus:outline-none resize-none min-h-[120px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
            }}
            onSelect={(e) => {
              const before = e.currentTarget.value.slice(0, e.currentTarget.selectionStart ?? 0);
              const lines = before.split("\n");
              setCursorPos({ ln: lines.length, col: lines[lines.length - 1].length + 1 });
            }}
          />
          {/* Attached references */}
          {references.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-2">
              {references.map((reference, index) => (
                <span
                  key={`${reference.name}-${index}`}
                  className="flex items-center gap-1.5 border border-border bg-muted/40 py-0.5 pl-1 pr-1.5 font-mono text-[10px] duration-300 animate-in fade-in zoom-in-50"
                >
                  {reference.kind === "image" ? (
                    <img
                      src={reference.content}
                      alt=""
                      className="h-4 w-4 rounded-sm border border-border object-cover"
                    />
                  ) : (
                    <FileText className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="max-w-[56px] truncate">{reference.name}</span>
                  <button
                    type="button"
                    onClick={() => removeReference(index)}
                    aria-label={`Remove ${reference.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* One-line toolbar: type · style · format · pin · generate */}
          <div className="flex items-center gap-2 px-3 py-3">
            {/* Left cluster: type stays fixed; styles scroll so they never
                slip under the Format / Generate group on the right. */}
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {/* Output type — collapses to just the chosen type once one exists */}
            <div
              className="inline-flex shrink-0 overflow-hidden rounded-md border border-border"
              role="group"
              aria-label="What to create"
            >
              {OUTPUT_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = outputType === option.value;
                // When a type is chosen and the picker is collapsed, only the
                // active type stays visible; the others roll away.
                const shown = !outputType || typeExpanded || active;
                const collapsedActive = active && !typeExpanded && outputType !== null;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (active) {
                        setTypeExpanded((prev) => !prev);
                      } else {
                        selectType(option.value);
                      }
                    }}
                    aria-pressed={active}
                    title={active ? "Change type" : option.label}
                    className={`flex items-center gap-1.5 overflow-hidden whitespace-nowrap border-border font-mono text-xs transition-all duration-300 ease-out ${
                      shown ? "max-w-[160px] px-3 py-1.5 opacity-100" : "max-w-0 px-0 py-1.5 opacity-0"
                    } ${collapsedActive || !shown ? "border-r-0" : "border-r last:border-r-0"} ${
                      active
                        ? "bg-foreground text-background"
                        : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">{option.label}</span>
                    {collapsedActive && <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />}
                  </button>
                );
              })}
            </div>

            {/* Style pills — scroll horizontally instead of overlapping Format */}
            {outputType && (
              <div
                key={outputType}
                role="group"
                aria-label={`${activeType?.label} style`}
                className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden duration-300 animate-in fade-in slide-in-from-left-2"
              >
                {STYLE_OPTIONS[outputType].map((option) => {
                  const active = style === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectStyle(option.value)}
                      aria-pressed={active}
                      className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] transition-all duration-200 ${
                        active
                          ? "border-foreground bg-foreground text-background shadow-sm"
                          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
            </div>

            {/* Right group: format · pin · generate */}
            <div className="flex shrink-0 items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="chip" size="sm" className="h-8 rounded-none px-3 font-mono">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  Format
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 rounded-none p-3">
                <FormatSection label="Color">
                  <div className="grid grid-cols-2 gap-1">
                    {COLOR_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setColorMode(option.value)}
                        className={`flex items-center justify-between border px-2 py-1.5 font-mono text-xs transition-colors ${
                          colorMode === option.value ? "border-foreground bg-muted font-semibold" : "border-border hover:bg-muted"
                        }`}
                      >
                        <span>{option.label}</span>
                        <span className="flex gap-0.5" aria-hidden="true">
                          {option.swatches.map((swatch) => (
                            <span key={swatch} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: swatch }} />
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                </FormatSection>

                <FormatSection label="Detail">
                  <PillRow
                    options={DENSITY_OPTIONS}
                    value={density}
                    onChange={(value) => setDensity(value as Density)}
                  />
                </FormatSection>

                <FormatSection label="Canvas shape">
                  <div className="flex flex-wrap gap-1">
                    {ASPECT_RATIO_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAspectRatio(option.value)}
                        className={`border px-2 py-1 font-mono text-xs transition-colors ${
                          aspectRatio === option.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                        }`}
                      >
                        {option.label}
                        {option.ratio && <span className="ml-1 opacity-60">{option.ratio}</span>}
                      </button>
                    ))}
                  </div>
                </FormatSection>

                {(outputType === "diagram" || outputType === "plot") && (
                  <FormatSection label="Arrows">
                    <PillRow
                      options={ARROW_STYLE_OPTIONS}
                      value={arrowStyle}
                      onChange={(value) => setArrowStyle(value as ArrowStyle)}
                    />
                  </FormatSection>
                )}

                <FormatSection label="Document fit">
                  <div className="grid gap-1">
                    {DOCUMENT_FIT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDocumentFit(option.value)}
                        className={`flex items-center justify-between border px-2 py-1.5 text-left font-mono text-xs transition-colors ${
                          documentFit === option.value ? "border-foreground bg-muted font-semibold" : "border-border hover:bg-muted"
                        }`}
                      >
                        <span>{option.label}</span>
                        <span className="text-[10px] text-muted-foreground">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </FormatSection>
              </PopoverContent>
            </Popover>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.tex,.bib,.txt,.csv,.md"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              ref={attachButtonRef}
              type="button"
              variant="chip"
              size="sm"
              className="relative h-8 w-8 rounded-none px-0 font-mono"
              onClick={() => fileInputRef.current?.click()}
              disabled={references.length >= MAX_REFERENCES}
              title="Attach a reference — click or drag & drop an image / .tex / .bib / .txt / .csv"
              aria-label="Attach reference"
            >
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              {references.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground px-1 font-mono text-[9px] leading-none text-background">
                  {references.length}
                </span>
              )}
            </Button>

            <Button
              onClick={handleGenerate}
              disabled={!input.trim() || isGenerating}
              variant="default"
              size="sm"
              className="h-9 gap-1.5 rounded-none px-4 font-mono normal-case tracking-normal shadow-sm transition-shadow hover:shadow-md disabled:shadow-none"
            >
              {isGenerating ? (
                <>
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
                    aria-hidden="true"
                  />
                  Generating…
                </>
              ) : (
                <>
                  Generate
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Output */}
      {(output || isGenerating) && (
        <section ref={outputSectionRef} className="max-w-6xl mx-auto px-6 pb-20 scroll-mt-20">
          {/* Version history */}
          {versions.length > 1 && (
            <div className="mb-3 flex items-center gap-2 overflow-x-auto">
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Versions
              </span>
              <div className="flex gap-1">
                {versions.map((version, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSwitchVersion(index)}
                    className={`shrink-0 border px-3 py-1 font-mono text-xs transition-colors ${
                      index === activeVersion
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    }`}
                  >
                    {version.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              {output ? (
                <div className="px-4 py-4 overflow-auto flex-1">
                  <LatexCode code={output} />
                </div>
              ) : (
                <div className="skeleton-sheen relative flex-1 overflow-hidden px-4 py-4" aria-hidden="true">
                  <div className="space-y-2.5">
                    {CODE_SKELETON_LINES.map((line, i) => (
                      <div
                        key={i}
                        className="skeleton-line flex h-3 items-center gap-1"
                        style={{ animationDelay: `${i * 110}ms` }}
                      >
                        <span className="w-5 shrink-0 pr-2 text-right font-mono text-[10px] leading-none text-muted-foreground/40">
                          {i + 1}
                        </span>
                        {line && <span style={{ width: `${line.indent * 5}%` }} />}
                        {line?.segments.map(([tone, width], j) => (
                          <span
                            key={j}
                            className={`h-3 ${SKELETON_TONE_CLASS[tone]}`}
                            style={{ width: `${width}%` }}
                          />
                        ))}
                      </div>
                    ))}
                    <div
                      className="skeleton-line flex h-3 items-center gap-1"
                      style={{ animationDelay: `${CODE_SKELETON_LINES.length * 110}ms` }}
                    >
                      <span className="w-5 shrink-0 pr-2 text-right font-mono text-[10px] leading-none text-muted-foreground/40">
                        {CODE_SKELETON_LINES.length + 1}
                      </span>
                      <span className="skeleton-caret h-3.5 w-[7px] bg-primary" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Panel */}
            <div className="bg-card border-2 border-foreground flex flex-col h-[600px]">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Preview
                </span>
                {previewUrl && !previewError && !isPreviewLoading && !isGenerating && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    className="h-7 gap-1.5 px-2 font-mono text-xs normal-case"
                    title="Expand preview"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Expand
                  </Button>
                )}
              </div>
              <div className="flex-1 bg-white overflow-hidden flex items-center justify-center p-2 relative">
                {(isGenerating || isRefining) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground font-mono text-sm gap-5 z-10 bg-white">
                    {/* Blueprint wireframe sketching itself in */}
                    <svg
                      viewBox="0 0 220 130"
                      className="w-48 text-primary/70"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <rect x="84" y="8" width="52" height="26" pathLength={100} className="blueprint-path" />
                      <path d="M 110 34 L 110 56" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.25s" }} />
                      <path d="M 110 56 L 40 56 L 40 88" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.45s" }} />
                      <path d="M 110 56 L 180 56 L 180 88" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.45s" }} />
                      <rect x="14" y="88" width="52" height="26" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.75s" }} />
                      <rect x="154" y="88" width="52" height="26" pathLength={100} className="blueprint-path" style={{ animationDelay: "0.75s" }} />
                      <path d="M 66 101 L 154 101" pathLength={100} className="blueprint-path" style={{ animationDelay: "1.05s" }} />
                    </svg>
                    <span key={stageIndex} className="text-shimmer text-xs font-semibold tracking-wide animate-in fade-in slide-in-from-bottom-1 duration-500">
                      {GENERATION_STAGES[stageIndex]}
                    </span>
                    <div className="flex gap-1.5">
                      {GENERATION_STAGES.map((_, i) => (
                        <span
                          key={i}
                          className={`h-1 w-6 transition-colors duration-300 ${i <= stageIndex ? "bg-primary" : "bg-border"}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {isPreviewLoading && !isGenerating && !isRefining && output && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground font-mono text-sm gap-4 z-10 bg-white">
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    </div>
                    <span className="text-shimmer tracking-widest uppercase text-xs font-semibold">
                      {previewStage === "repairing" ? "Fixing compile errors..." : "Compiling preview..."}
                    </span>
                    {previewStage === "repairing" && (
                      <span className="text-[11px] normal-case tracking-normal text-muted-foreground">
                        The first attempt had errors — automatically repairing the code.
                      </span>
                    )}
                  </div>
                )}

                {previewError && !isPreviewLoading && !isGenerating && (
                  <div className="absolute inset-0 z-10 flex flex-col overflow-hidden bg-white">
                    <div className="border-b-2 border-destructive/60 bg-destructive/10 px-4 py-2">
                      <span className="font-mono text-xs font-semibold uppercase tracking-widest text-destructive">
                        Compilation failed
                      </span>
                    </div>
                    <pre className="flex-1 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
                      {previewError}
                    </pre>
                    <div className="border-t border-border px-4 py-2">
                      <p className="font-mono text-[11px] text-muted-foreground">
                        An automatic fix was attempted. Describe the problem in the refine box below, or generate again.
                      </p>
                    </div>
                  </div>
                )}

                {previewUrl && !previewError && (
                  <>
                    <iframe
                      src={`${previewUrl}#view=FitH&toolbar=0`}
                      className={`w-full h-full border-0 transition-opacity duration-300 pointer-events-none ${(isGenerating || isPreviewLoading) ? 'opacity-0' : 'opacity-100'}`}
                      title="LaTeX Preview"
                      referrerPolicy="no-referrer"
                    />
                    {/* Transparent hit target — iframes swallow clicks, so this
                        opens the lightbox when the user clicks the preview. */}
                    {!isGenerating && !isPreviewLoading && (
                      <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        aria-label="Expand preview"
                        className="absolute inset-0 z-[5] cursor-zoom-in bg-transparent transition-colors hover:bg-foreground/[0.03]"
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="flex h-[92vh] w-[min(96vw,1200px)] max-w-none flex-col gap-0 overflow-hidden rounded-none border-2 border-foreground p-0 sm:rounded-none">
              <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border bg-muted/50 px-4 py-2.5 pr-12 text-left">
                <DialogTitle className="font-mono text-xs font-normal uppercase tracking-widest text-muted-foreground">
                  Preview
                </DialogTitle>
              </DialogHeader>
              <div className="min-h-0 flex-1 bg-white p-3">
                {previewUrl && (
                  <iframe
                    src={`${previewUrl}#view=Fit&toolbar=0`}
                    className="h-full w-full border-0"
                    title="LaTeX Preview (expanded)"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Refine bar */}
          {output && (
          <div className="mt-6 bg-card border-2 border-foreground">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <Wand2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Refine
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch gap-2 p-3">
              <input
                type="text"
                value={refineInput}
                maxLength={2000}
                onChange={(e) => setRefineInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRefine();
                }}
                placeholder='Describe a change, e.g. "make the boxes wider" or "add a skip connection from Conv 1 to Dense 1"'
                className="flex-1 bg-transparent px-3 py-2 border border-border text-sm font-heading placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground"
                disabled={isRefining || isGenerating}
              />
              <Button
                onClick={handleRefine}
                disabled={!refineInput.trim() || isRefining || isGenerating}
                variant="default"
                size="sm"
                className="sm:w-auto"
              >
                {isRefining ? (
                  <span className="animate-pulse">Refining...</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    Apply change <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </Button>
            </div>
          </div>
          )}
        </section>
      )}

      </main>

      {/* Footer — slim editor status bar (Overleaf / VSCode style) with live segments */}
      <footer aria-label="Status bar" className="select-none bg-foreground font-mono text-[11px] text-background">
        <div className="flex h-7 items-stretch justify-between overflow-hidden">
          <div className="flex items-stretch">
            <span className="flex items-center gap-1.5 bg-primary px-3 text-primary-foreground">
              <GitBranch className="h-3 w-3" />
              texlab/main
            </span>
            <span className="flex items-center gap-1.5 px-3 transition-colors hover:bg-background/15">
              {isGenerating || isRefining ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  generating…
                </>
              ) : isPreviewLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {previewStage === "repairing" ? "auto-repairing…" : "compiling…"}
                </>
              ) : previewError ? (
                <>
                  <CircleX className="h-3 w-3" />
                  compile failed
                </>
              ) : previewUrl ? (
                <>
                  <Check className="h-3 w-3" />
                  compiled{compileMs !== null ? ` in ${(compileMs / 1000).toFixed(1)}s` : ""}
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" />
                  ready
                </>
              )}
            </span>
            <span className="hidden items-center gap-2 px-3 transition-colors hover:bg-background/15 sm:flex">
              <span className="flex items-center gap-1">
                <CircleX className="h-3 w-3" />
                {previewError ? 1 : 0}
              </span>
              <span className="flex items-center gap-1">
                <TriangleAlert className="h-3 w-3" />0
              </span>
            </span>
          </div>
          <div className="flex items-stretch">
            <span className="hidden items-center px-3 transition-colors hover:bg-background/15 sm:flex">
              Ln {cursorPos.ln}, Col {cursorPos.col}
            </span>
            <span className="hidden items-center px-3 transition-colors hover:bg-background/15 md:flex">
              UTF-8
            </span>
            <span className="flex items-center px-3 transition-colors hover:bg-background/15">
              LaTeX
            </span>
            <span className="hidden items-center px-3 transition-colors hover:bg-background/15 md:flex">
              pdfTeX 3.141592653
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
