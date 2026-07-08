import { prisma } from "@/lib/prisma";
import type { AuditAction, Prisma } from "@prisma/client";

export interface AuditLogInput {
  userId?: string | null;
  taxCaseId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}

// Defense-in-depth: even though callers should never pass raw tax data here,
// strip any key that looks like it might carry it before persisting.
const FORBIDDEN_KEY_PATTERN =
  /value|amount|salary|balance|iban|income|salaire|montant|health|medical|ssn|avs.?number|password/i;

function sanitizeMetadata(metadata?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!metadata) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) continue;
    clean[key] = value;
  }
  return clean as Prisma.InputJsonValue;
}

/**
 * Single entry point for writing to the audit trail. `metadata` must only
 * ever contain non-sensitive, structural information (counts, IDs, status
 * transitions) — never raw tax, salary, bank, or health values. See the
 * privacy-by-design note on the AuditLog model in prisma/schema.prisma.
 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  const ip = input.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = input.request?.headers.get("user-agent") ?? null;

  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      taxCaseId: input.taxCaseId ?? null,
      taxCaseIdSnapshot: input.taxCaseId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: sanitizeMetadata(input.metadata),
      ipAddress: ip,
      userAgent,
    },
  });
}
