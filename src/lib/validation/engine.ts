import type { ConfirmationAction, ItemStatus, TaxCaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/crypto";
import { CONFIDENCE_REVIEW_THRESHOLD, UNRESOLVED_ITEM_STATUSES } from "@/lib/extraction/constants";
import { getCantonConfig } from "@/lib/taxSections/geneva";

// ---------------------------------------------------------------------------
// Confirmation state machine
// ---------------------------------------------------------------------------

/**
 * Pure function mapping a user action onto the resulting item status. Kept
 * pure and side-effect free so it's directly unit-testable (see
 * tests/confirmationStateMachine.test.ts) independent of Prisma.
 */
export function applyConfirmationAction(action: ConfirmationAction): ItemStatus | null {
  switch (action) {
    case "CONFIRM":
      return "confirmed";
    case "EDIT_CONFIRM":
      return "edited_confirmed";
    case "REJECT":
      return "rejected";
    case "NOT_APPLICABLE":
      return "not_applicable";
    case "MARK_MISSING":
      return "missing";
    case "REQUEST_HELP":
      return null; // informational only, does not change status
    default:
      return null;
  }
}

export function isResolvedStatus(status: ItemStatus): boolean {
  return !(UNRESOLVED_ITEM_STATUSES as readonly string[]).includes(status);
}

// ---------------------------------------------------------------------------
// Validation rule engine
// ---------------------------------------------------------------------------

export async function runValidation(taxCaseId: string): Promise<void> {
  const taxCase = await prisma.taxCase.findUniqueOrThrow({ where: { id: taxCaseId } });
  const [documents, extractedFields, fieldMappings, sections] = await Promise.all([
    prisma.uploadedDocument.findMany({ where: { taxCaseId } }),
    prisma.extractedField.findMany({ where: { taxCaseId }, include: { document: true } }),
    prisma.taxFieldMapping.findMany({ where: { taxCaseId }, include: { taxSection: true, extractedField: { include: { document: true } } } }),
    getCantonConfig(taxCase.canton).sections,
  ]);

  const issues: Array<{
    type: import("@prisma/client").ValidationIssueType;
    severity: import("@prisma/client").ValidationSeverity;
    message: string;
    relatedExtractedFieldId?: string;
    relatedTaxFieldMappingId?: string;
  }> = [];

  // 1. Missing required fields: every required section must have at least one resolved mapping.
  for (const section of sections.filter((s) => s.required)) {
    const mappingsForSection = fieldMappings.filter((m) => m.taxSection.key === section.key);
    const hasResolved = mappingsForSection.some((m) => isResolvedStatus(m.status));
    if (mappingsForSection.length === 0 || !hasResolved) {
      issues.push({
        type: "MISSING_REQUIRED_FIELD",
        severity: "BLOCKING",
        message: `Required section "${section.label}" has no confirmed information yet.`,
      });
    }
  }

  // 2. Duplicate documents (identical file checksum uploaded more than once).
  const byChecksum = new Map<string, typeof documents>();
  for (const doc of documents) {
    byChecksum.set(doc.checksumSha256, [...(byChecksum.get(doc.checksumSha256) ?? []), doc]);
  }
  for (const [, docs] of byChecksum) {
    if (docs.length > 1) {
      issues.push({
        type: "DUPLICATE_DOCUMENT",
        severity: "WARNING",
        message: `${docs.length} uploaded files appear to be identical copies ("${docs[0].originalFilename}").`,
      });
    }
  }

  // 3. Duplicate deductions: two mappings under the same declaration code with the same value from different documents.
  const byCode = new Map<string, typeof fieldMappings>();
  for (const m of fieldMappings) {
    byCode.set(m.declarationFieldCode, [...(byCode.get(m.declarationFieldCode) ?? []), m]);
  }
  for (const [code, mappings] of byCode) {
    const seen = new Map<string, string>(); // value -> documentId
    for (const m of mappings) {
      const value = decryptField(m.mappedValue, "field");
      const docId = m.extractedField?.documentId;
      if (!value || !docId) continue;
      const priorDoc = seen.get(value);
      if (priorDoc && priorDoc !== docId) {
        issues.push({
          type: "DUPLICATE_DEDUCTION",
          severity: "WARNING",
          message: `Declaration field ${code} has the same value from two different source documents — check for a possible duplicate.`,
          relatedTaxFieldMappingId: m.id,
        });
      }
      seen.set(value, docId);
    }
  }

  // 4. Currency inconsistency.
  for (const f of extractedFields) {
    if (f.currency && f.currency !== "CHF") {
      issues.push({
        type: "CURRENCY_INCONSISTENCY",
        severity: "WARNING",
        message: `"${f.label}" was extracted in ${f.currency}, not CHF. Verify the conversion before confirming.`,
        relatedExtractedFieldId: f.id,
      });
    }
  }

  // 5. Negative / impossible values.
  for (const f of extractedFields) {
    const decrypted = decryptField(f.value, "field");
    const numeric = decrypted !== null ? Number(decrypted) : NaN;
    if (!Number.isNaN(numeric) && numeric < 0) {
      issues.push({
        type: "IMPOSSIBLE_VALUE",
        severity: "BLOCKING",
        message: `"${f.label}" has a negative value, which is not valid for this field.`,
        relatedExtractedFieldId: f.id,
      });
    }
  }

  // 6. Unsupported / low-confidence classification.
  for (const doc of documents) {
    if (doc.classification === "Other" && (doc.classificationConfidence ?? 0) < 0.4) {
      issues.push({
        type: "UNSUPPORTED_DOCUMENT_TYPE",
        severity: "INFO",
        message: `"${doc.originalFilename}" could not be confidently classified. Please verify its type manually.`,
      });
    }
  }

  // 7. Low-confidence extractions still unresolved.
  for (const f of extractedFields) {
    if (f.confidence < CONFIDENCE_REVIEW_THRESHOLD && !isResolvedStatus(f.status)) {
      issues.push({
        type: "LOW_CONFIDENCE_EXTRACTION",
        severity: "WARNING",
        message: `"${f.label}" was extracted with low confidence (${Math.round(f.confidence * 100)}%) and needs your review.`,
        relatedExtractedFieldId: f.id,
      });
    }
  }

  // 8. Unconfirmed values on required sections block generation.
  for (const m of fieldMappings) {
    if (!isResolvedStatus(m.status) && m.taxSection.required) {
      issues.push({
        type: "UNCONFIRMED_VALUE",
        severity: "BLOCKING",
        message: `"${m.declarationFieldLabel}" has not been confirmed yet.`,
        relatedTaxFieldMappingId: m.id,
      });
    } else if (!isResolvedStatus(m.status)) {
      issues.push({
        type: "UNCONFIRMED_VALUE",
        severity: "WARNING",
        message: `"${m.declarationFieldLabel}" has not been confirmed yet.`,
        relatedTaxFieldMappingId: m.id,
      });
    }
  }

  // 9. Previous-year comparison (inconsistencies + unusual changes).
  await comparePriorYear(taxCaseId, issues);

  await prisma.$transaction([
    prisma.validationIssue.deleteMany({ where: { taxCaseId } }),
    prisma.validationIssue.createMany({
      data: issues.map((i) => ({
        taxCaseId,
        type: i.type,
        severity: i.severity,
        message: i.message,
        relatedExtractedFieldId: i.relatedExtractedFieldId,
        relatedTaxFieldMappingId: i.relatedTaxFieldMappingId,
      })),
    }),
  ]);

  await recomputeCaseStatus(taxCaseId);
}

const PRIOR_YEAR_COMPARISONS: Array<{ priorFieldKey: string; currentSectionKey: string; label: string; documentClassification: string }> = [
  { priorFieldKey: "priorThirdPillarContribution", currentSectionKey: "THIRD_PILLAR", label: "3rd pillar contribution", documentClassification: "ThirdPillar" },
  { priorFieldKey: "priorMortgageInterest", currentSectionKey: "DEDUCTIONS_MORTGAGE_INTEREST", label: "mortgage interest", documentClassification: "Mortgage" },
  { priorFieldKey: "priorChildcareCosts", currentSectionKey: "DEDUCTIONS_CHILDCARE", label: "childcare costs", documentClassification: "Childcare" },
  { priorFieldKey: "priorDonations", currentSectionKey: "DEDUCTIONS_DONATIONS", label: "donations", documentClassification: "Donation" },
];

async function comparePriorYear(taxCaseId: string, issues: Array<{ type: any; severity: any; message: string }>) {
  const priorDoc = await prisma.uploadedDocument.findFirst({
    where: { taxCaseId, classification: "PreviousTaxDeclaration" },
    include: { extractedFields: true },
  });
  if (!priorDoc) return;

  for (const comparison of PRIOR_YEAR_COMPARISONS) {
    const priorField = priorDoc.extractedFields.find((f) => f.fieldKey === comparison.priorFieldKey);
    const priorValue = priorField ? decryptField(priorField.value, "field") : null;
    if (!priorValue || priorValue === "0") continue;

    const currentMapping = await prisma.taxFieldMapping.findFirst({
      where: { taxCaseId, taxSection: { key: comparison.currentSectionKey as any } },
    });

    if (!currentMapping) {
      issues.push({
        type: "PREVIOUS_YEAR_INCONSISTENCY",
        severity: "WARNING",
        message: `Last year you declared ${comparison.label}. No matching document was found this year — confirm whether this is missing or no longer applicable.`,
      });
      await prisma.missingDocument.upsert({
        where: { id: `${taxCaseId}:${comparison.documentClassification}:prior` },
        create: {
          id: `${taxCaseId}:${comparison.documentClassification}:prior`,
          taxCaseId,
          classification: comparison.documentClassification as any,
          reason: "PRESENT_LAST_YEAR_ABSENT_THIS_YEAR",
          note: `Declared last year (${comparison.label}) but no supporting document found this year.`,
        },
        update: {},
      });
      continue;
    }

    const currentValue = Number(decryptField(currentMapping.mappedValue, "field") ?? "0");
    const priorNumeric = Number(priorValue);
    if (priorNumeric > 0 && !Number.isNaN(currentValue)) {
      const changeRatio = Math.abs(currentValue - priorNumeric) / priorNumeric;
      if (changeRatio > 0.5) {
        issues.push({
          type: "UNUSUAL_CHANGE",
          severity: "INFO",
          message: `${comparison.label} changed by more than 50% compared to last year (${priorNumeric} → ${currentValue}). Please double-check.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tax case status derivation
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES: TaxCaseStatus[] = ["generated", "finalized", "deleted"];

export async function recomputeCaseStatus(taxCaseId: string): Promise<TaxCaseStatus> {
  const taxCase = await prisma.taxCase.findUniqueOrThrow({ where: { id: taxCaseId } });
  if (TERMINAL_STATUSES.includes(taxCase.status)) return taxCase.status;

  const documents = await prisma.uploadedDocument.findMany({ where: { taxCaseId } });
  if (documents.length === 0) {
    return updateStatus(taxCaseId, "created");
  }

  const stillProcessing = documents.some((d) => !["EXTRACTED", "EXTRACTION_FAILED", "SCAN_REJECTED"].includes(d.status));
  if (stillProcessing) {
    return updateStatus(taxCaseId, "extraction_in_progress");
  }

  const [unresolvedFields, unresolvedMappings, confirmationCount, blockingIssues] = await Promise.all([
    prisma.extractedField.count({ where: { taxCaseId, status: { in: ["extracted", "needs_review", "unresolved"] } } }),
    prisma.taxFieldMapping.count({ where: { taxCaseId, status: { in: ["extracted", "needs_review", "unresolved"] } } }),
    prisma.userConfirmation.count({ where: { taxCaseId } }),
    prisma.validationIssue.count({ where: { taxCaseId, severity: "BLOCKING", status: "OPEN" } }),
  ]);

  if (unresolvedFields > 0 || unresolvedMappings > 0) {
    return updateStatus(taxCaseId, confirmationCount > 0 ? "user_review_in_progress" : "extraction_completed");
  }
  if (blockingIssues > 0) {
    return updateStatus(taxCaseId, "validation_blocked");
  }
  return updateStatus(taxCaseId, "ready_for_generation");
}

async function updateStatus(taxCaseId: string, status: TaxCaseStatus): Promise<TaxCaseStatus> {
  await prisma.taxCase.update({ where: { id: taxCaseId }, data: { status } });
  return status;
}

export interface GenerationGateResult {
  canGenerate: boolean;
  blockingReasons: string[];
}

/** The "cannot proceed" gate: the final PDF generation button is disabled unless this returns canGenerate=true. */
export async function checkGenerationGate(taxCaseId: string): Promise<GenerationGateResult> {
  await runValidation(taxCaseId);
  const reasons: string[] = [];

  const [unresolvedFields, unresolvedMappings, blockingIssues] = await Promise.all([
    prisma.extractedField.count({ where: { taxCaseId, status: { in: ["extracted", "needs_review", "unresolved"] } } }),
    prisma.taxFieldMapping.count({ where: { taxCaseId, status: { in: ["extracted", "needs_review", "unresolved"] } } }),
    prisma.validationIssue.findMany({ where: { taxCaseId, severity: "BLOCKING", status: "OPEN" } }),
  ]);

  if (unresolvedFields > 0) reasons.push(`${unresolvedFields} extracted item(s) still need your review.`);
  if (unresolvedMappings > 0) reasons.push(`${unresolvedMappings} declaration field(s) still need your review.`);
  for (const issue of blockingIssues) reasons.push(issue.message);

  return { canGenerate: reasons.length === 0, blockingReasons: reasons };
}
