import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

/** Admin debugging view — deliberately returns only structural/status data, never decrypted tax values. */
export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const cases = await prisma.taxCase.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } }, _count: { select: { documents: true, validationIssues: true } } },
  });
  return NextResponse.json({ cases });
});
