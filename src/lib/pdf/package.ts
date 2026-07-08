import archiver from "archiver";
import { prisma } from "@/lib/prisma";
import { decryptBuffer, decryptField, encryptBuffer, sha256Hex } from "@/lib/crypto";
import { getStorageDriver, buildGeneratedPdfKey } from "@/lib/storage";
import { detectFormFields, fillAcroForm } from "@/lib/pdf/formFill";
import { renderTextReportPdf } from "@/lib/pdf/textReport";
import {
  buildReviewSummaryReport,
  buildSupportingDocsIndexReport,
  buildAssumptionsWarningsReport,
  buildMissingItemsChecklistReport,
  buildAuditTrailReport,
  type ReviewSummaryLine,
} from "@/lib/pdf/reportGenerator";
import { checkGenerationGate } from "@/lib/validation/engine";
import { recordAuditLog } from "@/lib/audit/log";
import type { PDFFillMethod } from "@prisma/client";

export const AI_ASSISTANCE_DISCLAIMER =
  "This package was prepared with AI assistance based on the documents you uploaded and the values you reviewed and " +
  "confirmed. It is NOT certified tax advice. You remain fully responsible for verifying, signing, and submitting your " +
  "tax declaration to the Geneva cantonal tax administration.";

function decryptOrEmpty(value: string | null): string {
  const decrypted = value ? decryptField(value, "field") : null;
  return decrypted ?? "";
}

function formatValue(value: string, currency: string | null): string {
  if (!value) return "(not provided)";
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && currency) return `${currency} ${numeric.toLocaleString("fr-CH")}`;
  return value;
}

export interface GenerationResult {
  zipStorageKey: string;
  zipSizeBytes: number;
  zipChecksum: string;
  fillMethod: PDFFillMethod;
}

export async function generateFinalPackage(taxCaseId: string, userId: string): Promise<GenerationResult> {
  const gate = await checkGenerationGate(taxCaseId);
  if (!gate.canGenerate) {
    throw new Error(`Cannot generate final package: ${gate.blockingReasons.join("; ")}`);
  }

  const taxCase = await prisma.taxCase.findUniqueOrThrow({ where: { id: taxCaseId } });
  const documents = await prisma.uploadedDocument.findMany({ where: { taxCaseId } });
  const fieldMappings = await prisma.taxFieldMapping.findMany({
    where: { taxCaseId },
    include: { taxSection: true, extractedField: { include: { document: true } } },
  });
  const assumptions = await prisma.assumption.findMany({ where: { taxCaseId } });
  const validationIssues = await prisma.validationIssue.findMany({ where: { taxCaseId } });
  const missingDocuments = await prisma.missingDocument.findMany({ where: { taxCaseId } });
  const confirmations = await prisma.userConfirmation.findMany({
    where: { taxCaseId },
    include: { user: true, extractedField: true, taxFieldMapping: true },
    orderBy: { createdAt: "asc" },
  });

  const storage = getStorageDriver();

  // --- Attempt to fill the current-year blank declaration -------------------
  const blankDeclarationDoc = documents.find((d) => d.classification === "CurrentBlankDeclaration");
  let fillMethod: PDFFillMethod = "NOT_APPLICABLE";
  let completedDeclarationBuffer: Buffer;
  let manualEntryRequired = true;
  let manualEntryReason: string | undefined;

  if (blankDeclarationDoc) {
    const encrypted = await storage.get(blankDeclarationDoc.storageKey);
    const blankBuffer = decryptBuffer(encrypted, "file");
    const detection = await detectFormFields(blankBuffer);

    if (detection.isFillable) {
      const values = fieldMappings
        .map((m) => {
          const matchedField = detection.fields.find(
            (f) =>
              f.name.toLowerCase().includes(m.declarationFieldCode.toLowerCase()) ||
              m.declarationFieldLabel.toLowerCase().includes(f.name.toLowerCase())
          );
          if (!matchedField || matchedField.type !== "text") return null;
          return { acroFormFieldName: matchedField.name, value: decryptOrEmpty(m.mappedValue) };
        })
        .filter((v): v is { acroFormFieldName: string; value: string } => v !== null);

      const outcome = await fillAcroForm(blankBuffer, values);
      completedDeclarationBuffer = outcome.buffer;
      fillMethod = "ACROFORM";
      manualEntryRequired = outcome.skippedFieldNames.length > 0 || values.length < fieldMappings.length;
      manualEntryReason = manualEntryRequired
        ? "Some declaration fields could not be automatically matched to the form and still require manual transcription — see the confirmed values below."
        : undefined;
    } else {
      completedDeclarationBuffer = blankBuffer;
      fillMethod = "MANUAL_REPORT";
      manualEntryReason =
        "This declaration PDF does not contain fillable form fields, so it could not be auto-filled. Use the confirmed values below to complete it by hand.";
    }
  } else {
    completedDeclarationBuffer = await renderTextReportPdf({
      title: "Current Year Declaration — No Blank Form Uploaded",
      subtitle: `Tax year ${taxCase.taxYear}`,
      sections: [
        {
          heading: "Notice",
          lines: [
            "No blank current-year declaration PDF was uploaded for this case, so no form could be filled. Use the confirmed values in tax_review_summary.pdf to complete the official Geneva declaration by hand.",
          ],
        },
      ],
    });
    fillMethod = "MANUAL_REPORT";
    manualEntryReason = "No blank current-year declaration was uploaded.";
  }

  // --- Build review summary lines -------------------------------------------
  const lineFor = (m: (typeof fieldMappings)[number]): ReviewSummaryLine => ({
    sectionLabel: m.taxSection.label,
    fieldLabel: m.declarationFieldLabel,
    value: formatValue(decryptOrEmpty(m.mappedValue), m.mappedCurrency),
    status: m.status,
    sourceDocument: m.extractedField?.document.originalFilename ?? "(manual entry)",
    confidence: m.extractedField?.confidence ?? 1,
  });

  const confirmedLines = fieldMappings.filter((m) => m.status === "confirmed").map(lineFor);
  const editedLines = fieldMappings.filter((m) => m.status === "edited_confirmed").map(lineFor);
  const rejectedLines = fieldMappings.filter((m) => m.status === "rejected").map(lineFor);
  const notApplicableLines = fieldMappings.filter((m) => m.status === "not_applicable").map(lineFor);
  const missingLines = fieldMappings.filter((m) => m.status === "missing").map(lineFor);

  const reviewSummaryPdf = await renderTextReportPdf(
    buildReviewSummaryReport({
      taxYear: taxCase.taxYear,
      canton: taxCase.canton,
      generatedAt: new Date().toISOString(),
      manualEntry: { required: manualEntryRequired, reason: manualEntryReason },
      confirmedLines,
      editedLines,
      rejectedLines,
      notApplicableLines,
      missingLines,
      disclaimer: AI_ASSISTANCE_DISCLAIMER,
    })
  );

  const supportingDocsIndexPdf = await renderTextReportPdf(
    buildSupportingDocsIndexReport({
      taxYear: taxCase.taxYear,
      documents: documents.map((d) => ({
        filename: d.originalFilename,
        classification: d.classification ?? "Unclassified",
        pageCount: d.pageCount,
        uploadedAt: d.createdAt.toISOString(),
      })),
    })
  );

  const assumptionsWarningsPdf = await renderTextReportPdf(
    buildAssumptionsWarningsReport({
      taxYear: taxCase.taxYear,
      assumptions: assumptions.map((a) => ({ description: a.description, rationale: a.rationale })),
      warnings: validationIssues.map((v) => ({ severity: v.severity, message: v.message })),
    })
  );

  const missingItemsChecklistPdf = await renderTextReportPdf(
    buildMissingItemsChecklistReport({
      taxYear: taxCase.taxYear,
      missingDocuments: missingDocuments.map((m) => ({ classification: m.classification, status: m.status, note: m.note })),
    })
  );

  const finalDeclarationConfirmation = confirmations.find((c) => c.note === "FINAL_DECLARATION_ACCEPTED");
  const auditTrailPdf = await renderTextReportPdf(
    buildAuditTrailReport({
      taxYear: taxCase.taxYear,
      confirmations: confirmations.map((c) => ({
        action: c.action,
        itemLabel: c.extractedField?.label ?? c.taxFieldMapping?.declarationFieldLabel ?? "(case-level action)",
        userEmail: c.user.email,
        timestamp: c.createdAt.toISOString(),
        note: c.action === "REQUEST_HELP" || c.note === "FINAL_DECLARATION_ACCEPTED" ? c.note : null,
      })),
      finalDeclarationAcceptedAt: finalDeclarationConfirmation?.createdAt.toISOString() ?? null,
    })
  );

  // --- Persist each generated PDF individually --------------------------------
  const files: Array<{ type: import("@prisma/client").PDFType; filename: string; buffer: Buffer }> = [
    { type: "COMPLETED_DECLARATION", filename: "completed_tax_declaration.pdf", buffer: completedDeclarationBuffer },
    { type: "REVIEW_SUMMARY", filename: "tax_review_summary.pdf", buffer: reviewSummaryPdf },
    { type: "SUPPORTING_DOCS_INDEX", filename: "supporting_documents_index.pdf", buffer: supportingDocsIndexPdf },
    { type: "ASSUMPTIONS_WARNINGS", filename: "assumptions_and_warnings.pdf", buffer: assumptionsWarningsPdf },
    { type: "MISSING_ITEMS_CHECKLIST", filename: "missing_items_checklist.pdf", buffer: missingItemsChecklistPdf },
    { type: "AUDIT_TRAIL", filename: "audit_trail.pdf", buffer: auditTrailPdf },
  ];

  for (const file of files) {
    const pdfRecord = await prisma.generatedPDF.create({
      data: {
        taxCaseId,
        type: file.type,
        storageKey: "",
        sizeBytes: file.buffer.length,
        checksumSha256: sha256Hex(file.buffer),
        fillMethod: file.type === "COMPLETED_DECLARATION" ? fillMethod : "NOT_APPLICABLE",
        generatedByUserId: userId,
      },
    });
    const key = buildGeneratedPdfKey(taxCaseId, pdfRecord.id, file.filename);
    await storage.put(key, encryptBuffer(file.buffer, "file"));
    await prisma.generatedPDF.update({ where: { id: pdfRecord.id }, data: { storageKey: key } });
  }

  // --- Zip everything ----------------------------------------------------------
  const zipBuffer = await zipFiles(files);
  const zipChecksum = sha256Hex(zipBuffer);
  const zipRecord = await prisma.generatedPDF.create({
    data: {
      taxCaseId,
      type: "FINAL_PACKAGE_ZIP",
      storageKey: "",
      sizeBytes: zipBuffer.length,
      checksumSha256: zipChecksum,
      fillMethod,
      generatedByUserId: userId,
    },
  });
  const zipKey = buildGeneratedPdfKey(taxCaseId, zipRecord.id, "final_tax_package.zip");
  await storage.put(zipKey, encryptBuffer(zipBuffer, "file"));
  await prisma.generatedPDF.update({ where: { id: zipRecord.id }, data: { storageKey: zipKey } });

  await prisma.taxCase.update({ where: { id: taxCaseId }, data: { status: "generated" } });
  await recordAuditLog({
    userId,
    taxCaseId,
    action: "PDF_GENERATED",
    entityType: "GeneratedPDF",
    entityId: zipRecord.id,
    metadata: { fillMethod },
  });

  return { zipStorageKey: zipKey, zipSizeBytes: zipBuffer.length, zipChecksum, fillMethod };
}

function zipFiles(files: Array<{ filename: string; buffer: Buffer }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    for (const file of files) {
      archive.append(file.buffer, { name: file.filename });
    }
    archive.finalize();
  });
}
