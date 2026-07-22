async function readErrorMessage(response: Response): Promise<string> {
    try {
        const data = await response.json();
        if (typeof data?.error === "string") {
            return data.error;
        }
    } catch {
        // Non-JSON error body (e.g. platform error pages); fall through.
    }
    return `Server error: ${response.status}`;
}

export type OutputType = "diagram" | "table" | "equation" | "plot";
export type ColorMode = "monochrome" | "academic" | "pastel" | "vivid";
export type Density = "compact" | "normal" | "detailed";
export type AspectRatio = "auto" | "square" | "landscape" | "portrait" | "wide";
export type ArrowStyle = "solid" | "stealth" | "dashed" | "numbered";
export type DocumentFit = "standalone" | "snippet" | "column" | "fullpage";

export interface GenerationPreferences {
    outputType: OutputType;
    style: string;
    colorMode: ColorMode;
    density: Density;
    aspectRatio: AspectRatio;
    arrowStyle: ArrowStyle;
    documentFit: DocumentFit;
}

export interface Reference {
    kind: "image" | "text";
    name: string;
    // Data URL for images, raw text for text references.
    content: string;
}

type GenerationMode = "generate" | "refine" | "repair";

export type GenerationModel = import("@/lib/models").GenerationModelId;

async function requestLatex(body: {
    prompt: string;
    preferences: GenerationPreferences;
    mode?: GenerationMode;
    baseLatex?: string;
    references?: Reference[];
    model?: GenerationModel;
}): Promise<string> {
    const response = await fetch("/api/generate-latex", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response));
    }

    const data = await response.json();
    return data.content;
}

export const generateLaTeX = (
    prompt: string,
    preferences: GenerationPreferences,
    references: Reference[] = [],
    model: GenerationModel = "auto",
): Promise<string> => requestLatex({ prompt, preferences, references, model });

export const refineLaTeX = (
    instruction: string,
    baseLatex: string,
    preferences: GenerationPreferences,
    references: Reference[] = [],
    model: GenerationModel = "auto",
): Promise<string> => requestLatex({ prompt: instruction, preferences, mode: "refine", baseLatex, references, model });

export const repairLaTeX = (
    errorLog: string,
    baseLatex: string,
    preferences: GenerationPreferences,
    model: GenerationModel = "auto",
): Promise<string> => requestLatex({ prompt: errorLog, preferences, mode: "repair", baseLatex, model });
