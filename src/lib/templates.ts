import type { AspectRatio, ArrowStyle, ColorMode, Density, DocumentFit, OutputType } from "@/lib/openrouter";
import templatesJson from "./templates.json";

export interface FigureTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  outputType: OutputType;
  style: string;
  colorMode: ColorMode;
  density: Density;
  aspectRatio: AspectRatio;
  documentFit: DocumentFit;
  arrowStyle: ArrowStyle;
  /** Compiled preview PNG served from /public/templates/{id}.png */
  previewSrc: string;
}

export const FIGURE_TEMPLATES: FigureTemplate[] = (
  templatesJson as Omit<FigureTemplate, "previewSrc">[]
).map((t) => ({
  ...t,
  previewSrc: `/templates/${t.id}.png`,
}));

export function templatePreferences(template: FigureTemplate) {
  return {
    outputType: template.outputType,
    style: template.style,
    colorMode: template.colorMode,
    density: template.density,
    aspectRatio: template.aspectRatio,
    arrowStyle: template.arrowStyle,
    documentFit: template.documentFit,
  };
}
