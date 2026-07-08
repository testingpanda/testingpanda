// pdf-parse ships without types for its internal pagerender hook; treat as any.
const pdfParse = require("pdf-parse");

export interface ParsedPdf {
  numPages: number;
  fullText: string;
  pageTexts: string[];
  /** true if the average extractable text per page is too low to be a real, non-scanned PDF. */
  looksScanned: boolean;
}

const MIN_CHARS_PER_PAGE_THRESHOLD = 25;
const FALLBACK: ParsedPdf = { numPages: 1, fullText: "", pageTexts: [], looksScanned: true };

/**
 * Never throws, and never lets a malformed PDF crash the process. pdf-parse
 * bundles a very old pdfjs build that can (a) throw synchronously on some
 * corrupt/unusual PDFs, or (b) reject a detached internal promise that
 * bypasses a normal try/catch around the awaited call, surfacing as an
 * `unhandledRejection` — which Node terminates the process on by default.
 * An uploaded file must never be able to crash the server, so both failure
 * modes are caught here and degrade to "treat as scanned, needs OCR/manual
 * review" instead.
 */
export async function extractPdfText(buffer: Buffer): Promise<ParsedPdf> {
  const pageTexts: string[] = [];

  return new Promise<ParsedPdf>((resolve) => {
    let settled = false;
    const finish = (result: ParsedPdf) => {
      if (settled) return;
      settled = true;
      process.removeListener("unhandledRejection", onUnhandledRejection);
      resolve(result);
    };
    const onUnhandledRejection = () => finish(FALLBACK);
    process.once("unhandledRejection", onUnhandledRejection);

    Promise.resolve()
      .then(() =>
        pdfParse(buffer, {
          pagerender: async (pageData: any) => {
            const textContent = await pageData.getTextContent();
            const text = textContent.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
            pageTexts.push(text);
            return text;
          },
        })
      )
      .then((data: any) => {
        const numPages: number = data.numpages ?? pageTexts.length;
        const fullText = pageTexts.length > 0 ? pageTexts.join("\n\n") : (data.text ?? "");
        const avgCharsPerPage =
          pageTexts.length > 0 ? pageTexts.reduce((sum, t) => sum + t.trim().length, 0) / pageTexts.length : 0;
        finish({ numPages, fullText, pageTexts, looksScanned: avgCharsPerPage < MIN_CHARS_PER_PAGE_THRESHOLD });
      })
      .catch(() => finish(FALLBACK));
  });
}
