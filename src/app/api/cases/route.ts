import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit/log";

const createCaseSchema = z.object({
  taxYear: z.number().int().min(2015).max(2100),
  canton: z.literal("GE").default("GE"),
});

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const cases = await prisma.taxCase.findMany({
    where: { userId: user.id, status: { not: "deleted" } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { documents: true } } },
  });
  return NextResponse.json({ cases });
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const { taxYear, canton } = createCaseSchema.parse(await req.json());

  const taxCase = await prisma.taxCase.create({
    data: { userId: user.id, taxYear, canton, status: "created" },
  });

  await recordAuditLog({
    userId: user.id,
    taxCaseId: taxCase.id,
    action: "CASE_CREATED",
    entityType: "TaxCase",
    entityId: taxCase.id,
    metadata: { taxYear, canton },
    request: req,
  });

  return NextResponse.json({ taxCase }, { status: 201 });
});
