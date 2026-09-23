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

/** In-flight job so leaving Home mid-run can restore / resume. */
export interface WorkspaceSessionBusy {
  kind: "generate" | "refine";
  prompt: string;
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
  busy?: WorkspaceSessionBusy | null;
  /** Last successful preview PDF (base64) so Home→Workspace skips recompile loading. */
  previewPdfBase64?: string | null;
  updatedAt: string;
}

export type WorkspaceSessionPayload = Omit<WorkspaceSession, "version" | "updatedAt">;

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

export function saveWorkspaceSession(session: WorkspaceSessionPayload): void {
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

const MAX_PREVIEW_BYTES = 1_400_000;

/** Encode a blob: PDF URL for session storage; null if too large / failed. */
export async function pdfUrlToSessionBase64(pdfUrl: string): Promise<string | null> {
  try {
    const buf = await fetch(pdfUrl).then((r) => r.arrayBuffer());
    if (buf.byteLength > MAX_PREVIEW_BYTES) return null;
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

export function sessionBase64ToPdfUrl(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

