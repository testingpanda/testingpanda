import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/crypto";
import { ensureTaxSectionsExist } from "@/lib/extraction/mapping";
import { SectionReviewList } from "@/components/SectionReviewList";

export default async function SectionReviewPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);
  await ensureTaxSectionsExist(taxCase.canton, taxCase.taxYear);

  const sections = await prisma.taxSection.findMany({
    where: { canton: taxCase.canton, taxYear: taxCase.taxYear },
    orderBy: { sortOrder: "asc" },
    include: { fieldMappings: { where: { taxCaseId: taxCase.id }, include: { extractedField: { include: { document: true } } } } },
  });

  return (
    <div>
      <h2 className="mb-1 text-lg font-medium">Section-by-section review</h2>
      <p className="mb-4 text-sm text-slate-500">
        Every value mapped onto your Geneva declaration, organized by section. Required sections must be resolved before
        you can generate your final package.
      </p>
      <SectionReviewList
        caseId={taxCase.id}
        initialSections={sections.map((s) => ({
          id: s.id,
          key: s.key,
          label: s.label,
          description: s.description,
          required: s.required,
          items: s.fieldMappings.map((m) => ({
            id: m.id,
            declarationFieldLabel: m.declarationFieldLabel,
            mappedValue: decryptField(m.mappedValue, "field"),
            mappedCurrency: m.mappedCurrency,
            status: m.status,
            confidence: m.extractedField?.confidence ?? null,
            evidenceExcerpt: m.extractedField ? decryptField(m.extractedField.evidenceExcerpt, "field") : null,
            sourceDocumentName: m.extractedField?.document.originalFilename ?? null,
            sourcePageNumber: m.extractedField?.sourcePageNumber ?? null,
          })),
        }))}
      />
    </div>
  );
}
