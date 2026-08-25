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

function isAbortError(error: unknown): boolean {
    return (
        (error instanceof DOMException && error.name === "AbortError")
        || (error instanceof Error && error.name === "AbortError")
    );
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

/**
 * OpenTikZ pipeline (retrieve → generate → compile → judge).
 * Used for fresh diagram generation from the web app.
 */
async function requestOpenTikzGenerate(prompt: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
        signal,
    });

    let data: Record<string, unknown> = {};
    try {
        data = await response.json();
    } catch {
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        throw new Error("The generation pipeline returned an invalid response.");
    }

    if (!response.ok) {
        if (typeof data.error === "string" && data.error.trim()) {
            throw new Error(data.error);
        }
        if (typeof data.compileLog === "string" && data.compileLog.trim()) {
            const lines = data.compileLog
                .split("\n")
                .filter((l) => /^!/.test(l) || /^l\.\d+/.test(l))
                .slice(0, 6)
                .join("\n");
            throw new Error(lines || "LaTeX compilation failed. Try refining the prompt.");
        }
        throw new Error(`Server error: ${response.status}`);
    }

    const tex = typeof data.tex === "string"
        ? data.tex
        : typeof data.content === "string"
            ? data.content
            : "";
    if (!tex.trim()) {
        throw new Error("The generation pipeline returned empty LaTeX.");
    }
    return tex;
}

async function requestLatex(body: {
    prompt: string;
    preferences: GenerationPreferences;
    mode?: GenerationMode;
    baseLatex?: string;
    references?: Reference[];
    model?: GenerationModel;
}, signal?: AbortSignal): Promise<string> {
    const response = await fetch("/api/generate-latex", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
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
    signal?: AbortSignal,
): Promise<string> => {
    // Diagrams go through the OpenTikZ retrieve/generate pipeline.
    // Tables / equations / plots keep the classic generate-latex path.
    if (preferences.outputType === "diagram") {
        return requestOpenTikzGenerate(prompt, signal);
    }
    return requestLatex({ prompt, preferences, references, model }, signal);
};

export const refineLaTeX = (
    instruction: string,
    baseLatex: string,
    preferences: GenerationPreferences,
    references: Reference[] = [],
    model: GenerationModel = "auto",
    signal?: AbortSignal,
): Promise<string> => requestLatex({ prompt: instruction, preferences, mode: "refine", baseLatex, references, model }, signal);

export const repairLaTeX = (
    errorLog: string,
    baseLatex: string,
    preferences: GenerationPreferences,
    model: GenerationModel = "auto",
    signal?: AbortSignal,
): Promise<string> => requestLatex({ prompt: errorLog, preferences, mode: "repair", baseLatex, model }, signal);

export { isAbortError };
