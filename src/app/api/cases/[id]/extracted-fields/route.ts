import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { serializeExtractedField } from "@/lib/api/serialize";

/** Flat extraction review data: every atomic extracted fact across all documents in the case. */
export const GET = withErrorHandling(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await requireCaseOwnership(params.id, user);
  const fields = await prisma.extractedField.findMany({
    where: { taxCaseId: params.id },
    include: { document: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    fields: fields.map((f) => ({
      ...serializeExtractedField(f),
      sourceDocumentName: f.document.originalFilename,
      sourceDocumentClassification: f.document.classification,
    })),
  });
});
