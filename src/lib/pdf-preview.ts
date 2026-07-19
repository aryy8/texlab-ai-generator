/**
 * Rasterize the first page of a PDF blob URL into a JPEG data URL so a
 * vision model can "see" the current preview during refine.
 * pdfjs-dist is loaded on demand to keep the initial bundle small.
 */
export async function pdfUrlToPngDataUrl(
  pdfUrl: string,
  maxWidth = 1200,
): Promise<string | null> {
  try {
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
    const pdfWorker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    GlobalWorkerOptions.workerSrc = pdfWorker;

    const loadingTask = getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / unscaled.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) return null;

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch (error) {
    console.warn("Failed to rasterize preview PDF for refine:", error);
    return null;
  }
}
