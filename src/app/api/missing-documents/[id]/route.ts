import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, AuthError } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit/log";
import { recomputeCaseStatus } from "@/lib/validation/engine";

const bodySchema = z.object({
  status: z.enum(["OPEN", "CONFIRMED_MISSING", "MARKED_NOT_APPLICABLE", "RESOLVED"]),
  note: z.string().max(2000).optional(),
});

export const PATCH = withErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const missingDoc = await prisma.missingDocument.findUnique({ where: { id: params.id }, include: { taxCase: true } });
  if (!missingDoc || missingDoc.taxCase.status === "deleted") throw new AuthError("Not found", 404);
  if (missingDoc.taxCase.userId !== user.id && user.role !== "ADMIN") throw new AuthError("Not found", 404);

  const { status, note } = bodySchema.parse(await req.json());
  const updated = await prisma.missingDocument.update({
    where: { id: params.id },
    data: { status, note: note ?? missingDoc.note },
  });

  await recordAuditLog({
    userId: user.id,
    taxCaseId: missingDoc.taxCaseId,
    action: status === "CONFIRMED_MISSING" ? "FIELD_MARKED_MISSING" : "FIELD_MARKED_NOT_APPLICABLE",
    entityType: "MissingDocument",
    entityId: params.id,
    request: req,
  });

  await recomputeCaseStatus(missingDoc.taxCaseId);
  return NextResponse.json({ missingDocument: updated });
});
