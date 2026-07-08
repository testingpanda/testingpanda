import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireDocumentOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { getJobQueue } from "@/lib/jobs/queue";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import { recordAuditLog } from "@/lib/audit/log";

const bodySchema = z.object({
  classification: z.enum([
    "PreviousTaxDeclaration",
    "CurrentBlankDeclaration",
    "SalaryCertificate",
    "BankStatement",
    "SecuritiesStatement",
    "ThirdPillar",
    "PensionFund",
    "HealthInsurance",
    "MedicalExpense",
    "Childcare",
    "Mortgage",
    "RealEstate",
    "Donation",
    "Debt",
    "Insurance",
    "SelfEmployment",
    "Vehicle",
    "Other",
  ]),
});

/** User-driven reclassification: discards the previous extraction for this document and re-runs it under the corrected type. */
export const POST = withErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const document = await requireDocumentOwnership(params.id, user);
  const { classification } = bodySchema.parse(await req.json());

  await prisma.$transaction([
    prisma.taxFieldMapping.deleteMany({ where: { extractedField: { documentId: document.id } } }),
    prisma.extractedField.deleteMany({ where: { documentId: document.id } }),
    prisma.uploadedDocument.update({
      where: { id: document.id },
      data: { classification, classificationSource: "USER", classificationConfidence: null, status: "CLASSIFIED" },
    }),
  ]);

  await recordAuditLog({
    userId: user.id,
    taxCaseId: document.taxCaseId,
    action: "DOCUMENT_CLASSIFIED",
    entityType: "UploadedDocument",
    entityId: document.id,
    metadata: { classification, source: "USER" },
    request: req,
  });

  await getJobQueue().enqueue("extraction-pipeline", () => runExtractionPipeline(document.id));

  const refreshed = await prisma.uploadedDocument.findUniqueOrThrow({ where: { id: document.id } });
  return NextResponse.json({ document: refreshed });
});
