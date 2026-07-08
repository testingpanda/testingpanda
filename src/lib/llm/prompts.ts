import type { DocumentClassification } from "@prisma/client";
import type { FieldSpec } from "@/lib/llm/types";

/**
 * Deterministic prompt builders. Every prompt: (a) states the exact JSON
 * shape required, (b) forbids inventing values, (c) requires an explicit
 * confidence per field, (d) requires an evidence excerpt copied verbatim
 * from the source text. Output is still Zod-validated downstream — the
 * model's own claim of correctness is never trusted on its own.
 */

export function buildClassificationPrompt(text: string, candidateTypes: DocumentClassification[]) {
  const system =
    "You are a Swiss tax document classifier. You only ever respond with a single JSON object. " +
    "You never provide advice, opinions, or unstructured prose.";
  const user = `Classify the following document into exactly one of these categories:
${candidateTypes.join(", ")}

Respond with a JSON object of this exact shape:
{"classification": "<one of the categories above>", "confidence": <number 0-1>, "rationale": "<short reason, max 200 chars>"}

Document text (may be truncated):
"""
${text.slice(0, 6000)}
"""`;
  return { system, user };
}

export function buildExtractionPrompt(documentType: DocumentClassification, text: string, fieldSpecs: FieldSpec[]) {
  const system =
    "You are a precise Swiss (Geneva) tax data extraction engine. You only ever respond with a single JSON object " +
    "matching the requested shape. You NEVER invent values that are not present in the source text. If a field is " +
    "not present, set its value to null and confidence to 0. Every non-null field must include an evidence excerpt " +
    "copied verbatim from the source text.";

  const fieldsDescription = fieldSpecs
    .map((f) => `  - "${f.key}" (${f.type}): ${f.label} — ${f.description}`)
    .join("\n");

  const shape = {
    fields: fieldSpecs.map((f) => ({
      key: f.key,
      value: `<${f.type} or null>`,
      confidence: "<number 0-1>",
      evidenceExcerpt: "<verbatim excerpt or null>",
      currency: "<ISO currency code or null>",
      period: "<period string or null>",
    })),
  };

  const user = `Document type: ${documentType}

Extract exactly these fields:
${fieldsDescription}

Respond with a JSON object of this exact shape:
${JSON.stringify(shape, null, 2)}

Document text (may be truncated):
"""
${text.slice(0, 8000)}
"""`;

  return { system, user };
}
