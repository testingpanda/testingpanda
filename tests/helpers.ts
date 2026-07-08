import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@prisma/client";

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${process.pid}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createTestUser(role: Role = "USER") {
  const email = `test-${uniqueSuffix()}@example.com`;
  return prisma.user.create({ data: { email, passwordHash: await hashPassword("Password123!"), role } });
}

export async function createTestCase(userId: string, taxYear = 2024) {
  return prisma.taxCase.create({ data: { userId, taxYear, canton: "GE", status: "created" } });
}

export async function createTestDocument(taxCaseId: string, userId: string, overrides: Partial<{ checksumSha256: string; originalFilename: string }> = {}) {
  return prisma.uploadedDocument.create({
    data: {
      taxCaseId,
      uploadedByUserId: userId,
      originalFilename: overrides.originalFilename ?? `doc-${uniqueSuffix()}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1234,
      storageKey: `test/${uniqueSuffix()}`,
      checksumSha256: overrides.checksumSha256 ?? uniqueSuffix(),
      status: "EXTRACTED",
    },
  });
}

/** Deleting the user cascades the tax case and everything under it (see schema onDelete: Cascade). */
export async function cleanupUser(userId: string) {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}
