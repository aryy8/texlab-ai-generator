import type { DocumentFit } from "@/lib/openrouter";

export type FitStatus = "idle" | "checking" | "verified" | "may_overflow" | "cropped";

export interface FitValidationResult {
  status: Exclude<FitStatus, "idle" | "checking">;
  contentWidthRatio: number;
  contentRightRatio: number;
}

const WHITE_THRESHOLD = 248;

function sampleContentBounds(
  imageData: ImageData,
): { left: number; right: number; top: number; bottom: number } | null {
  const { data, width, height } = imageData;
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 16) continue;
      if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) continue;
      found = true;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (!found) return null;
  return { left, right, top, bottom };
}

/** Analyze a rasterized preview image for edge cropping / overflow. */
export async function validateFigureFit(
  imageDataUrl: string,
  documentFit: DocumentFit,
): Promise<FitValidationResult | null> {
  if (documentFit === "snippet" || documentFit === "standalone") {
    return { status: "verified", contentWidthRatio: 0, contentRightRatio: 0 };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const bounds = sampleContentBounds(data);
      if (!bounds) {
        resolve({ status: "verified", contentWidthRatio: 0, contentRightRatio: 0 });
        return;
      }

      const contentWidthRatio = (bounds.right - bounds.left + 1) / canvas.width;
      const contentRightRatio = (bounds.right + 1) / canvas.width;
      const marginRight = 1 - contentRightRatio;

      // Content touching the right edge of the page bitmap suggests cropping.
      if (marginRight < 0.012 && contentWidthRatio > 0.88) {
        resolve({ status: "cropped", contentWidthRatio, contentRightRatio });
        return;
      }

      if (marginRight < 0.04 && contentWidthRatio > 0.82) {
        resolve({ status: "may_overflow", contentWidthRatio, contentRightRatio });
        return;
      }

      resolve({ status: "verified", contentWidthRatio, contentRightRatio });
    };
    img.onerror = () => resolve(null);
    img.src = imageDataUrl;
  });
}
