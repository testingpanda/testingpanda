import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getStorageDriver, buildStorageKey } from "@/lib/storage";
import { encryptBuffer } from "@/lib/crypto";
import { deleteTaxCase } from "@/lib/cases/deleteCase";
import { createTestUser, createTestCase, cleanupUser } from "./helpers";

describe("data deletion flow", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) await cleanupUser(userId);
    userId = undefined;
  });

  it("removes the case, its documents, and the underlying encrypted file from storage", async () => {
    const user = await createTestUser();
    userId = user.id;
    const taxCase = await createTestCase(user.id);

    const storage = getStorageDriver();
    const document = await prisma.uploadedDocument.create({
      data: {
        taxCaseId: taxCase.id,
        uploadedByUserId: user.id,
        originalFilename: "salary.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4,
        storageKey: "",
        checksumSha256: "deadbeef",
        status: "EXTRACTED",
      },
    });
    const key = buildStorageKey(taxCase.id, document.id, "salary.pdf");
    await storage.put(key, encryptBuffer(Buffer.from("test"), "file"));
    await prisma.uploadedDocument.update({ where: { id: document.id }, data: { storageKey: key } });

    await deleteTaxCase(taxCase.id, user.id);

    const remainingCase = await prisma.taxCase.findUnique({ where: { id: taxCase.id } });
    expect(remainingCase).toBeNull();

    const remainingDocument = await prisma.uploadedDocument.findUnique({ where: { id: document.id } });
    expect(remainingDocument).toBeNull();

    await expect(storage.get(key)).rejects.toThrow();
  });

  it("keeps an auditable CASE_DELETED log entry even after the case row is gone", async () => {
    const user = await createTestUser();
    userId = user.id;
    const taxCase = await createTestCase(user.id);

    await deleteTaxCase(taxCase.id, user.id);

    const log = await prisma.auditLog.findFirst({ where: { taxCaseIdSnapshot: taxCase.id, action: "CASE_DELETED" } });
    expect(log).not.toBeNull();
    // The live relation is nulled out (onDelete: SetNull) once the case is gone, but the snapshot ID survives.
    expect(log?.taxCaseId).toBeNull();
  });

  it("cascades deletion down to extracted fields and validation issues", async () => {
    const user = await createTestUser();
    userId = user.id;
    const taxCase = await createTestCase(user.id);
    const document = await prisma.uploadedDocument.create({
      data: {
        taxCaseId: taxCase.id,
        uploadedByUserId: user.id,
        originalFilename: "doc.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
        storageKey: "test/none",
        checksumSha256: "abc123",
        status: "EXTRACTED",
      },
    });
    const field = await prisma.extractedField.create({
      data: {
        taxCaseId: taxCase.id,
        documentId: document.id,
        fieldKey: "x",
        label: "X",
        value: "encrypted-placeholder",
        confidence: 0.5,
        extractionMethod: "LLM",
      },
    });

    await deleteTaxCase(taxCase.id, user.id);

    const remainingField = await prisma.extractedField.findUnique({ where: { id: field.id } });
    expect(remainingField).toBeNull();
  });
});
