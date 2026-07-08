import { describe, it, expect } from "vitest";
import { getExtractionSchema, validateExtraction } from "@/lib/extraction/schemas";

describe("per-document-type Zod extraction schemas", () => {
  it("accepts a fully valid, well-shaped extraction", () => {
    const candidate = {
      employerName: { value: "Acme SA", confidence: 0.9, evidenceExcerpt: "Employer: Acme SA", currency: null, period: null },
      grossSalary: { value: 90000, confidence: 0.95, evidenceExcerpt: "Salaire brut: 90000", currency: "CHF", period: "2024" },
      netSalary: { value: 75000, confidence: 0.9, evidenceExcerpt: "Salaire net: 75000", currency: "CHF", period: null },
      socialContributions: { value: null, confidence: 0, evidenceExcerpt: null, currency: null, period: null },
      taxYear: { value: "2024", confidence: 0.8, evidenceExcerpt: "2024", currency: null, period: "2024" },
    };
    const result = validateExtraction("SalaryCertificate", candidate);
    expect(result.success).toBe(true);
  });

  it("rejects a payload with an unexpected extra key (strict schema)", () => {
    const candidate = {
      employerName: { value: "Acme", confidence: 0.9, evidenceExcerpt: null, currency: null, period: null },
      grossSalary: { value: 1, confidence: 0.5, evidenceExcerpt: null, currency: null, period: null },
      netSalary: { value: 1, confidence: 0.5, evidenceExcerpt: null, currency: null, period: null },
      socialContributions: { value: 1, confidence: 0.5, evidenceExcerpt: null, currency: null, period: null },
      taxYear: { value: "2024", confidence: 0.5, evidenceExcerpt: null, currency: null, period: null },
      unexpectedInventedField: { value: "hallucinated", confidence: 1, evidenceExcerpt: null, currency: null, period: null },
    };
    const result = validateExtraction("SalaryCertificate", candidate);
    expect(result.success).toBe(false);
  });

  it("rejects a confidence value outside [0,1]", () => {
    const candidate = {
      employerName: { value: "Acme", confidence: 1.5, evidenceExcerpt: null, currency: null, period: null },
      grossSalary: { value: 1, confidence: 0.5, evidenceExcerpt: null, currency: null, period: null },
      netSalary: { value: 1, confidence: 0.5, evidenceExcerpt: null, currency: null, period: null },
      socialContributions: { value: 1, confidence: 0.5, evidenceExcerpt: null, currency: null, period: null },
      taxYear: { value: "2024", confidence: 0.5, evidenceExcerpt: null, currency: null, period: null },
    };
    const result = validateExtraction("SalaryCertificate", candidate);
    expect(result.success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const candidate = {
      employerName: { value: "Acme", confidence: 0.9, evidenceExcerpt: null, currency: null, period: null },
    };
    const result = validateExtraction("SalaryCertificate", candidate);
    expect(result.success).toBe(false);
  });

  it("builds a distinct schema shape per document type", () => {
    const salarySchema = getExtractionSchema("SalaryCertificate");
    const bankSchema = getExtractionSchema("BankStatement");
    expect(salarySchema).not.toBe(bankSchema);
  });

  it("CurrentBlankDeclaration has an empty schema (no content fields expected)", () => {
    const result = validateExtraction("CurrentBlankDeclaration", {});
    expect(result.success).toBe(true);
  });
});
