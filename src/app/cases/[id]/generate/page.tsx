import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { GenerateAction } from "@/components/GenerateAction";

export default async function GeneratePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);
  const finalDeclaration = await prisma.userConfirmation.findFirst({
    where: { taxCaseId: taxCase.id, note: "FINAL_DECLARATION_ACCEPTED" },
  });

  if (!finalDeclaration) {
    return (
      <p className="card text-sm text-slate-600">
        You need to complete the final validation checklist and accept the final declaration statement before
        generating your package.
      </p>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-medium">Generate final package</h2>
      <p className="mb-4 text-sm text-slate-500">
        This produces your completed declaration PDF plus a full review summary, assumptions log, missing documents
        checklist, supporting document index, and audit trail — packaged into one ZIP file.
      </p>
      <GenerateAction caseId={taxCase.id} alreadyGenerated={["generated", "finalized"].includes(taxCase.status)} />
    </div>
  );
}
