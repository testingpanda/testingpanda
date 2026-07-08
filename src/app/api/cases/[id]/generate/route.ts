import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { checkGenerationGate } from "@/lib/validation/engine";
import { generateFinalPackage } from "@/lib/pdf/package";
import { getJobQueue } from "@/lib/jobs/queue";

export const POST = withErrorHandling(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);

  const finalDeclaration = await prisma.userConfirmation.findFirst({
    where: { taxCaseId: taxCase.id, note: "FINAL_DECLARATION_ACCEPTED" },
  });
  if (!finalDeclaration) {
    return NextResponse.json({ error: "You must accept the final declaration statement before generating the package." }, { status: 409 });
  }

  const gate = await checkGenerationGate(taxCase.id);
  if (!gate.canGenerate) {
    return NextResponse.json({ error: "Cannot generate final package yet", blockingReasons: gate.blockingReasons }, { status: 409 });
  }

  const result = await getJobQueue().enqueue("generate-final-package", () => generateFinalPackage(taxCase.id, user.id));
  return NextResponse.json({ result });
});
