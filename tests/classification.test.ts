import { describe, it, expect } from "vitest";
import { classifyByKeywords } from "@/lib/extraction/classifyHeuristics";
import { MockLLMProvider } from "@/lib/llm/mock";

describe("document classification", () => {
  it("classifies a salary certificate from French keywords", () => {
    const result = classifyByKeywords("CERTIFICAT DE SALAIRE 2024\nSalaire brut: 90'000", "salaire.pdf");
    expect(result.classification).toBe("SalaryCertificate");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("classifies a pillar 3a certificate", () => {
    const result = classifyByKeywords("Attestation de versement Pilier 3a 2024", "3a.pdf");
    expect(result.classification).toBe("ThirdPillar");
  });

  it("classifies a mortgage statement", () => {
    const result = classifyByKeywords("Relevé hypothèque annuel, intérêts hypothécaires", "hypotheque.pdf");
    expect(result.classification).toBe("Mortgage");
  });

  it("falls back to Other with low confidence when nothing matches", () => {
    const result = classifyByKeywords("random unrelated content with no useful keywords", "file.pdf");
    expect(result.classification).toBe("Other");
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("MockLLMProvider.classifyDocument returns a valid ClassificationResult shape", async () => {
    const provider = new MockLLMProvider();
    const result = await provider.classifyDocument("Certificat de salaire 2024", ["SalaryCertificate", "Other"] as any);
    expect(result).toHaveProperty("classification");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("rationale");
  });
});
