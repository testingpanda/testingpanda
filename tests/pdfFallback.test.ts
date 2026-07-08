import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { detectFormFields, fillAcroForm } from "@/lib/pdf/formFill";
import { renderTextReportPdf } from "@/lib/pdf/textReport";

async function buildFillablePdf(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([300, 300]);
  const form = pdfDoc.getForm();
  const field = form.createTextField("salary.gross");
  field.addToPage(page, { x: 10, y: 10, width: 200, height: 20 });
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

describe("PDF form-fill fallback logic", () => {
  it("detects a fillable AcroForm PDF and its field names", async () => {
    const buffer = await buildFillablePdf();
    const detection = await detectFormFields(buffer);
    expect(detection.isFillable).toBe(true);
    expect(detection.fields.map((f) => f.name)).toContain("salary.gross");
  });

  it("fills a matched text field and reports it as filled, not skipped", async () => {
    const buffer = await buildFillablePdf();
    const outcome = await fillAcroForm(buffer, [{ acroFormFieldName: "salary.gross", value: "95000" }]);
    expect(outcome.filledFieldNames).toContain("salary.gross");
    expect(outcome.skippedFieldNames).toHaveLength(0);

    const filledDoc = await PDFDocument.load(outcome.buffer);
    const field = filledDoc.getForm().getTextField("salary.gross");
    expect(field.getText()).toBe("95000");
  });

  it("reports an unmatched field name as skipped rather than silently dropping it", async () => {
    const buffer = await buildFillablePdf();
    const outcome = await fillAcroForm(buffer, [{ acroFormFieldName: "does.not.exist", value: "1" }]);
    expect(outcome.skippedFieldNames).toContain("does.not.exist");
    expect(outcome.filledFieldNames).toHaveLength(0);
  });

  it("a plain, non-form PDF is correctly detected as not fillable (falls back to manual report)", async () => {
    const plainPdf = await renderTextReportPdf({ title: "Plain report", sections: [{ heading: "Section", lines: ["a line"] }] });
    const detection = await detectFormFields(plainPdf);
    expect(detection.isFillable).toBe(false);
    expect(detection.fields).toHaveLength(0);
  });

  it("never fabricates a fill outcome for a malformed/non-PDF buffer — it degrades safely", async () => {
    const garbage = Buffer.from("not a pdf at all");
    const detection = await detectFormFields(garbage);
    expect(detection.isFillable).toBe(false);
  });
});
