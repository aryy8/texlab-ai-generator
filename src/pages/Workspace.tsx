import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  generateLaTeX,
  refineLaTeX,
  repairLaTeX,
  isAbortError,
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
import {
  buildPasteSnippet,
  buildPreviewDocument,
  fitBadgeLabel,
} from "@/lib/figure-export";
import { validateFigureFit, type FitStatus } from "@/lib/fit-validation";
import { saveFigure, type StoredFigure } from "@/lib/figure-history";
import { FIGURE_TEMPLATES } from "@/lib/templates";
import { openInOverleaf, downloadFigureZip } from "@/lib/overleaf-export";
import { FigureHistoryDrawer } from "@/components/FigureHistoryDrawer";
import { FormatSelector } from "@/components/FormatSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { SketchingPreview } from "@/components/SketchingPreview";
import { BlueprintBusy } from "@/components/BlueprintBusy";
import { loadStoredModel, saveStoredModel, type GenerationModelId } from "@/lib/models";
import {
  consumeWorkspaceHandoff,
  type WorkspaceHandoff,
} from "@/lib/workspace-handoff";
import {
  loadWorkspaceSession,
  saveWorkspaceSession,
} from "@/lib/workspace-session";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LatexCode } from "@/components/LatexCode";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Copy,
  Check,
  ArrowUp,
  History,
  Paperclip,
  X,
  FileText,
  Maximize2,
  Workflow,
  Table as TableIcon,
  Sigma,
  LineChart,
  GitBranch,
  CircleX,
  TriangleAlert,
  Download,
  ExternalLink,
  Moon,
  Sun,
  Square,
} from "lucide-react";

interface LatexVersion {
  latex: string;
  label: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: string;
}

const MAX_REFERENCES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 20_000;

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

const GENERATION_STAGES = [
  "Reading your prompt…",
  "Matching a figure template…",
  "Laying out nodes & edges…",
  "Writing the TikZ source…",
  "Almost there…",
];

const REFINE_STAGES = [
  "Understanding your edit…",
  "Updating the figure…",
  "Rewriting LaTeX…",
  "Almost there…",
];

const COMPILE_STAGES = [
  "Compiling with pdflatex…",
  "Rendering the PDF…",
  "Almost there…",
];

const REPAIR_STAGES = [
  "Reading the TeX log…",
  "Fixing compile errors…",
  "Trying again…",
  "Almost there…",
];

type PipelineStage = "idle" | "generating" | "compiling" | "repairing" | "fit_ok" | "fit_warn" | "error";

const Workspace = () => {
  const location = useLocation();
  const handoffBootRef = useRef(false);
  const sessionReadyRef = useRef(false);
  const skipSessionSaveRef = useRef(false);

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
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [showSketchOverlay, setShowSketchOverlay] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const compileAbortRef = useRef<AbortController | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  const repairAttemptsRef = useRef(0);
  // Caches compiled results per document string so switching version tabs is
  // instant instead of recompiling.
  const compileCacheRef = useRef<Map<string, CompileResult>>(new Map());
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
  const [documentFit, setDocumentFit] = useState<DocumentFit>("column");
  const [references, setReferences] = useState<Reference[]>([]);
  const [generationModel, setGenerationModel] = useState<GenerationModelId>(() => loadStoredModel());
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [compileMs, setCompileMs] = useState<number | null>(null);
  const [fitStatus, setFitStatus] = useState<FitStatus>("idle");
  const [codeView, setCodeView] = useState<"source" | "paste">("paste");
  const [isExporting, setIsExporting] = useState(false);
  const [currentFigureId, setCurrentFigureId] = useState<string | null>(null);
  const [workspaceDark, setWorkspaceDark] = useState(() => {
    try {
      const stored = localStorage.getItem("texlab-workspace-theme");
      if (stored === "light") return false;
      if (stored === "dark") return true;
    } catch {
      /* ignore */
    }
    return true;
  });
  const fitRefineAttemptsRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachButtonRef = useRef<HTMLButtonElement | null>(null);
  const describeCardRef = useRef<HTMLDivElement | null>(null);
  const dragDepthRef = useRef(0);
  const pendingAutoGenerateRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (workspaceDark) root.classList.add("dark");
    else root.classList.remove("dark");
    return () => {
      root.classList.remove("dark");
    };
  }, [workspaceDark]);

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

  const pipelineStage: PipelineStage = (() => {
    if (isGenerating || isRefining) return "generating";
    if (isPreviewLoading && previewStage === "repairing") return "repairing";
    if (isPreviewLoading) return "compiling";
    if (previewError) return "error";
    if (output && (fitStatus === "may_overflow" || fitStatus === "cropped")) return "fit_warn";
    if (output && (fitStatus === "verified" || previewUrl)) return "fit_ok";
    return "idle";
  })();

  const pushChat = (message: Omit<ChatMessage, "id">) => {
    setChatMessages((prev) => [
      ...prev,
      { ...message, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ]);
  };

  const applyHandoff = (handoff: WorkspaceHandoff) => {
    manualSelectionRef.current = true;
    setInput(handoff.prompt);
    setOutputType(handoff.preferences.outputType);
    setStyle(handoff.preferences.style);
    setColorMode(handoff.preferences.colorMode);
    setDensity(handoff.preferences.density);
    setAspectRatio(handoff.preferences.aspectRatio);
    setArrowStyle(handoff.preferences.arrowStyle);
    setDocumentFit(handoff.preferences.documentFit);
    setReferences(handoff.references);
    setGenerationModel(handoff.generationModel);
    saveStoredModel(handoff.generationModel);
    setTypeExpanded(false);
    if (handoff.prompt.trim()) {
      setChatMessages([
        {
          id: `handoff-${Date.now()}`,
          role: "user",
          content: handoff.prompt.trim(),
        },
      ]);
    }
    pendingAutoGenerateRef.current = handoff.autoGenerate && Boolean(handoff.prompt.trim());
  };

  const applySession = (session: NonNullable<ReturnType<typeof loadWorkspaceSession>>) => {
    manualSelectionRef.current = true;
    setInput(session.input);
    setVersions(session.versions);
    setActiveVersion(
      Math.min(Math.max(session.activeVersion, 0), Math.max(session.versions.length - 1, 0)),
    );
    setChatMessages(session.chatMessages);
    setOutputType(session.outputType);
    setStyle(session.style);
    setColorMode(session.colorMode);
    setDensity(session.density);
    setAspectRatio(session.aspectRatio);
    setArrowStyle(session.arrowStyle);
    setDocumentFit(session.documentFit);
    setReferences(session.references ?? []);
    setGenerationModel(session.generationModel);
    saveStoredModel(session.generationModel);
    setCurrentFigureId(session.currentFigureId);
    setCodeView(session.codeView === "source" ? "source" : "paste");
    setTypeExpanded(false);
    pendingAutoGenerateRef.current = false;
    repairAttemptsRef.current = 2; // skip auto-repair storm on restored compile
  };

  useEffect(() => {
    if (handoffBootRef.current) return;
    handoffBootRef.current = true;
    const fromState = (location.state as { handoff?: WorkspaceHandoff } | null)?.handoff;
    const handoff = fromState ?? consumeWorkspaceHandoff();
    if (handoff) {
      applyHandoff(handoff);
      skipSessionSaveRef.current = true;
    } else {
      const params = new URLSearchParams(location.search);
      const templateId = params.get("template");
      if (templateId) {
        const template = FIGURE_TEMPLATES.find((t) => t.id === templateId);
        if (template) {
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
          setChatMessages([{ id: `tpl-${template.id}`, role: "user", content: template.prompt }]);
          pendingAutoGenerateRef.current = true;
          skipSessionSaveRef.current = true;
        }
      } else {
        const session = loadWorkspaceSession();
        if (session && (session.versions.length > 0 || session.input.trim() || session.chatMessages.length > 0)) {
          applySession(session);
          skipSessionSaveRef.current = true;
        }
      }
    }
    sessionReadyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once on mount
  }, []);

  // Persist workspace so refresh keeps the current figure / chat.
  useEffect(() => {
    if (!sessionReadyRef.current) return;
    if (skipSessionSaveRef.current) {
      skipSessionSaveRef.current = false;
      return;
    }
    if (isGenerating || isRefining) return;
    saveWorkspaceSession({
      input,
      versions,
      activeVersion,
      chatMessages,
      outputType,
      style,
      colorMode,
      density,
      aspectRatio,
      arrowStyle,
      documentFit,
      references,
      generationModel,
      currentFigureId,
      codeView,
    });
  }, [
    input,
    versions,
    activeVersion,
    chatMessages,
    outputType,
    style,
    colorMode,
    density,
    aspectRatio,
    arrowStyle,
    documentFit,
    references,
    generationModel,
    currentFigureId,
    codeView,
    isGenerating,
    isRefining,
  ]);

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

  const handleStop = () => {
    generationAbortRef.current?.abort();
    compileAbortRef.current?.abort();
    generationAbortRef.current = null;
    setIsGenerating(false);
    setIsRefining(false);
    setIsPreviewLoading(false);
    pushChat({ role: "assistant", content: "Stopped." });
  };

  const handleGenerate = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? input).trim();
    if (!prompt) return;
    setInput(prompt);
    // Reflect the resolved type/style in the UI so the user sees what was used
    // when they generated without picking anything.
    if (!outputType || !style) {
      setOutputType(resolvedType);
      setStyle(resolvedStyle);
    }
    generationAbortRef.current?.abort();
    const controller = new AbortController();
    generationAbortRef.current = controller;
    setIsGenerating(true);
    repairAttemptsRef.current = 0;
    fitRefineAttemptsRef.current = 0;
    setFitStatus("idle");
    setCurrentFigureId(null);
    try {
      const latex = await generateLaTeX(
        prompt,
        preferences,
        references,
        generationModel,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      repairAttemptsRef.current = 0;
      setVersions([{ latex, label: "Original" }]);
      setActiveVersion(0);
      pushChat({
        role: "assistant",
        content: "Figure drafted. Compiling preview and checking paper fit…",
        meta: `${resolvedType} · ${resolvedStyle}`,
      });
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) return;
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to generate LaTeX.";
      toast.error(message);
      pushChat({ role: "assistant", content: message });
    } finally {
      if (generationAbortRef.current === controller) {
        generationAbortRef.current = null;
      }
      setIsGenerating(false);
    }
  };

  const handleRefine = async (instructionOverride?: string) => {
    const instruction = (instructionOverride ?? refineInput).trim();
    if (!instruction || !output) return;
    generationAbortRef.current?.abort();
    const controller = new AbortController();
    generationAbortRef.current = controller;
    setIsRefining(true);
    try {
      // Attach a rasterized snapshot of the current preview so the vision
      // model can see cropping / overflow / overlap, not just the source.
      const refineRefs = [...references];
      if (previewUrl && !previewError) {
        const previewImage = await pdfUrlToPngDataUrl(previewUrl);
        if (controller.signal.aborted) return;
        if (previewImage) {
          refineRefs.push({
            kind: "image",
            name: "current-preview",
            content: previewImage,
          });
        }
      }

      const latex = await refineLaTeX(
        instruction,
        output,
        preferences,
        refineRefs,
        generationModel,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (latex.trim() === output.trim()) {
        toast.info("The model returned unchanged code. Try describing the change more specifically, e.g. which nodes or labels to move.");
        pushChat({
          role: "assistant",
          content: "No code changes — try a more specific edit (which nodes, labels, or spacing).",
        });
        return;
      }
      repairAttemptsRef.current = 0;
      // versions.length (render-time) is the index the appended item will take.
      setActiveVersion(versions.length);
      setVersions((prev) => [...prev, { latex, label: `Revision ${prev.length}` }]);
      setRefineInput("");
      pushChat({
        role: "assistant",
        content: "Revision applied. Recompiling preview…",
        meta: `Revision ${versions.length}`,
      });
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) return;
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to refine LaTeX.";
      toast.error(message);
      pushChat({ role: "assistant", content: message });
    } finally {
      if (generationAbortRef.current === controller) {
        generationAbortRef.current = null;
      }
      setIsRefining(false);
    }
  };

  const handleChatSubmit = async () => {
    const text = chatDraft.trim();
    if (!text || isGenerating || isRefining) return;
    setChatDraft("");
    pushChat({ role: "user", content: text });
    if (!output) {
      await handleGenerate(text);
    } else {
      await handleRefine(text);
    }
  };

  const handleSwitchVersion = (index: number) => {
    if (index === activeVersion) return;
    // Cached compiles apply instantly and shouldn't trigger another repair.
    repairAttemptsRef.current = 2;
    setActiveVersion(index);
  };

  const handleCopy = () => {
    const text =
      codeView === "paste" && output
        ? buildPasteSnippet(output, documentFit, outputType)
        : output;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pasteSnippet = output ? buildPasteSnippet(output, documentFit, outputType) : "";

  const handleDownloadZip = async () => {
    if (!output) return;
    setIsExporting(true);
    try {
      await downloadFigureZip({
        latex: output,
        prompt: input,
        documentFit,
        outputType,
      });
      toast.success("Downloaded figure project (.zip)");
    } catch (error) {
      console.error(error);
      toast.error("Failed to build export zip");
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenInOverleaf = async () => {
    if (!output) return;
    setIsExporting(true);
    try {
      await openInOverleaf({
        latex: output,
        prompt: input,
        documentFit,
        outputType,
      });
      toast.success("Opening in Overleaf…");
    } catch (error) {
      console.error(error);
      toast.error("Could not open in Overleaf. Try Download .zip instead.");
    } finally {
      setIsExporting(false);
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
    setTypeExpanded(false);
  };

  const restoreFigure = (figure: StoredFigure) => {
    manualSelectionRef.current = true;
    setInput(figure.prompt);
    setOutputType(figure.preferences.outputType);
    setStyle(figure.preferences.style);
    setColorMode(figure.preferences.colorMode);
    setDensity(figure.preferences.density);
    setAspectRatio(figure.preferences.aspectRatio);
    setArrowStyle(figure.preferences.arrowStyle);
    setDocumentFit(figure.preferences.documentFit);
    setVersions(figure.versions);
    setActiveVersion(figure.activeVersion);
    setCurrentFigureId(figure.id);
    repairAttemptsRef.current = 0;
    fitRefineAttemptsRef.current = 0;
    setChatMessages([
      { id: `restore-${figure.id}`, role: "user", content: figure.prompt },
      {
        id: `restore-a-${figure.id}`,
        role: "assistant",
        content: "Restored figure from history.",
        meta: `${figure.versions.length} version${figure.versions.length === 1 ? "" : "s"}`,
      },
    ]);
  };

  const runAutoFitRefine = async () => {
    if (!output || fitRefineAttemptsRef.current >= 1) return;
    fitRefineAttemptsRef.current += 1;
    setIsRefining(true);
    try {
      const refineRefs = [...references];
      if (previewUrl) {
        const previewImage = await pdfUrlToPngDataUrl(previewUrl);
        if (previewImage) {
          refineRefs.push({ kind: "image", name: "current-preview", content: previewImage });
        }
      }
      const instruction =
        documentFit === "column"
          ? "The figure is cropped or overflows on the right. Reflow and scale so the entire content fits within an IEEE two-column width (~8.5cm). Do not remove content."
          : "The figure is cropped or overflows. Reflow and scale so the entire content fits within full text width (~17cm). Do not remove content.";
      const latex = await refineLaTeX(instruction, output, preferences, refineRefs, generationModel);
      if (latex.trim() !== output.trim()) {
        repairAttemptsRef.current = 0;
        setActiveVersion(versions.length);
        setVersions((prev) => [...prev, { latex, label: `Fit fix ${prev.length}` }]);
      }
    } catch (error) {
      console.error(error);
      toast.error("Auto-fit refine failed");
    } finally {
      setIsRefining(false);
    }
  };

  const persistFigure = () => {
    if (!output || versions.length === 0) return;
    const title =
      input.trim().slice(0, 48) + (input.trim().length > 48 ? "…" : "") || "Untitled figure";
    const saved = saveFigure({
      id: currentFigureId ?? undefined,
      title,
      prompt: input,
      preferences,
      versions,
      activeVersion,
    });
    setCurrentFigureId(saved.id);
  };

  useEffect(() => {
    if (!output) return;

    compileAbortRef.current?.abort();
    const controller = new AbortController();
    compileAbortRef.current = controller;

    const applyResult = async (result: CompileResult) => {
      setPreviewUrl(result.status === "success" ? result.pdfUrl : null);
      setPreviewError(result.status === "error" ? result.log : null);
      setIsPreviewLoading(false);

      if (result.status === "success" && result.pdfUrl) {
        setFitStatus("checking");
        const raster = await pdfUrlToPngDataUrl(result.pdfUrl);
        if (raster && !controller.signal.aborted) {
          const fit = await validateFigureFit(raster, documentFit);
          if (fit) {
            setFitStatus(fit.status);
            if (
              (fit.status === "cropped" || fit.status === "may_overflow") &&
              fitRefineAttemptsRef.current < 1 &&
              (documentFit === "column" || documentFit === "fullpage")
            ) {
              void runAutoFitRefine();
            }
          } else {
            setFitStatus("verified");
          }
        }
        if (!controller.signal.aborted) persistFigure();
      } else if (result.status === "error") {
        setFitStatus("idle");
      }
    };

    const doc = buildPreviewDocument(output, documentFit);
    const cached = compileCacheRef.current.get(doc);
    if (cached) {
      void applyResult(cached);
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
        const repaired = await repairLaTeX(result.log, output, preferences, generationModel);
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
    const busy = isGenerating || isRefining || isPreviewLoading;
    if (!busy) {
      setStageIndex(0);
      return;
    }
    const stages = isRefining
      ? REFINE_STAGES
      : isPreviewLoading && !isGenerating
        ? previewStage === "repairing"
          ? REPAIR_STAGES
          : COMPILE_STAGES
        : GENERATION_STAGES;
    setStageIndex(0);
    const interval = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, stages.length - 1));
    }, 2200);
    return () => clearInterval(interval);
  }, [isGenerating, isRefining, isPreviewLoading, previewStage]);

  const codeBusyMessage = (() => {
    if (isRefining) return REFINE_STAGES[Math.min(stageIndex, REFINE_STAGES.length - 1)];
    if (isGenerating) return GENERATION_STAGES[Math.min(stageIndex, GENERATION_STAGES.length - 1)];
    if (isPreviewLoading && previewStage === "repairing") {
      return REPAIR_STAGES[Math.min(stageIndex, REPAIR_STAGES.length - 1)];
    }
    if (isPreviewLoading) return COMPILE_STAGES[Math.min(stageIndex, COMPILE_STAGES.length - 1)];
    return GENERATION_STAGES[0];
  })();

  const previewSketchLabel = isPreviewLoading
    ? previewStage === "repairing"
      ? "Repairing"
      : "Compiling"
    : isRefining
      ? "Updating"
      : "Generating";

  const previewBusy = isGenerating || isRefining || isPreviewLoading;

  useEffect(() => {
    if (previewBusy) {
      setShowSketchOverlay(true);
      return;
    }
    const timer = window.setTimeout(() => setShowSketchOverlay(false), 520);
    return () => window.clearTimeout(timer);
  }, [previewBusy]);

  useEffect(() => {
    if (!pendingAutoGenerateRef.current) return;
    if (!input.trim()) return;
    pendingAutoGenerateRef.current = false;
    void handleGenerate(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once after handoff hydrate
  }, [input]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages, isGenerating, isRefining, isPreviewLoading]);

  const pipelineLabel =
    pipelineStage === "generating"
      ? isRefining
        ? "Refining…"
        : "Generating…"
      : pipelineStage === "compiling"
        ? "Compiling…"
        : pipelineStage === "repairing"
          ? "Auto-repairing…"
          : pipelineStage === "error"
            ? "Compile failed"
            : pipelineStage === "fit_warn"
              ? "Fit warning"
              : pipelineStage === "fit_ok"
                ? "Ready"
                : "Idle";

  const toggleWorkspaceTheme = () => {
    setWorkspaceDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("texlab-workspace-theme", next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className={`workspace-desk flex h-[100dvh] flex-col overflow-hidden ${workspaceDark ? "dark" : ""}`}>
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--ws-divider)] bg-[var(--ws-bg)] px-3">
        <div className="flex items-center gap-2.5">
          <Link to="/" className="font-heading text-sm font-bold tracking-tighter hover:opacity-80">
            te<span className="font-mono">X</span>lab
          </Link>
          <span className="hidden border border-[var(--ws-input-border)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--ws-text-muted)] sm:inline">
            workspace
          </span>
          <nav className="ml-1 hidden items-center gap-0.5 md:flex" aria-label="Figure type">
            {OUTPUT_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => selectType(option.value)}
                className={`rounded-md px-2 py-0.5 font-mono text-[10px] transition-colors ${
                  resolvedType === option.value
                    ? "bg-[var(--ws-input)] text-[var(--ws-text)]"
                    : "text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </nav>
          <span
            className={`flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
              pipelineStage === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : pipelineStage === "fit_warn"
                  ? "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  : pipelineStage === "fit_ok"
                    ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : pipelineStage === "idle"
                      ? "border-border/70 text-muted-foreground"
                      : "border-primary/30 bg-primary/10 text-foreground"
            }`}
          >
            {(isGenerating || isRefining || isPreviewLoading) && (
              <span className="ws-spinner" aria-hidden />
            )}
            {pipelineLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleWorkspaceTheme}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={workspaceDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={workspaceDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {workspaceDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <FigureHistoryDrawer onRestore={restoreFigure} />
          <Link
            to="/"
            className="px-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Home
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal" autoSaveId="texlab-workspace-desk" className="h-full">
          <ResizablePanel defaultSize={30} minSize={18} maxSize={42} className="min-w-0">
            <aside className="flex h-full min-h-0 flex-col bg-[var(--ws-bg)]">
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--ws-divider)] px-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-text-muted)]">
                    Agent
                  </span>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                  {output ? "Refine" : "Generate"}
                </span>
              </div>

              <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {chatMessages.length === 0 && !isGenerating && (
                  <div className="px-1 py-4">
                    <p className="font-heading text-base font-semibold tracking-tight text-[var(--ws-text)]">
                      What figure should we build?
                    </p>
                    <p className="mt-1.5 font-heading text-sm leading-relaxed text-[var(--ws-text-muted)]">
                      Describe a diagram, table, or plot — teXlab will generate, compile, and fit it.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {FIGURE_TEMPLATES.slice(0, 5).map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            applyTemplate(template.id);
                            setChatMessages([
                              { id: `tpl-${template.id}`, role: "user", content: template.prompt },
                            ]);
                            void handleGenerate(template.prompt);
                          }}
                          className="rounded-lg border border-[var(--ws-input-border)] bg-[var(--ws-bar)] px-2.5 py-1.5 font-mono text-[10px] text-[var(--ws-text-muted)] transition-colors hover:border-[var(--ws-input-border-focus)] hover:bg-[var(--ws-input)] hover:text-[var(--ws-text)]"
                        >
                          {template.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "user" ? (
                      <div className="max-w-[88%] rounded-2xl bg-[var(--ws-input)] px-3.5 py-2.5">
                        <p className="whitespace-pre-wrap font-heading text-[13px] leading-relaxed text-[var(--ws-text)]">
                          {message.content}
                        </p>
                        {message.meta && (
                          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                            {message.meta}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="max-w-[94%]">
                        <p className="mb-1 font-mono text-[10px] text-muted-foreground">teXlab</p>
                        <p className="whitespace-pre-wrap font-heading text-[13px] leading-relaxed text-[var(--ws-text)]">
                          {message.content}
                        </p>
                        {message.meta && (
                          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                            {message.meta}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {(isGenerating || isRefining) && (
                  <div className="flex justify-start">
                    <div className="max-w-[94%]">
                      <p className="mb-1 font-mono text-[10px] text-muted-foreground">teXlab</p>
                      <p className="text-shimmer font-mono text-[11px] font-medium">
                        {isRefining
                          ? REFINE_STAGES[Math.min(stageIndex, REFINE_STAGES.length - 1)]
                          : GENERATION_STAGES[Math.min(stageIndex, GENERATION_STAGES.length - 1)]}
                      </p>
                    </div>
                  </div>
                )}

                {isPreviewLoading && !isGenerating && !isRefining && (
                  <div className="flex justify-start">
                    <div className="max-w-[94%]">
                      <p className="mb-1 font-mono text-[10px] text-muted-foreground">teXlab</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {previewStage === "repairing"
                          ? "Auto-repairing compile errors…"
                          : "Compiling PDF…"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div
                ref={describeCardRef}
                className={`ws-composer shrink-0 px-3 py-3 ${isDraggingOver ? "opacity-95" : ""}`}
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
                <div className={`ws-composer-box transition-colors ${isDraggingOver ? "border-[var(--ws-input-border-focus)]" : ""}`}>
                  {references.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-b border-[var(--ws-input-border)] px-3 pb-2 pt-2.5">
                      {references.map((reference, index) => (
                        <span
                          key={`${reference.name}-${index}`}
                          className="flex items-center gap-1.5 rounded-md border border-[var(--ws-input-border)] bg-[var(--ws-bar)] py-0.5 pl-1 pr-1.5 font-mono text-[10px] text-[var(--ws-text)]"
                        >
                          {reference.kind === "image" ? (
                            <img
                              src={reference.content}
                              alt=""
                              className="h-4 w-4 rounded-sm border border-border/70 object-cover"
                            />
                          ) : (
                            <FileText className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="max-w-[72px] truncate">{reference.name}</span>
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

                  <textarea
                    value={chatDraft}
                    maxLength={output ? 2000 : 4000}
                    onChange={(e) => setChatDraft(e.target.value)}
                    placeholder={
                      output
                        ? 'Ask for a change… e.g. "make boxes wider"'
                        : "Ask teXlab to build a figure…"
                    }
                    rows={3}
                    className="w-full resize-none bg-transparent px-3 py-2.5 font-heading text-sm leading-relaxed text-[var(--ws-text)] placeholder:text-[var(--ws-text-muted)] focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleChatSubmit();
                      }
                    }}
                    disabled={isGenerating || isRefining}
                  />

                  <div className="flex items-center gap-1 px-2 pb-2">
                    <ModelSelector
                      value={generationModel}
                      onChange={(model) => {
                        setGenerationModel(model);
                        saveStoredModel(model);
                      }}
                      disabled={isGenerating || isRefining}
                    />

                    <FormatSelector
                      outputType={resolvedType}
                      styleOptions={STYLE_OPTIONS[resolvedType]}
                      style={resolvedStyle}
                      colorMode={colorMode}
                      density={density}
                      documentFit={documentFit}
                      arrowStyle={arrowStyle}
                      aspectRatio={aspectRatio}
                      onStyleChange={selectStyle}
                      onColorChange={setColorMode}
                      onDensityChange={(v) => setDensity(v)}
                      onDocumentFitChange={(v) => setDocumentFit(v)}
                      onArrowStyleChange={(v) => setArrowStyle(v)}
                      onAspectRatioChange={(v) => setAspectRatio(v)}
                      disabled={isGenerating || isRefining}
                    />

                    <div className="ml-auto flex items-center gap-1">
                      <button
                        ref={attachButtonRef}
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={references.length >= MAX_REFERENCES || isGenerating || isRefining}
                        title="Attach reference"
                        aria-label="Attach reference"
                        className="relative flex h-7 w-7 items-center justify-center rounded-md ws-icon-btn transition-colors disabled:opacity-40"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {references.length > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--ws-send-bg)] px-1 font-mono text-[8px] leading-none text-[var(--ws-send-text)]">
                            {references.length}
                          </span>
                        )}
                      </button>

                      {isGenerating || isRefining || isPreviewLoading ? (
                        <button
                          type="button"
                          className="ws-stop"
                          onClick={handleStop}
                          aria-label="Stop generation"
                          title="Stop"
                        >
                          <Square className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
                        </button>
                      ) : (
                        <Button
                          type="button"
                          size="icon"
                          className="ws-send h-7 w-7 shrink-0 rounded-full border-0 shadow-none"
                          disabled={!chatDraft.trim()}
                          onClick={() => void handleChatSubmit()}
                          aria-label={output ? "Send refine" : "Generate"}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

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
                <p className="mt-1.5 px-0.5 font-mono text-[9px] text-muted-foreground/60">
                  Enter to send · Shift+Enter for newline
                </p>
              </div>
            </aside>
          </ResizablePanel>

          <ResizableHandle className="hidden lg:flex" />

          <ResizablePanel defaultSize={70} minSize={40} className="min-w-0">
            <section className="ws-panel flex h-full min-h-0 flex-col border-l border-[var(--ws-divider)] bg-[var(--ws-bg)]">
              {versions.length > 1 && (
                <div className="flex h-9 shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--ws-divider)] bg-[var(--ws-bg)] px-3">
                  <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {versions.map((version, index) => (
                    <button
                      key={`${version.label}-${index}`}
                      type="button"
                      onClick={() => handleSwitchVersion(index)}
                      className={`shrink-0 rounded-md border px-2.5 py-0.5 font-mono text-[10px] transition-colors ${
                        index === activeVersion
                          ? "border-foreground/50 bg-muted text-foreground"
                          : "border-border/70 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      {version.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="min-h-0 flex-1">
                <ResizablePanelGroup
                  direction="horizontal"
                  autoSaveId="texlab-workspace-code-preview"
                  className="h-full"
                >
                  <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                    <div className="ws-panel flex h-full min-h-0 flex-col">
                      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--ws-divider)] px-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCodeView("source")}
                            className={`font-mono text-[10px] uppercase tracking-widest transition-colors ${
                              codeView === "source"
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Source
                          </button>
                          <span className="text-muted-foreground/30">|</span>
                          <button
                            type="button"
                            onClick={() => setCodeView("paste")}
                            className={`font-mono text-[10px] uppercase tracking-widest transition-colors ${
                              codeView === "paste"
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Paste
                          </button>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {output && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isExporting}
                                onClick={handleDownloadZip}
                                className="h-7 gap-1 rounded-md px-2 font-mono text-[10px] normal-case"
                                title="Download .zip"
                              >
                                <Download className="h-3 w-3" />
                                <span className="hidden sm:inline">.zip</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isExporting}
                                onClick={handleOpenInOverleaf}
                                className="h-7 gap-1 rounded-md px-2 font-mono text-[10px] normal-case"
                                title="Open in Overleaf"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span className="hidden sm:inline">Overleaf</span>
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopy}
                            disabled={!output}
                            className="h-7 rounded-md px-2"
                          >
                            {copied ? (
                              <span className="flex items-center gap-1 font-mono text-[10px]">
                                <Check className="h-3 w-3" /> Copied
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 font-mono text-[10px]">
                                <Copy className="h-3 w-3" /> Copy
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>

                      {isGenerating ? (
                        <BlueprintBusy message={codeBusyMessage} />
                      ) : output ? (
                        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
                          <LatexCode code={codeView === "paste" ? pasteSnippet : output} />
                        </div>
                      ) : (
                        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            Code
                          </p>
                          <p className="max-w-[16rem] font-heading text-sm text-muted-foreground">
                            Your figure source appears here after you generate.
                          </p>
                        </div>
                      )}
                    </div>
                  </ResizablePanel>

                  <ResizableHandle className="hidden lg:flex" />

                  <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                    <div className="ws-panel flex h-full min-h-0 flex-col">
                      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--ws-divider)] px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            Preview
                          </span>
                          {output && !isPreviewLoading && !previewError && (
                            <span
                              className={`rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
                                fitStatus === "verified"
                                  ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : fitStatus === "may_overflow"
                                    ? "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                                    : fitStatus === "cropped"
                                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                                      : "border-border/70 text-muted-foreground"
                              }`}
                            >
                              {fitStatus === "checking"
                                ? "Checking fit…"
                                : fitStatus === "verified"
                                  ? `✓ ${fitBadgeLabel(documentFit)}`
                                  : fitStatus === "may_overflow"
                                    ? "⚠ May overflow"
                                    : fitStatus === "cropped"
                                      ? "✕ Cropped"
                                      : fitBadgeLabel(documentFit)}
                            </span>
                          )}
                        </div>
                        {previewUrl && !previewError && !isPreviewLoading && !isGenerating && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewOpen(true)}
                            className="h-7 gap-1 rounded-md px-2 font-mono text-[10px] normal-case"
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                            Expand
                          </Button>
                        )}
                      </div>

                      <div className="ws-preview-stage relative min-h-0 flex-1 overflow-hidden">
                        {!output && !previewBusy && !showSketchOverlay && (
                          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            PDF preview
                          </p>
                        )}

                        {showSketchOverlay && (
                          <div
                            className={`absolute inset-0 z-10 transition-opacity duration-500 ease-out ${
                              previewBusy ? "opacity-100" : "pointer-events-none opacity-0"
                            }`}
                          >
                            <SketchingPreview fill label={previewSketchLabel} />
                          </div>
                        )}

                        {previewError && !previewBusy && (
                          <div className="absolute inset-0 z-10 flex flex-col overflow-hidden bg-[var(--ws-bg)]">
                            <div className="border-b border-destructive/40 bg-destructive/10 px-3 py-2">
                              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-destructive">
                                Compilation failed
                              </span>
                            </div>
                            <pre className="flex-1 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/80">
                              {previewError}
                            </pre>
                          </div>
                        )}

                        {previewUrl && !previewError && (
                          <>
                            <div
                              className={`ws-preview-paper transition-opacity duration-700 ease-out ${
                                previewBusy ? "opacity-0" : "opacity-100"
                              }`}
                            >
                              <iframe
                                src={`${previewUrl}#view=Fit&toolbar=0`}
                                className="pointer-events-none h-full w-full border-0 bg-white"
                                title="LaTeX Preview"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            {!previewBusy && (
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
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[92vh] w-[min(96vw,1200px)] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-border/70 p-0">
          <DialogHeader className="flex h-9 flex-row items-center justify-between space-y-0 border-b border-border/70 bg-card px-4 pr-12 text-left">
            <DialogTitle className="font-mono text-xs font-normal uppercase tracking-widest text-muted-foreground">
              Preview
            </DialogTitle>
          </DialogHeader>
          <div className="ws-preview-stage min-h-0 flex-1">
            {previewUrl && (
              <div className="ws-preview-paper ws-preview-paper--lg">
                <iframe
                  src={`${previewUrl}#view=Fit&toolbar=0`}
                  className="h-full w-full border-0 bg-white"
                  title="LaTeX Preview (expanded)"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <footer
        aria-label="Status bar"
        className="ws-footer flex h-7 shrink-0 select-none items-stretch justify-between overflow-hidden border-t font-mono text-[11px]"
      >
        <div className="flex items-stretch">
          <span className="flex items-center gap-1.5 border-r border-[var(--ws-divider)] px-3 text-[var(--ws-text)]/80">
            <GitBranch className="h-3 w-3" />
            texlab/main
          </span>
          <span className="flex items-center gap-1.5 px-3">
            {isGenerating || isRefining ? (
              <>
                <span className="ws-spinner" aria-hidden />
                {isRefining ? "refining…" : "generating…"}
              </>
            ) : isPreviewLoading ? (
              <>
                <span className="ws-spinner" aria-hidden />
                {previewStage === "repairing" ? "auto-repairing…" : "compiling…"}
              </>
            ) : previewError ? (
              <>
                <CircleX className="h-3 w-3 text-destructive" />
                compile failed
              </>
            ) : previewUrl ? (
              <>
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                compiled{compileMs !== null ? ` in ${(compileMs / 1000).toFixed(1)}s` : ""}
              </>
            ) : (
              <>
                <Check className="h-3 w-3" />
                ready
              </>
            )}
          </span>
          <span className="hidden items-center gap-2 border-l border-[var(--ws-divider)] px-3 sm:flex">
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
          <span className="flex items-center border-l border-[var(--ws-divider)] px-3">LaTeX</span>
          <span className="hidden items-center border-l border-[var(--ws-divider)] px-3 md:flex">pdfTeX</span>
        </div>
      </footer>
    </div>
  );

};

export default Workspace;
