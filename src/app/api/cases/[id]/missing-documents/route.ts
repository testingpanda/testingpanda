import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandling(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await requireCaseOwnership(params.id, user);
  const missingDocuments = await prisma.missingDocument.findMany({
    where: { taxCaseId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ missingDocuments });
});
