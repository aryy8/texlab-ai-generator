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

const SESSION_KEY = "texlab-workspace-session:v1";

export interface WorkspaceSessionVersion {
  latex: string;
  label: string;
}

export interface WorkspaceSessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: string;
}

export interface WorkspaceSession {
  version: 1;
  input: string;
  versions: WorkspaceSessionVersion[];
  activeVersion: number;
  chatMessages: WorkspaceSessionMessage[];
  outputType: OutputType | null;
  style: string | null;
  colorMode: ColorMode;
  density: Density;
  aspectRatio: AspectRatio;
  arrowStyle: ArrowStyle;
  documentFit: DocumentFit;
  references: Reference[];
  generationModel: GenerationModelId;
  currentFigureId: string | null;
  codeView: "source" | "paste";
  updatedAt: string;
}

export function loadWorkspaceSession(): WorkspaceSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceSession;
    if (!parsed || parsed.version !== 1) return null;
    if (!Array.isArray(parsed.versions) || !Array.isArray(parsed.chatMessages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWorkspaceSession(session: Omit<WorkspaceSession, "version" | "updatedAt">): void {
  try {
    const payload: WorkspaceSession = {
      ...session,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearWorkspaceSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
