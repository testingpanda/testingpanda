import { prisma } from "@/lib/prisma";
import { getStorageDriver } from "@/lib/storage";
import { decryptBuffer, encryptField } from "@/lib/crypto";
import { extractPdfText } from "@/lib/pdf/textExtract";
import { getOcrProvider } from "@/lib/pdf/ocr";
import { classifyDocument } from "@/lib/extraction/classify";
import { extractDocumentFields } from "@/lib/extraction/extract";
import { mapExtractedFieldToDeclaration } from "@/lib/extraction/mapping";
import { recomputeCaseStatus } from "@/lib/validation/engine";
import { CONFIDENCE_REVIEW_THRESHOLD } from "@/lib/extraction/constants";
import { FIELD_SPECS } from "@/lib/extraction/fieldSpecs";
import { recordAuditLog } from "@/lib/audit/log";
import type { Canton, UploadedDocument, ExtractionMethod, ItemStatus } from "@prisma/client";

/**
 * Given a document and its already-resolved plain text (however it was
 * obtained — native PDF text, OCR, or in demo/seed mode, a known source
 * string), classifies it if needed, extracts structured fields, stores
 * them, and maps them onto the declaration. Shared by the real upload
 * pipeline (runExtractionPipeline below) and prisma/seed.ts, so demo data
 * goes through the exact same extraction/validation/mapping logic as a real
 * upload — the only thing seed.ts skips is PDF text re-parsing.
 */
export async function classifyAndExtractFields(
  document: UploadedDocument,
  fullText: string,
  taxCaseCanton: Canton,
  taxCaseTaxYear: number
): Promise<void> {
  let classification = document.classification;
  if (!classification) {
    const result = await classifyDocument(fullText, document.originalFilename);
    classification = result.classification;
    await prisma.uploadedDocument.update({
      where: { id: document.id },
      data: { classification: result.classification, classificationConfidence: result.confidence, classificationSource: "AI" },
    });
    await recordAuditLog({
      userId: document.uploadedByUserId,
      taxCaseId: document.taxCaseId,
      action: "DOCUMENT_CLASSIFIED",
      entityType: "UploadedDocument",
      entityId: document.id,
      metadata: { classification: result.classification, confidence: result.confidence },
    });
  }

  if ((FIELD_SPECS[classification] ?? []).length === 0) {
    await prisma.uploadedDocument.update({ where: { id: document.id }, data: { status: "EXTRACTED" } });
    await recomputeCaseStatus(document.taxCaseId);
    return;
  }

  await prisma.uploadedDocument.update({ where: { id: document.id }, data: { status: "EXTRACTING" } });
  const extraction = await extractDocumentFields(classification, fullText);

  if (extraction.status === "failed") {
    await prisma.uploadedDocument.update({ where: { id: document.id }, data: { status: "EXTRACTION_FAILED" } });
    await recordAuditLog({
      userId: document.uploadedByUserId,
      taxCaseId: document.taxCaseId,
      action: "DOCUMENT_EXTRACTED",
      entityType: "UploadedDocument",
      entityId: document.id,
      metadata: { outcome: "failed" },
    });
    await recomputeCaseStatus(document.taxCaseId);
    return;
  }

  const refreshedDocument = await prisma.uploadedDocument.findUniqueOrThrow({ where: { id: document.id } });
  const specs = FIELD_SPECS[classification];
  for (const spec of specs) {
    const entry = extraction.records[spec.key];
    if (!entry) continue;

    const status: ItemStatus =
      entry.value === null ? "unresolved" : entry.confidence >= CONFIDENCE_REVIEW_THRESHOLD ? "extracted" : "needs_review";

    const extractionMethodValue: ExtractionMethod = refreshedDocument.textExtractionMethod === "OCR" ? "LLM_OCR" : "LLM";

    const created = await prisma.extractedField.create({
      data: {
        taxCaseId: document.taxCaseId,
        documentId: document.id,
        fieldKey: spec.key,
        label: spec.label,
        // `value` is a required column, so "nothing found" must still be real ciphertext of ""
        // — never a raw empty string, which is not valid AES-GCM ciphertext and would make
        // every later decryptField(field.value) call throw (see src/lib/crypto.ts).
        value: encryptField(entry.value === null ? "" : String(entry.value), "field")!,
        normalizedValue: encryptField(entry.value === null ? null : String(entry.value), "field"),
        currency: entry.currency ?? null,
        period: entry.period ?? null,
        confidence: entry.confidence,
        evidenceExcerpt: encryptField(entry.evidenceExcerpt, "field"),
        extractionMethod: extractionMethodValue,
        needsUserConfirmation: status !== "extracted",
        status,
      },
    });

    await mapExtractedFieldToDeclaration(created, taxCaseCanton, taxCaseTaxYear, classification);
  }

  await prisma.uploadedDocument.update({ where: { id: document.id }, data: { status: "EXTRACTED" } });
  await recordAuditLog({
    userId: document.uploadedByUserId,
    taxCaseId: document.taxCaseId,
    action: "DOCUMENT_EXTRACTED",
    entityType: "UploadedDocument",
    entityId: document.id,
    metadata: { outcome: "success", fieldCount: specs.length },
  });
}

/**
 * The full per-document extraction pipeline: decrypt → parse text → OCR
 * fallback if needed → classify (unless user-designated) → extract
 * structured fields → map to declaration sections. Every step degrades
 * gracefully (never throws the whole pipeline away) because a single messy
 * document must not block review of everything else in the case.
 */
export async function runExtractionPipeline(documentId: string): Promise<void> {
  const document = await prisma.uploadedDocument.findUniqueOrThrow({ where: { id: documentId }, include: { taxCase: true } });

  try {
    const storage = getStorageDriver();
    const encrypted = await storage.get(document.storageKey);
    const buffer = decryptBuffer(encrypted, "file");

    let fullText = "";
    let pageTexts: string[] = [];
    let extractionMethod: "NATIVE" | "OCR" | "MIXED" | "NONE" = "NATIVE";
    let pageCount = 1;

    if (document.mimeType === "application/pdf") {
      const parsed = await extractPdfText(buffer);
      pageCount = parsed.numPages;
      pageTexts = parsed.pageTexts;
      fullText = parsed.fullText;

      if (parsed.looksScanned) {
        const ocr = getOcrProvider();
        const ocrResult = await ocr.recognizeImage(buffer);
        extractionMethod = ocrResult.attempted && ocrResult.text ? "OCR" : "NONE";
        if (ocrResult.text) {
          fullText = `${fullText}\n${ocrResult.text}`;
          pageTexts = pageTexts.length > 0 ? pageTexts : [ocrResult.text];
        }
        for (let i = 0; i < Math.max(pageTexts.length, 1); i++) {
          await prisma.documentPage.upsert({
            where: { documentId_pageNumber: { documentId, pageNumber: i + 1 } },
            create: {
              documentId,
              pageNumber: i + 1,
              rawText: encryptField(pageTexts[i] ?? ocrResult.text ?? "", "field"),
              ocrApplied: true,
              ocrConfidence: ocrResult.confidence,
            },
            update: {},
          });
        }
      } else {
        for (let i = 0; i < pageTexts.length; i++) {
          await prisma.documentPage.upsert({
            where: { documentId_pageNumber: { documentId, pageNumber: i + 1 } },
            create: { documentId, pageNumber: i + 1, rawText: encryptField(pageTexts[i], "field"), ocrApplied: false },
            update: {},
          });
        }
      }
    } else {
      // Directly uploaded image (e.g. a photographed receipt) — always OCR.
      const ocr = getOcrProvider();
      const ocrResult = await ocr.recognizeImage(buffer);
      fullText = ocrResult.text;
      extractionMethod = ocrResult.attempted && ocrResult.text ? "OCR" : "NONE";
      await prisma.documentPage.upsert({
        where: { documentId_pageNumber: { documentId, pageNumber: 1 } },
        create: {
          documentId,
          pageNumber: 1,
          rawText: encryptField(ocrResult.text, "field"),
          ocrApplied: true,
          ocrConfidence: ocrResult.confidence,
        },
        update: {},
      });
    }

    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: { pageCount, textExtractionMethod: extractionMethod },
    });

    await classifyAndExtractFields(document, fullText, document.taxCase.canton, document.taxCase.taxYear);
  } catch {
    await prisma.uploadedDocument.update({ where: { id: documentId }, data: { status: "EXTRACTION_FAILED" } });
  } finally {
    await recomputeCaseStatus(document.taxCaseId);
  }
}
