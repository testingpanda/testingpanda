import type { DocumentClassification } from "@prisma/client";

export interface FieldSpec {
  key: string;
  label: string;
  type: "amount" | "date" | "string" | "boolean" | "period";
  description: string;
}

export interface ClassificationResult {
  classification: DocumentClassification;
  confidence: number;
  rationale: string;
}

export interface ExtractionRawResult {
  /** Unvalidated JSON straight from the model / heuristic engine. The caller
   * (src/lib/extraction/extract.ts) is responsible for Zod validation —
   * providers never get to assert their own output is trustworthy. */
  raw: unknown;
  modelName: string;
}

/**
 * LLM provider abstraction. Swappable via LLM_PROVIDER env var without
 * touching any calling code (see src/lib/llm/index.ts).
 */
export interface LLMProvider {
  readonly name: string;
  classifyDocument(text: string, candidateTypes: DocumentClassification[]): Promise<ClassificationResult>;
  extractFields(
    documentType: DocumentClassification,
    text: string,
    fieldSpecs: FieldSpec[]
  ): Promise<ExtractionRawResult>;
}
