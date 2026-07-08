import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { UploadWorkspace } from "@/components/UploadWorkspace";

export default async function UploadPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);
  const documents = await prisma.uploadedDocument.findMany({
    where: { taxCaseId: taxCase.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, originalFilename: true, classification: true, classificationConfidence: true, status: true, sizeBytes: true },
  });

  return <UploadWorkspace caseId={taxCase.id} initialDocuments={documents} />;
}
