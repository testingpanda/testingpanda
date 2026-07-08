import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireDocumentOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { getStorageDriver } from "@/lib/storage";
import { recomputeCaseStatus } from "@/lib/validation/engine";
import { recordAuditLog } from "@/lib/audit/log";
import { serializeExtractedField } from "@/lib/api/serialize";

export const GET = withErrorHandling(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const document = await requireDocumentOwnership(params.id, user);
  const extractedFields = await prisma.extractedField.findMany({ where: { documentId: document.id } });
  return NextResponse.json({
    document: {
      id: document.id,
      taxCaseId: document.taxCaseId,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      classification: document.classification,
      classificationConfidence: document.classificationConfidence,
      classificationSource: document.classificationSource,
      textExtractionMethod: document.textExtractionMethod,
      pageCount: document.pageCount,
      createdAt: document.createdAt,
    },
    extractedFields: extractedFields.map(serializeExtractedField),
  });
});

export const DELETE = withErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const document = await requireDocumentOwnership(params.id, user);

  const storage = getStorageDriver();
  await storage.delete(document.storageKey).catch(() => undefined);
  await prisma.uploadedDocument.delete({ where: { id: document.id } });

  await recordAuditLog({
    userId: user.id,
    taxCaseId: document.taxCaseId,
    action: "DOCUMENT_DELETED",
    entityType: "UploadedDocument",
    entityId: document.id,
    request: req,
  });

  await recomputeCaseStatus(document.taxCaseId);
  return NextResponse.json({ ok: true });
});
