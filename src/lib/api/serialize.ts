import type { ExtractedField, TaxFieldMapping } from "@prisma/client";
import { decryptField } from "@/lib/crypto";

/**
 * Decryption happens exclusively at the API boundary, for the authenticated
 * owner of the case, right before sending a JSON response — never in bulk,
 * never logged, never persisted anywhere else in decrypted form.
 */
export function serializeExtractedField(field: ExtractedField) {
  return {
    id: field.id,
    documentId: field.documentId,
    fieldKey: field.fieldKey,
    label: field.label,
    value: decryptField(field.value, "field"),
    editedValue: decryptField(field.editedValue, "field"),
    normalizedValue: decryptField(field.normalizedValue, "field"),
    currency: field.currency,
    period: field.period,
    confidence: field.confidence,
    sourcePageNumber: field.sourcePageNumber,
    evidenceExcerpt: decryptField(field.evidenceExcerpt, "field"),
    extractionMethod: field.extractionMethod,
    possibleTaxSectionKey: field.possibleTaxSectionKey,
    needsUserConfirmation: field.needsUserConfirmation,
    notes: field.notes,
    status: field.status,
    rejectionReason: field.rejectionReason,
    createdAt: field.createdAt,
    updatedAt: field.updatedAt,
  };
}

export function serializeTaxFieldMapping(mapping: TaxFieldMapping) {
  return {
    id: mapping.id,
    taxSectionId: mapping.taxSectionId,
    extractedFieldId: mapping.extractedFieldId,
    declarationFieldCode: mapping.declarationFieldCode,
    declarationFieldLabel: mapping.declarationFieldLabel,
    mappedValue: decryptField(mapping.mappedValue, "field"),
    mappedCurrency: mapping.mappedCurrency,
    status: mapping.status,
    createdAt: mapping.createdAt,
    updatedAt: mapping.updatedAt,
  };
}
