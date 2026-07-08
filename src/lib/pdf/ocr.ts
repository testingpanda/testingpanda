import { getEnv } from "@/lib/env";

export interface OcrResult {
  text: string;
  confidence: number;
  attempted: boolean;
  note?: string;
}

export interface OcrProvider {
  recognizeImage(buffer: Buffer): Promise<OcrResult>;
}

/**
 * Default OCR fallback. Returns no text and flags the page as needing manual
 * review rather than fabricating a result — honest degradation instead of a
 * silent wrong guess. Real OCR requires either OCR_PROVIDER=tesseract (for
 * image uploads) or a production PDF-rasterization step (TODO below) for
 * scanned PDF pages.
 */
class StubOcrProvider implements OcrProvider {
  async recognizeImage(): Promise<OcrResult> {
    return {
      text: "",
      confidence: 0,
      attempted: false,
      note: "OCR_PROVIDER=stub: no OCR was attempted. This page requires manual review/transcription.",
    };
  }
}

/**
 * Real OCR for image uploads (JPEG/PNG) via tesseract.js. TODO(production):
 * scanned *PDF* pages still need to be rasterized to images first (e.g. via
 * a poppler-based renderer) before this provider can process them — that
 * rasterization step is not implemented in this MVP, so scanned PDFs
 * currently fall back to the stub path and manual review, while directly
 * uploaded scanned images (JPEG/PNG) DO get real OCR.
 */
class TesseractOcrProvider implements OcrProvider {
  async recognizeImage(buffer: Buffer): Promise<OcrResult> {
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng+fra");
      try {
        const {
          data: { text, confidence },
        } = await worker.recognize(buffer);
        return { text, confidence: confidence / 100, attempted: true };
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      return {
        text: "",
        confidence: 0,
        attempted: true,
        note: `OCR failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  }
}

let cached: OcrProvider | null = null;

export function getOcrProvider(): OcrProvider {
  if (cached) return cached;
  const env = getEnv();
  cached = env.OCR_PROVIDER === "tesseract" ? new TesseractOcrProvider() : new StubOcrProvider();
  return cached;
}
