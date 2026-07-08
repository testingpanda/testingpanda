import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { ensureTaxSectionsExist } from "@/lib/extraction/mapping";
import { serializeTaxFieldMapping } from "@/lib/api/serialize";
import { decryptField } from "@/lib/crypto";

/** Section-by-section review data: every declaration section with its mapped items and full evidence trail. */
export const GET = withErrorHandling(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);
  await ensureTaxSectionsExist(taxCase.canton, taxCase.taxYear);

  const sections = await prisma.taxSection.findMany({
    where: { canton: taxCase.canton, taxYear: taxCase.taxYear },
    orderBy: { sortOrder: "asc" },
    include: {
      fieldMappings: {
        where: { taxCaseId: taxCase.id },
        include: { extractedField: { include: { document: true } } },
      },
    },
  });

  const payload = sections.map((section) => ({
    id: section.id,
    key: section.key,
    label: section.label,
    description: section.description,
    required: section.required,
    items: section.fieldMappings.map((m) => ({
      ...serializeTaxFieldMapping(m),
      sourceDocumentName: m.extractedField?.document.originalFilename ?? null,
      sourcePageNumber: m.extractedField?.sourcePageNumber ?? null,
      evidenceExcerpt: m.extractedField ? decryptField(m.extractedField.evidenceExcerpt, "field") : null,
      confidence: m.extractedField?.confidence ?? null,
    })),
  }));

  return NextResponse.json({ sections: payload });
});
