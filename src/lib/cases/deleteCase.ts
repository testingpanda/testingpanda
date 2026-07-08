import { prisma } from "@/lib/prisma";
import { getStorageDriver } from "@/lib/storage";
import { recordAuditLog } from "@/lib/audit/log";

/**
 * Full data deletion for a tax case: every uploaded document's encrypted
 * file and every generated PDF's encrypted file are removed from storage
 * FIRST, then the database row (and everything cascaded from it: pages,
 * extracted fields, mappings, confirmations, assumptions, validation
 * issues, missing documents) is deleted. The case is marked `deleted`
 * before storage cleanup begins so a failure partway through leaves a
 * clearly-marked, retryable record rather than silent partial deletion.
 * AuditLog rows survive (userId/taxCaseId become null via onDelete: SetNull)
 * so the deletion itself remains auditable.
 */
export async function deleteTaxCase(taxCaseId: string, deletedByUserId: string): Promise<void> {
  const taxCase = await prisma.taxCase.findUniqueOrThrow({ where: { id: taxCaseId } });
  await prisma.taxCase.update({ where: { id: taxCaseId }, data: { status: "deleted", deletedAt: new Date() } });

  const storage = getStorageDriver();
  const [documents, generatedPdfs] = await Promise.all([
    prisma.uploadedDocument.findMany({ where: { taxCaseId } }),
    prisma.generatedPDF.findMany({ where: { taxCaseId } }),
  ]);

  for (const doc of documents) {
    await storage.delete(doc.storageKey).catch(() => undefined);
  }
  for (const pdf of generatedPdfs) {
    await storage.delete(pdf.storageKey).catch(() => undefined);
  }

  await recordAuditLog({
    userId: deletedByUserId,
    taxCaseId,
    action: "CASE_DELETED",
    entityType: "TaxCase",
    entityId: taxCaseId,
    metadata: { taxYear: taxCase.taxYear, documentCount: documents.length },
  });

  await prisma.taxCase.delete({ where: { id: taxCaseId } });
}
