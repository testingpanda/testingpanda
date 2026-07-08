import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { runValidation, checkGenerationGate } from "@/lib/validation/engine";
import { recordAuditLog } from "@/lib/audit/log";

export const GET = withErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);

  await runValidation(taxCase.id);
  const gate = await checkGenerationGate(taxCase.id);
  const issues = await prisma.validationIssue.findMany({ where: { taxCaseId: taxCase.id }, orderBy: { severity: "asc" } });

  await recordAuditLog({ userId: user.id, taxCaseId: taxCase.id, action: "VALIDATION_RUN", entityType: "TaxCase", entityId: taxCase.id, request: req });

  return NextResponse.json({ issues, gate });
});
