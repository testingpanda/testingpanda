import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface OverlayPlacement {
  pageIndex: number; // 0-based
  x: number;
  y: number;
  text: string;
  fontSize?: number;
}

/**
 * Draws text at explicit, pre-configured coordinates on a non-fillable PDF.
 * Deliberately requires the caller to supply real coordinates (see
 * src/lib/taxSections/geneva.ts `overlayCoordinates`) — this module never
 * guesses positions. If no coordinates are configured for a given canton/
 * form version, the caller should skip overlay entirely and fall back to
 * the manual-entry report instead of placing text at a guessed location.
 */
export async function overlayValues(pdfBuffer: Buffer, placements: OverlayPlacement[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const placement of placements) {
    const page = pages[placement.pageIndex];
    if (!page) continue;
    page.drawText(placement.text, {
      x: placement.x,
      y: placement.y,
      size: placement.fontSize ?? 10,
      font,
      color: rgb(0.05, 0.05, 0.45),
    });
  }

  const bytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
