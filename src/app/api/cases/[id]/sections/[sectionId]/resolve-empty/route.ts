import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { resolveEmptySection } from "@/lib/confirmations/service";
import { serializeTaxFieldMapping } from "@/lib/api/serialize";

const bodySchema = z.object({ action: z.enum(["NOT_APPLICABLE", "MARK_MISSING"]) });

/** Resolves a required section that has no uploaded document / mapped item at all (e.g. "I have no bank accounts"). */
export const POST = withErrorHandling(async (req: Request, { params }: { params: { id: string; sectionId: string } }) => {
  const user = await requireUser();
  await requireCaseOwnership(params.id, user);
  const { action } = bodySchema.parse(await req.json());
  const mapping = await resolveEmptySection(params.id, params.sectionId, { userId: user.id, action });
  return NextResponse.json({ mapping: serializeTaxFieldMapping(mapping) });
});
