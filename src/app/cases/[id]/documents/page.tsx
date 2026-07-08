import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { DocumentClassificationList } from "@/components/DocumentClassificationList";

export default async function DocumentsReviewPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);
  const documents = await prisma.uploadedDocument.findMany({
    where: { taxCaseId: taxCase.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      originalFilename: true,
      classification: true,
      classificationConfidence: true,
      classificationSource: true,
      status: true,
      textExtractionMethod: true,
    },
  });

  return (
    <div>
      <h2 className="mb-1 text-lg font-medium">Document classification review</h2>
      <p className="mb-4 text-sm text-slate-500">
        Confirm that every document was classified correctly. Change the type if the automatic classification is wrong —
        this will re-run extraction for that document.
      </p>
      <DocumentClassificationList initialDocuments={documents} />
    </div>
  );
}
