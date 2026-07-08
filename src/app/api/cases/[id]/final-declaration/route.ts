import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { checkGenerationGate } from "@/lib/validation/engine";
import { recordAuditLog } from "@/lib/audit/log";

const bodySchema = z.object({
  reviewedAllValues: z.literal(true),
  understandsNotCertifiedAdvice: z.literal(true),
  remainsResponsible: z.literal(true),
  confirmsComplete: z.literal(true),
  wantsToGenerate: z.literal(true),
});

/**
 * The five mandatory checkboxes gating final package generation. Server-side
 * enforcement (z.literal(true) on every field) is what actually matters —
 * the client-side checkboxes are only a UX affordance, never trusted alone.
 * This never runs unless src/lib/validation/engine.ts's checkGenerationGate
 * also passes, so the system can never silently finalize unconfirmed values.
 */
export const POST = withErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);

  const gate = await checkGenerationGate(taxCase.id);
  if (!gate.canGenerate) {
    return NextResponse.json({ error: "Cannot accept final declaration yet", blockingReasons: gate.blockingReasons }, { status: 409 });
  }

  bodySchema.parse(await req.json());

  await prisma.userConfirmation.create({
    data: {
      taxCaseId: taxCase.id,
      userId: user.id,
      action: "CONFIRM",
      note: "FINAL_DECLARATION_ACCEPTED",
    },
  });

  await recordAuditLog({
    userId: user.id,
    taxCaseId: taxCase.id,
    action: "FINAL_DECLARATION_ACCEPTED",
    entityType: "TaxCase",
    entityId: taxCase.id,
    request: req,
  });

  return NextResponse.json({ ok: true });
});
