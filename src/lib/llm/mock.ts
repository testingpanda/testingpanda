import type { DocumentClassification } from "@prisma/client";
import type { ClassificationResult, ExtractionRawResult, FieldSpec, LLMProvider } from "@/lib/llm/types";
import { classifyByKeywords } from "@/lib/extraction/classifyHeuristics";
import { mockExtractDocument } from "@/lib/extraction/mockExtractors";

/**
 * Fully offline, deterministic provider. No network calls, no API key.
 * Default for local development, tests, and demo mode (see .env.example).
 */
export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";

  async classifyDocument(text: string, _candidateTypes: DocumentClassification[]): Promise<ClassificationResult> {
    const result = classifyByKeywords(text, "");
    return result;
  }

  async extractFields(
    documentType: DocumentClassification,
    text: string,
    _fieldSpecs: FieldSpec[]
  ): Promise<ExtractionRawResult> {
    const raw = mockExtractDocument(documentType, text);
    return { raw, modelName: "mock-deterministic-v1" };
  }
}
