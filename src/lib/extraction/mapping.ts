import type { ExtractedField } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptField, encryptField } from "@/lib/crypto";
import { getCantonConfig, getDeclarationMapping } from "@/lib/taxSections/geneva";

/** Ensures every TaxSection row for this canton/year exists (idempotent, seeded on first use). */
export async function ensureTaxSectionsExist(canton: "GE", taxYear: number) {
  const config = getCantonConfig(canton);
  for (const section of config.sections) {
    await prisma.taxSection.upsert({
      where: { canton_taxYear_key: { canton, taxYear, key: section.key } },
      create: { canton, taxYear, key: section.key, label: section.label, description: section.description, required: section.required, sortOrder: section.sortOrder },
      update: {},
    });
  }
}

/**
 * Creates (or updates) the TaxFieldMapping row for a single extracted field,
 * if a Geneva declaration mapping is configured for its document type +
 * field key. Fields without a configured mapping remain visible as
 * ExtractedField context but do not appear as a declaration line item.
 */
export async function mapExtractedFieldToDeclaration(
  extractedField: ExtractedField,
  canton: "GE",
  taxYear: number,
  documentType: string
) {
  const mapping = getDeclarationMapping(canton, documentType as any, extractedField.fieldKey);
  if (!mapping) return null;

  await ensureTaxSectionsExist(canton, taxYear);
  const section = await prisma.taxSection.findUniqueOrThrow({
    where: { canton_taxYear_key: { canton, taxYear, key: mapping.sectionKey } },
  });

  const existing = await prisma.taxFieldMapping.findFirst({
    where: { taxCaseId: extractedField.taxCaseId, extractedFieldId: extractedField.id },
  });

  const decryptedValue = decryptField(extractedField.value, "field");

  if (existing) {
    return prisma.taxFieldMapping.update({
      where: { id: existing.id },
      data: { mappedValue: encryptField(decryptedValue, "field") },
    });
  }

  return prisma.taxFieldMapping.create({
    data: {
      taxCaseId: extractedField.taxCaseId,
      taxSectionId: section.id,
      extractedFieldId: extractedField.id,
      declarationFieldCode: mapping.declarationFieldCode,
      declarationFieldLabel: mapping.declarationFieldLabel,
      mappedValue: encryptField(decryptedValue, "field"),
      mappedCurrency: extractedField.currency,
      status: "needs_review",
    },
  });
}
