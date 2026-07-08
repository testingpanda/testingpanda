import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/crypto";
import { ExtractionReviewList } from "@/components/ExtractionReviewList";

export default async function ExtractionReviewPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);
  const fields = await prisma.extractedField.findMany({
    where: { taxCaseId: taxCase.id },
    include: { document: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h2 className="mb-1 text-lg font-medium">Extraction review</h2>
      <p className="mb-4 text-sm text-slate-500">
        Every value the system found in your documents. For each one: what was proposed, where it came from, and whether
        you&apos;ve confirmed it.
      </p>
      <ExtractionReviewList
        initialFields={fields.map((f) => ({
          id: f.id,
          label: f.label,
          value: decryptField(f.value, "field"),
          currency: f.currency,
          status: f.status,
          confidence: f.confidence,
          evidenceExcerpt: decryptField(f.evidenceExcerpt, "field"),
          sourceDocumentName: f.document.originalFilename,
          sourcePageNumber: f.sourcePageNumber,
        }))}
      />
    </div>
  );
}
