import type { DocumentClassification } from "@prisma/client";
import { getLLMProvider } from "@/lib/llm";
import type { FieldSpec } from "@/lib/llm/types";
import { FIELD_SPECS } from "@/lib/extraction/fieldSpecs";
import { validateExtraction, type ExtractionRecord } from "@/lib/extraction/schemas";

export interface ExtractionOutcome {
  status: "success" | "failed";
  records: ExtractionRecord;
  error?: string;
  modelName: string;
}

function coerceFieldEntry(entry: unknown) {
  if (entry && typeof entry === "object") {
    const e = entry as Record<string, unknown>;
    return {
      value: (typeof e.value === "string" || typeof e.value === "number" || typeof e.value === "boolean" ? e.value : null) as
        | string
        | number
        | boolean
        | null,
      confidence: typeof e.confidence === "number" ? Math.min(1, Math.max(0, e.confidence)) : 0,
      evidenceExcerpt: typeof e.evidenceExcerpt === "string" ? e.evidenceExcerpt : null,
      currency: typeof e.currency === "string" && e.currency.length === 3 ? e.currency : null,
      period: typeof e.period === "string" ? e.period : null,
    };
  }
  return { value: null, confidence: 0, evidenceExcerpt: null, currency: null, period: null };
}

/** Accepts either `{fields: [{key, ...}]}` (real LLM providers) or an already-keyed object (mock provider). */
function normalizeRawExtraction(raw: unknown, fieldSpecs: FieldSpec[]): Record<string, unknown> {
  let keyed: Record<string, unknown> = {};
  if (raw && typeof raw === "object" && Array.isArray((raw as any).fields)) {
    for (const item of (raw as any).fields) {
      if (item && typeof item === "object" && typeof (item as any).key === "string") {
        keyed[(item as any).key] = item;
      }
    }
  } else if (raw && typeof raw === "object") {
    keyed = raw as Record<string, unknown>;
  }

  const normalized: Record<string, unknown> = {};
  for (const spec of fieldSpecs) {
    normalized[spec.key] = coerceFieldEntry(keyed[spec.key]);
  }
  return normalized;
}

/**
 * Runs the extraction step for a single document's text against its
 * document-type schema. Never trusts provider output directly — always
 * coerces to the expected envelope shape and then Zod-validates the strict
 * per-document-type schema before returning.
 */
export async function extractDocumentFields(
  documentType: DocumentClassification,
  text: string
): Promise<ExtractionOutcome> {
  const fieldSpecs = FIELD_SPECS[documentType] ?? [];
  if (fieldSpecs.length === 0) {
    return { status: "success", records: {}, modelName: "n/a" };
  }

  const provider = getLLMProvider();
  let rawResult;
  try {
    rawResult = await provider.extractFields(documentType, text, fieldSpecs);
  } catch (err) {
    return {
      status: "failed",
      records: {},
      error: err instanceof Error ? err.message : "Extraction call failed",
      modelName: provider.name,
    };
  }

  const normalized = normalizeRawExtraction(rawResult.raw, fieldSpecs);
  const validation = validateExtraction(documentType, normalized);
  if (!validation.success) {
    return { status: "failed", records: {}, error: validation.error, modelName: rawResult.modelName };
  }

  return { status: "success", records: validation.data, modelName: rawResult.modelName };
}
