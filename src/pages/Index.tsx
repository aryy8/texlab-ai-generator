import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  type AspectRatio,
  type ArrowStyle,
  type ColorMode,
  type Density,
  type DocumentFit,
  type OutputType,
  type Reference,
  checkPromptSafety,
} from "@/lib/openrouter";
import { detectFromPrompt } from "@/lib/detect";
import { FIGURE_TEMPLATES } from "@/lib/templates";
import { TemplateGallery } from "@/components/TemplateGallery";
import { TemplateCatalog } from "@/components/TemplateCatalog";
import { ModelSelector } from "@/components/ModelSelector";
import { loadStoredModel, saveStoredModel, type GenerationModelId } from "@/lib/models";
import { saveWorkspaceHandoff } from "@/lib/workspace-handoff";
import { FitDemo } from "@/components/landing/FitDemo";
import { WorkspaceDemo } from "@/components/landing/WorkspaceDemo";
import { VsChatGPT } from "@/components/landing/VsChatGPT";
import { ExportProof } from "@/components/landing/ExportProof";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowUp,
  ArrowUpRight,
  Loader2,
  SlidersHorizontal,
  Paperclip,
  X,
  FileText,
  ChevronDown,
  Workflow,
  Table as TableIcon,
  Sigma,
  LineChart,
} from "lucide-react";

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
  { value: "academic", label: "Academic", swatches: ["#2E6B8A", "#3D8B7A", "#B86B2C"] },
  { value: "pastel", label: "Pastel", swatches: ["#7BA3B8", "#8BB5AA", "#D4A574"] },
  { value: "vivid", label: "Vivid", swatches: ["#2E6B8A", "#B86B2C", "#3D8B7A"] },
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
  { value: "column", label: "Column (~8.5 cm)", hint: "IEEE/ACM two-column" },
  { value: "fullpage", label: "Full width (~17 cm)", hint: "Single-column textwidth" },
  { value: "snippet", label: "Paste snippet", hint: "Raw tikz/tabular only" },
  { value: "standalone", label: "Standalone preview", hint: "Preview only in teXlab" },
];

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
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [placeholderText, setPlaceholderText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [outputType, setOutputType] = useState<OutputType | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const manualSelectionRef = useRef(false);
  const [typeExpanded, setTypeExpanded] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>("academic");
  const [density, setDensity] = useState<Density>("normal");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("auto");
  const [arrowStyle, setArrowStyle] = useState<ArrowStyle>("solid");
  const [documentFit, setDocumentFit] = useState<DocumentFit>("column");
  const [references, setReferences] = useState<Reference[]>([]);
  const [generationModel, setGenerationModel] = useState<GenerationModelId>(() => loadStoredModel());
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [mockDark, setMockDark] = useState(false);
  const [isCheckingSafety, setIsCheckingSafety] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachButtonRef = useRef<HTMLButtonElement | null>(null);
  const describeCardRef = useRef<HTMLDivElement | null>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
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
    } else if (placeholderText.length < currentPrompt.length) {
      timeout = setTimeout(() => {
        setPlaceholderText(currentPrompt.substring(0, placeholderText.length + 1));
      }, 50);
    } else {
      timeout = setTimeout(() => setIsDeleting(true), 2500);
    }

    return () => clearTimeout(timeout);
  }, [placeholderText, isDeleting, promptIndex]);

  useEffect(() => {
    if (window.location.hash === "#templates") {
      setCatalogOpen(true);
    }
  }, []);

  const openCatalog = () => {
    setCatalogOpen(true);
    if (window.location.hash !== "#templates") {
      window.history.replaceState(null, "", "#templates");
    }
  };

  const handleCatalogOpenChange = (open: boolean) => {
    setCatalogOpen(open);
    if (!open && window.location.hash === "#templates") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  const resolvedType: OutputType = outputType ?? "diagram";
  const resolvedStyle = style ?? STYLE_OPTIONS[resolvedType][0].value;
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

  const flyReferenceToClip = (
    reference: Reference,
    origin: { x: number; y: number },
    delay: number,
    onLand: () => void,
  ) => {
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
    const bend = dx > 0 ? -10 : 10;

    const animation = ghost.animate(
      [
        { transform: "translate(0px, 0px) scale(1, 1) skewY(0deg)", opacity: 1 },
        {
          transform: `translate(${dx * 0.35}px, ${dy * 0.45}px) scale(0.72, 0.9) skewY(${bend * 0.5}deg)`,
          opacity: 0.95,
          offset: 0.4,
        },
        {
          transform: `translate(${dx * 0.78}px, ${dy * 0.88}px) scale(0.3, 0.55) skewY(${bend}deg)`,
          opacity: 0.85,
          offset: 0.75,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(0.04, 0.08) skewY(0deg)`, opacity: 0.15 },
      ],
      { duration: 620, delay, easing: "cubic-bezier(0.55, 0.06, 0.35, 1)", fill: "forwards" },
    );

    animation.onfinish = () => {
      ghost.remove();
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
      const card = describeCardRef.current?.getBoundingClientRect();
      const from = origin ?? {
        x: card ? card.left + card.width / 2 : window.innerWidth / 2,
        y: card ? card.top + card.height / 2 : window.innerHeight / 2,
      };
      additions.forEach((addition, index) => {
        flyReferenceToClip(addition, from, index * 110, () => {
          setReferences((prev) => (prev.length >= MAX_REFERENCES ? prev : [...prev, addition]));
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

  const goToWorkspace = (autoGenerate: boolean, templateId?: string) => {
    const type = outputType ?? resolvedType;
    const st = style ?? resolvedStyle;
    const handoff = {
      prompt: input.trim(),
      preferences: {
        outputType: type,
        style: st,
        colorMode,
        density,
        aspectRatio,
        arrowStyle,
        documentFit,
      },
      references,
      generationModel,
      autoGenerate,
      templateId,
    };
    saveWorkspaceHandoff(handoff);
    navigate("/app", { state: { handoff } });
  };

  const handleGenerate = async () => {
    if (!input.trim() || isCheckingSafety) return;
    if (!outputType || !style) {
      setOutputType(resolvedType);
      setStyle(resolvedStyle);
    }

    setIsCheckingSafety(true);
    try {
      const safety = await checkPromptSafety(input.trim(), references);
      if (!safety.allowed) {
        toast.error(safety.error);
        return;
      }
      goToWorkspace(true);
    } catch {
      toast.error("Could not verify this prompt. Please try again.");
    } finally {
      setIsCheckingSafety(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = FIGURE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    manualSelectionRef.current = true;
    setInput(template.prompt);
    setOutputType(template.outputType);
    setStyle(template.style);
    setColorMode(template.colorMode);
    setDensity(template.density);
    setAspectRatio(template.aspectRatio);
    setDocumentFit(template.documentFit);
    setArrowStyle(template.arrowStyle);
    setTypeExpanded(false);
    describeCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex min-h-screen flex-col checker-bg">
      <nav className="sticky top-4 z-50 mx-auto mt-4 w-[min(69rem,calc(100%-3rem))] border border-foreground/30 bg-background/40 shadow-lg shadow-foreground/5 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="font-heading text-xl font-bold tracking-tighter">
              te<span className="font-mono">X</span>lab
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={openCatalog}
              className="hidden text-xs font-mono text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Templates
            </button>
            <Link
              to="/app"
              className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground transition-colors hover:text-foreground"
            >
              Workspace
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pb-8 pt-12">
          <div className="max-w-2xl">
            <h1 className="mb-4 font-heading text-5xl font-bold leading-[0.9] tracking-tighter sm:text-6xl">
              Natural language
              <br />
              to <LatexLogo />
            </h1>
            <p className="max-w-lg font-heading text-lg text-muted-foreground">
              Describe a diagram or table — get a figure that{" "}
              <span className="text-foreground">compiles and fits your paper column</span>, then open
              it in Overleaf.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-6">
          <div
            ref={describeCardRef}
            className={`relative border-2 bg-card transition-colors ${
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
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Describe
              </span>
            </div>
            <textarea
              value={input}
              maxLength={4000}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`e.g. ${placeholderText}|`}
              className="min-h-[120px] w-full resize-none bg-transparent px-4 py-4 font-heading text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleGenerate();
              }}
            />
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

            <div className="flex items-center gap-2 px-3 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <div
                  className="inline-flex shrink-0 overflow-hidden rounded-md border border-border"
                  role="group"
                  aria-label="What to create"
                >
                  {OUTPUT_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = outputType === option.value;
                    const shown = !outputType || typeExpanded || active;
                    const collapsedActive = active && !typeExpanded && outputType !== null;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          if (active) setTypeExpanded((prev) => !prev);
                          else selectType(option.value);
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

                {outputType && (
                  <div
                    key={outputType}
                    role="group"
                    aria-label={`${activeType?.label} style`}
                    className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto duration-300 animate-in fade-in slide-in-from-left-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

              <div className="flex shrink-0 items-center gap-2">
                <ModelSelector
                  value={generationModel}
                  onChange={(model) => {
                    setGenerationModel(model);
                    saveStoredModel(model);
                  }}
                />
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
                              colorMode === option.value
                                ? "border-foreground bg-muted font-semibold"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            <span>{option.label}</span>
                            <span className="flex gap-0.5" aria-hidden="true">
                              {option.swatches.map((swatch) => (
                                <span
                                  key={swatch}
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: swatch }}
                                />
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
                              aspectRatio === option.value
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
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
                    <FormatSection label="Paper fit">
                      <div className="grid gap-1">
                        {DOCUMENT_FIT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setDocumentFit(option.value)}
                            className={`flex items-center justify-between border px-2 py-1.5 text-left font-mono text-xs transition-colors ${
                              documentFit === option.value
                                ? "border-foreground bg-muted font-semibold"
                                : "border-border hover:bg-muted"
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
                  title="Attach a reference"
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
                  onClick={() => void handleGenerate()}
                  disabled={!input.trim() || isCheckingSafety}
                  variant="default"
                  size="icon"
                  aria-label={isCheckingSafety ? "Checking prompt safety" : "Generate in workspace"}
                  aria-busy={isCheckingSafety}
                  className="h-9 w-9 shrink-0 rounded-none shadow-sm transition-shadow hover:shadow-md disabled:shadow-none"
                >
                  {isCheckingSafety ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div id="showcase" className="scroll-mt-24">
          <TemplateGallery onSelect={applyTemplate} onBrowseAll={openCatalog} />
        </div>

        <TemplateCatalog
          open={catalogOpen}
          onOpenChange={handleCatalogOpenChange}
          onSelect={applyTemplate}
        />

        <FitDemo />
        <WorkspaceDemo mockDark={mockDark} onMockDarkChange={setMockDark} />
        <VsChatGPT mockDark={mockDark} />
        <ExportProof mockDark={mockDark} />
        <LandingFooter />
      </main>
    </div>
  );
};

export default Index;
