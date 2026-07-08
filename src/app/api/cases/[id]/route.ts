import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { deleteTaxCase } from "@/lib/cases/deleteCase";

export const GET = withErrorHandling(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await requireCaseOwnership(params.id, user);
  const taxCase = await prisma.taxCase.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      documents: { orderBy: { createdAt: "asc" } },
      _count: { select: { extractedFields: true, fieldMappings: true, missingDocuments: true } },
    },
  });
  return NextResponse.json({ taxCase });
});

export const DELETE = withErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await requireCaseOwnership(params.id, user);
  await deleteTaxCase(params.id, user.id);
  return NextResponse.json({ ok: true });
});
