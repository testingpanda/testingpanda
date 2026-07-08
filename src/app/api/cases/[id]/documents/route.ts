import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { checkRateLimit, clientIdentifierFromRequest } from "@/lib/security/rateLimit";
import { validateUploadedFile } from "@/lib/security/fileValidation";
import { getMalwareScanner } from "@/lib/security/malwareScan";
import { encryptBuffer, sha256Hex } from "@/lib/crypto";
import { getStorageDriver, buildStorageKey } from "@/lib/storage";
import { getJobQueue } from "@/lib/jobs/queue";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import { recomputeCaseStatus } from "@/lib/validation/engine";
import { recordAuditLog } from "@/lib/audit/log";

// Upload runs the extraction pipeline synchronously (parse/OCR/classify/extract),
// which can exceed Vercel's default serverless function timeout. Requires a Pro
// plan or higher for durations above 10s — see README "Deploying to Vercel".
export const maxDuration = 60;

const classificationSchema = z
  .enum([
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
  ])
  .optional();

export const GET = withErrorHandling(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await requireCaseOwnership(params.id, user);
  const documents = await prisma.uploadedDocument.findMany({
    where: { taxCaseId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ documents });
});

export const POST = withErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);
  const env = getEnv();

  const rate = checkRateLimit(`upload:${user.id}`, env.RATE_LIMIT_UPLOAD_MAX, env.RATE_LIMIT_UPLOAD_WINDOW_SECONDS);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many uploads. Please slow down." }, { status: 429 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const declaredClassification = classificationSchema.parse(formData.get("classification") || undefined);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateUploadedFile({
    filename: file.name,
    declaredMimeType: file.type,
    sizeBytes: buffer.length,
    buffer,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 422 });
  }

  const scanResult = await getMalwareScanner().scan(buffer);
  if (!scanResult.clean) {
    await recordAuditLog({
      userId: user.id,
      taxCaseId: taxCase.id,
      action: "DOCUMENT_SCAN_BLOCKED",
      entityType: "UploadedDocument",
      metadata: { provider: scanResult.provider },
      request: req,
    });
    return NextResponse.json({ error: "This file failed malware scanning and was rejected." }, { status: 422 });
  }

  const checksum = sha256Hex(buffer);

  const document = await prisma.uploadedDocument.create({
    data: {
      taxCaseId: taxCase.id,
      uploadedByUserId: user.id,
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: buffer.length,
      storageKey: "",
      checksumSha256: checksum,
      status: "UPLOADED",
      classification: declaredClassification,
      classificationSource: declaredClassification ? "USER" : undefined,
      malwareScanClean: scanResult.clean,
      malwareScanProvider: scanResult.provider,
    },
  });

  const storage = getStorageDriver();
  const key = buildStorageKey(taxCase.id, document.id, file.name);
  await storage.put(key, encryptBuffer(buffer, "file"));
  await prisma.uploadedDocument.update({ where: { id: document.id }, data: { storageKey: key } });

  await recordAuditLog({
    userId: user.id,
    taxCaseId: taxCase.id,
    action: "DOCUMENT_UPLOADED",
    entityType: "UploadedDocument",
    entityId: document.id,
    metadata: { mimeType: file.type, sizeBytes: buffer.length },
    request: req,
  });

  await recomputeCaseStatus(taxCase.id);

  const queue = getJobQueue();
  await queue.enqueue("extraction-pipeline", () => runExtractionPipeline(document.id));

  const refreshed = await prisma.uploadedDocument.findUniqueOrThrow({
    where: { id: document.id },
    include: { extractedFields: true },
  });

  return NextResponse.json({ document: refreshed }, { status: 201 });
});
