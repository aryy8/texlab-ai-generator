import type {
  AspectRatio,
  ArrowStyle,
  ColorMode,
  Density,
  DocumentFit,
  OutputType,
  Reference,
} from "@/lib/openrouter";
import type { GenerationModelId } from "@/lib/models";

export const WORKSPACE_HANDOFF_KEY = "texlab-workspace-handoff";

export interface WorkspacePreferences {
  outputType: OutputType | null;
  style: string | null;
  colorMode: ColorMode;
  density: Density;
  aspectRatio: AspectRatio;
  arrowStyle: ArrowStyle;
  documentFit: DocumentFit;
}

export interface WorkspaceHandoff {
  prompt: string;
  preferences: WorkspacePreferences;
  references: Reference[];
  generationModel: GenerationModelId;
  /** When true, workspace starts generation on mount. */
  autoGenerate: boolean;
  templateId?: string;
}

export function saveWorkspaceHandoff(handoff: WorkspaceHandoff): void {
  try {
    sessionStorage.setItem(WORKSPACE_HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    // Quota / private mode — workspace can still use location state.
  }
}

export function consumeWorkspaceHandoff(): WorkspaceHandoff | null {
  try {
    const raw = sessionStorage.getItem(WORKSPACE_HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(WORKSPACE_HANDOFF_KEY);
    return JSON.parse(raw) as WorkspaceHandoff;
  } catch {
    return null;
  }
}
