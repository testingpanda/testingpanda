import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireCaseOwnership, AuthError } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { createDownloadToken } from "@/lib/security/downloadToken";

export const GET = withErrorHandling(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);

  const latestPackage = await prisma.generatedPDF.findFirst({
    where: { taxCaseId: taxCase.id, type: "FINAL_PACKAGE_ZIP" },
    orderBy: { createdAt: "desc" },
  });
  if (!latestPackage) throw new AuthError("No generated package found for this case yet", 404);

  const token = await createDownloadToken({ resourceType: "generated_pdf", resourceId: latestPackage.id, userId: user.id });
  return NextResponse.json({ token, filename: "final_tax_package.zip" });
});
