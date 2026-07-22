/** User-selectable OpenRouter models (paid tier). "auto" uses server fallback chain. */
export type GenerationModelId =
  | "auto"
  | "openai/gpt-4o-mini"
  | "openai/gpt-5-mini"
  | "google/gemini-2.5-flash"
  | "google/gemini-2.5-pro"
  | "google/gemini-3-flash-preview";

export interface GenerationModelOption {
  id: Exclude<GenerationModelId, "auto">;
  label: string;
  description: string;
  vision: boolean;
}

export const GENERATION_MODELS: GenerationModelOption[] = [
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    description: "Fast and reliable for TikZ, tables, and plots",
    vision: true,
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 mini",
    description: "Stronger reasoning, slightly slower",
    vision: true,
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Very fast, good for quick iterations",
    vision: true,
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Higher quality for complex diagrams",
    vision: true,
  },
  {
    id: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    description: "Latest flash model preview",
    vision: true,
  },
];

const MODEL_LABELS = Object.fromEntries(
  GENERATION_MODELS.map((m) => [m.id, m.label]),
) as Record<string, string>;

export function modelDisplayName(id: GenerationModelId): string {
  if (id === "auto") return "Auto";
  return MODEL_LABELS[id] ?? id.split("/").pop() ?? id;
}

export const MODEL_STORAGE_KEY = "texlab-generation-model";

export function loadStoredModel(): GenerationModelId {
  try {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    if (stored === "auto" || GENERATION_MODELS.some((m) => m.id === stored)) {
      return stored as GenerationModelId;
    }
  } catch {
    /* ignore */
  }
  return "auto";
}

export function saveStoredModel(id: GenerationModelId) {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
