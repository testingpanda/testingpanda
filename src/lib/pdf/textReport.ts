import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface ReportSection {
  heading: string;
  lines: string[];
}

export interface ReportSpec {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const LINE_HEIGHT = 14;
const BODY_SIZE = 10;
const HEADING_SIZE = 13;
const TITLE_SIZE = 18;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/**
 * Renders a simple, legible, paginated text report as a PDF. Used for every
 * generated report in the final package (review summary, assumptions log,
 * missing items checklist, supporting document index, audit trail) so they
 * remain plain, verifiable documents rather than opaque generated artifacts.
 */
export async function renderTextReportPdf(spec: ReportSpec): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  let page: PDFPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  function newPageIfNeeded(neededHeight: number) {
    if (cursorY - neededHeight < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawLine(text: string, opts: { font: PDFFont; size: number; color?: [number, number, number] }) {
    newPageIfNeeded(LINE_HEIGHT);
    page.drawText(text, {
      x: MARGIN,
      y: cursorY,
      size: opts.size,
      font: opts.font,
      color: rgb(...(opts.color ?? [0, 0, 0])),
    });
    cursorY -= LINE_HEIGHT;
  }

  drawLine(spec.title, { font: boldFont, size: TITLE_SIZE });
  if (spec.subtitle) {
    drawLine(spec.subtitle, { font, size: BODY_SIZE, color: [0.35, 0.35, 0.35] });
  }
  cursorY -= LINE_HEIGHT / 2;

  for (const section of spec.sections) {
    newPageIfNeeded(LINE_HEIGHT * 2);
    cursorY -= LINE_HEIGHT / 2;
    drawLine(section.heading, { font: boldFont, size: HEADING_SIZE });
    if (section.lines.length === 0) {
      drawLine("(none)", { font, size: BODY_SIZE, color: [0.5, 0.5, 0.5] });
    }
    for (const rawLine of section.lines) {
      const wrapped = wrapText(rawLine, font, BODY_SIZE, maxWidth);
      for (const line of wrapped) {
        drawLine(line, { font, size: BODY_SIZE });
      }
    }
  }

  // useObjectStreams: false — produces a classic cross-reference table instead of an
  // object stream. pdf-parse bundles an older pdfjs build that fails to read pdf-lib's
  // default object-stream output ("Unknown compression method in flate stream"), which
  // would otherwise crash re-parsing of our own generated PDFs (e.g. in demo/seed mode).
  const bytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
