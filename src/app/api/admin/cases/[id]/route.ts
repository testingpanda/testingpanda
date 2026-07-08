import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit/log";

/** Redacted admin view: statuses, counts, and confidence — never decrypted field values. */
export const GET = withErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();
  const taxCase = await prisma.taxCase.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      user: { select: { email: true } },
      documents: { select: { id: true, originalFilename: true, classification: true, status: true, classificationConfidence: true } },
      validationIssues: true,
      _count: { select: { extractedFields: true, fieldMappings: true } },
    },
  });

  await recordAuditLog({ userId: admin.id, taxCaseId: taxCase.id, action: "ADMIN_CASE_VIEWED", entityType: "TaxCase", entityId: taxCase.id, request: req });

  return NextResponse.json({
    taxCase: {
      id: taxCase.id,
      userEmail: taxCase.user.email,
      canton: taxCase.canton,
      taxYear: taxCase.taxYear,
      status: taxCase.status,
      createdAt: taxCase.createdAt,
      documents: taxCase.documents,
      validationIssues: taxCase.validationIssues,
      extractedFieldCount: taxCase._count.extractedFields,
      fieldMappingCount: taxCase._count.fieldMappings,
    },
  });
});
