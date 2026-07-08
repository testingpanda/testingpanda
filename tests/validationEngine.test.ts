import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { encryptField } from "@/lib/crypto";
import { runValidation, checkGenerationGate } from "@/lib/validation/engine";
import { createTestUser, createTestCase, createTestDocument, cleanupUser } from "./helpers";

describe("validation engine", () => {
  let userId: string;

  afterEach(async () => {
    if (userId) await cleanupUser(userId);
  });

  it("flags every required declaration section as missing on an empty case", async () => {
    const user = await createTestUser();
    userId = user.id;
    const taxCase = await createTestCase(user.id);

    await runValidation(taxCase.id);
    const issues = await prisma.validationIssue.findMany({ where: { taxCaseId: taxCase.id } });

    const requiredMissing = issues.filter((i) => i.type === "MISSING_REQUIRED_FIELD");
    expect(requiredMissing.length).toBeGreaterThan(0);
    expect(requiredMissing.every((i) => i.severity === "BLOCKING")).toBe(true);
  });

  it("flags two uploaded files with identical checksums as duplicates", async () => {
    const user = await createTestUser();
    userId = user.id;
    const taxCase = await createTestCase(user.id);
    await createTestDocument(taxCase.id, user.id, { checksumSha256: "same-hash" });
    await createTestDocument(taxCase.id, user.id, { checksumSha256: "same-hash" });

    await runValidation(taxCase.id);
    const issues = await prisma.validationIssue.findMany({ where: { taxCaseId: taxCase.id, type: "DUPLICATE_DOCUMENT" } });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags a negative extracted value as an impossible value (blocking)", async () => {
    const user = await createTestUser();
    userId = user.id;
    const taxCase = await createTestCase(user.id);
    const doc = await createTestDocument(taxCase.id, user.id);
    await prisma.extractedField.create({
      data: {
        taxCaseId: taxCase.id,
        documentId: doc.id,
        fieldKey: "grossSalary",
        label: "Gross salary",
        value: encryptField("-500", "field")!,
        confidence: 0.9,
        extractionMethod: "LLM",
        status: "extracted",
      },
    });

    await runValidation(taxCase.id);
    const issues = await prisma.validationIssue.findMany({ where: { taxCaseId: taxCase.id, type: "IMPOSSIBLE_VALUE" } });
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("BLOCKING");
  });

  it("flags a non-CHF currency as a currency inconsistency warning", async () => {
    const user = await createTestUser();
    userId = user.id;
    const taxCase = await createTestCase(user.id);
    const doc = await createTestDocument(taxCase.id, user.id);
    await prisma.extractedField.create({
      data: {
        taxCaseId: taxCase.id,
        documentId: doc.id,
        fieldKey: "totalDividendIncome",
        label: "Dividend income",
        value: encryptField("100", "field")!,
        currency: "EUR",
        confidence: 0.9,
        extractionMethod: "LLM",
        status: "extracted",
      },
    });

    await runValidation(taxCase.id);
    const issues = await prisma.validationIssue.findMany({ where: { taxCaseId: taxCase.id, type: "CURRENCY_INCONSISTENCY" } });
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("WARNING");
  });

  it("the generation gate refuses to pass while blocking issues exist", async () => {
    const user = await createTestUser();
    userId = user.id;
    const taxCase = await createTestCase(user.id);

    const gate = await checkGenerationGate(taxCase.id);
    expect(gate.canGenerate).toBe(false);
    expect(gate.blockingReasons.length).toBeGreaterThan(0);
  });
});
