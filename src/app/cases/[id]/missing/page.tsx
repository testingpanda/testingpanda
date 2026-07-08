import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { runValidation } from "@/lib/validation/engine";
import { MissingDocumentsList } from "@/components/MissingDocumentsList";

export default async function MissingInfoPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);
  await runValidation(taxCase.id);
  const missingDocuments = await prisma.missingDocument.findMany({ where: { taxCaseId: taxCase.id }, orderBy: { createdAt: "asc" } });

  return (
    <div>
      <h2 className="mb-1 text-lg font-medium">Missing information</h2>
      <p className="mb-4 text-sm text-slate-500">
        Based on last year&apos;s declaration, these items may be missing this year. Tell us whether each one is genuinely
        missing or no longer applicable.
      </p>
      <MissingDocumentsList initialItems={missingDocuments} />
    </div>
  );
}
