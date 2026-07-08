import type { AuditAction, ConfirmationAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptField, encryptField } from "@/lib/crypto";
import { applyConfirmationAction } from "@/lib/validation/engine";
import { runValidation } from "@/lib/validation/engine";
import { recordAuditLog } from "@/lib/audit/log";

const AUDIT_ACTION_FOR: Record<ConfirmationAction, AuditAction> = {
  CONFIRM: "FIELD_CONFIRMED",
  EDIT_CONFIRM: "FIELD_EDITED_CONFIRMED",
  REJECT: "FIELD_REJECTED",
  NOT_APPLICABLE: "FIELD_MARKED_NOT_APPLICABLE",
  MARK_MISSING: "FIELD_MARKED_MISSING",
  REQUEST_HELP: "HELP_REQUESTED",
};

export class ConfirmationValidationError extends Error {
  status = 422;
}

export interface ApplyConfirmationParams {
  userId: string;
  action: ConfirmationAction;
  editedValue?: string;
  note?: string;
}

/**
 * The single place that applies a user decision to an ExtractedField (and
 * keeps its downstream TaxFieldMapping, if any, in sync) or to a
 * TaxFieldMapping directly (keeping its source ExtractedField, if any, in
 * sync the other direction). Every call writes an immutable UserConfirmation
 * row — this is the audit trail the product principle "has the user
 * confirmed it?" depends on.
 */
export async function confirmExtractedField(fieldId: string, params: ApplyConfirmationParams) {
  if (params.action === "EDIT_CONFIRM" && !params.editedValue) {
    throw new ConfirmationValidationError("editedValue is required for EDIT_CONFIRM");
  }

  const field = await prisma.extractedField.findUniqueOrThrow({ where: { id: fieldId } });
  const previousValue = decryptField(field.value, "field");
  const effectiveValue = params.action === "EDIT_CONFIRM" ? params.editedValue! : previousValue;
  const newStatus = applyConfirmationAction(params.action);

  await prisma.extractedField.update({
    where: { id: fieldId },
    data: {
      status: newStatus ?? field.status,
      editedValue: params.action === "EDIT_CONFIRM" ? encryptField(params.editedValue, "field") : field.editedValue,
      rejectionReason: params.action === "REJECT" ? (params.note ?? null) : field.rejectionReason,
      needsUserConfirmation: newStatus ? false : field.needsUserConfirmation,
    },
  });

  if (newStatus) {
    await prisma.taxFieldMapping.updateMany({
      where: { extractedFieldId: fieldId },
      data: { status: newStatus, ...(params.action === "EDIT_CONFIRM" ? { mappedValue: encryptField(effectiveValue, "field") } : {}) },
    });
  }

  await prisma.userConfirmation.create({
    data: {
      taxCaseId: field.taxCaseId,
      userId: params.userId,
      extractedFieldId: fieldId,
      action: params.action,
      previousValue: encryptField(previousValue, "field"),
      newValue: encryptField(effectiveValue ?? null, "field"),
      note: params.note,
    },
  });

  await recordAuditLog({
    userId: params.userId,
    taxCaseId: field.taxCaseId,
    action: AUDIT_ACTION_FOR[params.action],
    entityType: "ExtractedField",
    entityId: fieldId,
  });

  await runValidation(field.taxCaseId);
  return prisma.extractedField.findUniqueOrThrow({ where: { id: fieldId } });
}

/**
 * Resolves a required declaration section that has zero mapped items (no
 * document was uploaded for it at all) — e.g. "I have no bank accounts to
 * declare". Without this, a required section with nothing extracted could
 * never be resolved, since there is no existing item to confirm/reject.
 * Creates a placeholder TaxFieldMapping with no source ExtractedField and
 * immediately applies the user's decision to it through the normal
 * confirmation path, so it is still fully audited.
 */
export async function resolveEmptySection(
  taxCaseId: string,
  taxSectionId: string,
  params: ApplyConfirmationParams & { action: "NOT_APPLICABLE" | "MARK_MISSING" }
) {
  const section = await prisma.taxSection.findUniqueOrThrow({ where: { id: taxSectionId } });
  const existing = await prisma.taxFieldMapping.findFirst({ where: { taxCaseId, taxSectionId, extractedFieldId: null } });
  const mapping =
    existing ??
    (await prisma.taxFieldMapping.create({
      data: {
        taxCaseId,
        taxSectionId,
        declarationFieldCode: section.key,
        declarationFieldLabel: `${section.label} — nothing to declare`,
        status: "needs_review",
      },
    }));
  return confirmTaxFieldMapping(mapping.id, params);
}

export async function confirmTaxFieldMapping(mappingId: string, params: ApplyConfirmationParams) {
  if (params.action === "EDIT_CONFIRM" && !params.editedValue) {
    throw new ConfirmationValidationError("editedValue is required for EDIT_CONFIRM");
  }

  const mapping = await prisma.taxFieldMapping.findUniqueOrThrow({ where: { id: mappingId } });
  const previousValue = decryptField(mapping.mappedValue, "field");
  const effectiveValue = params.action === "EDIT_CONFIRM" ? params.editedValue! : previousValue;
  const newStatus = applyConfirmationAction(params.action);

  await prisma.taxFieldMapping.update({
    where: { id: mappingId },
    data: {
      status: newStatus ?? mapping.status,
      mappedValue: params.action === "EDIT_CONFIRM" ? encryptField(params.editedValue, "field") : mapping.mappedValue,
    },
  });

  if (newStatus && mapping.extractedFieldId) {
    await prisma.extractedField.update({
      where: { id: mapping.extractedFieldId },
      data: {
        status: newStatus,
        needsUserConfirmation: false,
        ...(params.action === "EDIT_CONFIRM" ? { editedValue: encryptField(params.editedValue, "field") } : {}),
      },
    });
  }

  await prisma.userConfirmation.create({
    data: {
      taxCaseId: mapping.taxCaseId,
      userId: params.userId,
      taxFieldMappingId: mappingId,
      action: params.action,
      previousValue: encryptField(previousValue, "field"),
      newValue: encryptField(effectiveValue ?? null, "field"),
      note: params.note,
    },
  });

  await recordAuditLog({
    userId: params.userId,
    taxCaseId: mapping.taxCaseId,
    action: AUDIT_ACTION_FOR[params.action],
    entityType: "TaxFieldMapping",
    entityId: mappingId,
  });

  await runValidation(mapping.taxCaseId);
  return prisma.taxFieldMapping.findUniqueOrThrow({ where: { id: mappingId } });
}
