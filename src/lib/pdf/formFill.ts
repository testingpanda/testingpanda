import { PDFDocument, PDFTextField, PDFCheckBox } from "pdf-lib";

export interface DetectedFormField {
  name: string;
  type: "text" | "checkbox" | "other";
}

export interface FormDetectionResult {
  isFillable: boolean;
  fields: DetectedFormField[];
}

/** Structural inspection only — never guesses at fields, just reports what pdf-lib actually finds. */
export async function detectFormFields(pdfBuffer: Buffer): Promise<FormDetectionResult> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields().map((f) => ({
      name: f.getName(),
      type: (f instanceof PDFTextField ? "text" : f instanceof PDFCheckBox ? "checkbox" : "other") as
        | "text"
        | "checkbox"
        | "other",
    }));
    return { isFillable: fields.length > 0, fields };
  } catch {
    return { isFillable: false, fields: [] };
  }
}

export interface FieldFillValue {
  acroFormFieldName: string;
  value: string;
}

export interface FormFillOutcome {
  buffer: Buffer;
  filledFieldNames: string[];
  skippedFieldNames: string[];
}

/**
 * Best-effort AcroForm fill: only fields that structurally exist on the PDF
 * and were explicitly mapped (TaxFieldMapping.acroFormFieldName) get
 * written. Anything else is reported as skipped rather than silently
 * dropped, so it surfaces in the manual-entry report.
 */
export async function fillAcroForm(pdfBuffer: Buffer, values: FieldFillValue[]): Promise<FormFillOutcome> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const filled: string[] = [];
  const skipped: string[] = [];

  for (const { acroFormFieldName, value } of values) {
    try {
      const field = form.getField(acroFormFieldName);
      if (field instanceof PDFTextField) {
        field.setText(value);
        filled.push(acroFormFieldName);
      } else if (field instanceof PDFCheckBox) {
        const truthy = ["true", "1", "yes", "oui"].includes(value.toLowerCase());
        if (truthy) field.check();
        else field.uncheck();
        filled.push(acroFormFieldName);
      } else {
        skipped.push(acroFormFieldName);
      }
    } catch {
      skipped.push(acroFormFieldName);
    }
  }

  // Keep the form fields visible/editable in the output rather than flattening,
  // so the user can still adjust values by hand before printing if needed.
  // useObjectStreams: false maximizes compatibility with other PDF readers/parsers.
  const bytes = await pdfDoc.save({ useObjectStreams: false });
  return { buffer: Buffer.from(bytes), filledFieldNames: filled, skippedFieldNames: skipped };
}
