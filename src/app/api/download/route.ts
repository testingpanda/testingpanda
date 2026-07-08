import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, AuthError } from "@/lib/auth/guard";
import { verifyDownloadToken } from "@/lib/security/downloadToken";
import { prisma } from "@/lib/prisma";
import { getStorageDriver } from "@/lib/storage";
import { decryptBuffer } from "@/lib/crypto";
import { recordAuditLog } from "@/lib/audit/log";

/**
 * Single, generic download endpoint. Never serves a raw storage URL —
 * clients only ever receive a short-lived signed token (see
 * src/lib/security/downloadToken.ts), which this route exchanges for the
 * decrypted file content, streamed directly in the response.
 */
export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) throw new AuthError("Missing download token", 400);

  const payload = await verifyDownloadToken(token);
  if (!payload || payload.userId !== user.id) throw new AuthError("Invalid or expired download link", 403);

  if (payload.resourceType !== "generated_pdf") {
    throw new AuthError("Unsupported resource type", 400);
  }

  const record = await prisma.generatedPDF.findUnique({ where: { id: payload.resourceId }, include: { taxCase: true } });
  if (!record || record.taxCase.userId !== user.id) throw new AuthError("File not found", 404);

  const storage = getStorageDriver();
  const encrypted = await storage.get(record.storageKey);
  const plaintext = decryptBuffer(encrypted, "file");

  const filename = record.type === "FINAL_PACKAGE_ZIP" ? "final_tax_package.zip" : `${record.type.toLowerCase()}.pdf`;
  const contentType = record.type === "FINAL_PACKAGE_ZIP" ? "application/zip" : "application/pdf";

  await recordAuditLog({
    userId: user.id,
    taxCaseId: record.taxCaseId,
    action: "PACKAGE_DOWNLOADED",
    entityType: "GeneratedPDF",
    entityId: record.id,
    request: req,
  });

  if (record.type === "FINAL_PACKAGE_ZIP" && record.taxCase.status === "generated") {
    await prisma.taxCase.update({ where: { id: record.taxCaseId }, data: { status: "finalized" } });
  }

  return new NextResponse(new Uint8Array(plaintext), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(plaintext.length),
      "Cache-Control": "no-store",
    },
  });
});
