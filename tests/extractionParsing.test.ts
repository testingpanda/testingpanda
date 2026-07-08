import { describe, it, expect } from "vitest";
import { mockExtractDocument } from "@/lib/extraction/mockExtractors";
import { extractDocumentFields } from "@/lib/extraction/extract";

const SAMPLE_SALARY_TEXT = `
CERTIFICAT DE SALAIRE 2024
Employeur: Acme Genève SA
Salaire brut: CHF 95'000.00
Salaire net: CHF 78'500.50
Cotisations AVS/AI/APG: CHF 5'000.00
Année fiscale 2024
`;

describe("mock extraction engine (deterministic, offline)", () => {
  it("extracts a plausible gross salary amount from sample text", () => {
    const result = mockExtractDocument("SalaryCertificate", SAMPLE_SALARY_TEXT);
    expect(result.grossSalary).toMatchObject({ value: 95000, currency: "CHF" });
    expect((result.grossSalary as any).confidence).toBeGreaterThan(0);
  });

  it("extracts the tax year as a period", () => {
    const result = mockExtractDocument("SalaryCertificate", SAMPLE_SALARY_TEXT);
    expect((result.taxYear as any).value).toBe("2024");
  });

  it("returns null value with zero confidence when nothing is found", () => {
    const result = mockExtractDocument("Donation", "this document contains nothing relevant");
    expect((result.amountDonated as any).value).toBeNull();
    expect((result.amountDonated as any).confidence).toBe(0);
  });

  it("CurrentBlankDeclaration produces no fields (target form, not a source document)", () => {
    const result = mockExtractDocument("CurrentBlankDeclaration", "anything");
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe("extractDocumentFields end-to-end (mock provider, Zod-validated)", () => {
  it("returns a successful, schema-valid result for a salary certificate", async () => {
    const outcome = await extractDocumentFields("SalaryCertificate", SAMPLE_SALARY_TEXT);
    expect(outcome.status).toBe("success");
    expect(outcome.records.grossSalary.value).toBe(95000);
  });

  it("never throws on garbage input and always returns a well-formed envelope", async () => {
    const outcome = await extractDocumentFields("MedicalExpense", "");
    expect(outcome.status).toBe("success");
    expect(outcome.records.amountPaid).toHaveProperty("confidence");
  });
});
