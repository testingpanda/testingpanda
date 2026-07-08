import { z } from "zod";
import type { DocumentClassification } from "@prisma/client";
import { FIELD_SPECS } from "@/lib/extraction/fieldSpecs";

/** The envelope every single extracted field must conform to, regardless of document type. */
export const FieldValueSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  confidence: z.number().min(0).max(1),
  evidenceExcerpt: z.string().nullable(),
  currency: z.string().length(3).nullable().optional(),
  period: z.string().nullable().optional(),
});
export type FieldValue = z.infer<typeof FieldValueSchema>;

const schemaCache = new Map<DocumentClassification, z.ZodTypeAny>();

/**
 * Builds a STRICT per-document-type schema: exactly the keys defined for
 * that document type in fieldSpecs.ts, each following FieldValueSchema, and
 * `.strict()` so unexpected keys invented by a model are rejected outright
 * rather than silently passed through.
 */
export function getExtractionSchema(documentType: DocumentClassification): z.ZodTypeAny {
  const cached = schemaCache.get(documentType);
  if (cached) return cached;

  const specs = FIELD_SPECS[documentType] ?? [];
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const spec of specs) {
    shape[spec.key] = FieldValueSchema;
  }
  const schema = z.object(shape).strict();
  schemaCache.set(documentType, schema);
  return schema;
}

export type ExtractionRecord = Record<string, FieldValue>;

export function validateExtraction(
  documentType: DocumentClassification,
  candidate: unknown
): { success: true; data: ExtractionRecord } | { success: false; error: string } {
  const schema = getExtractionSchema(documentType);
  const result = schema.safeParse(candidate);
  if (!result.success) {
    return { success: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { success: true, data: result.data as ExtractionRecord };
}
