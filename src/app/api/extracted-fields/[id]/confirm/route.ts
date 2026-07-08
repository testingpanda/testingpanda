import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireExtractedFieldOwnership } from "@/lib/auth/guard";
import { confirmExtractedField } from "@/lib/confirmations/service";
import { serializeExtractedField } from "@/lib/api/serialize";

const bodySchema = z.object({
  action: z.enum(["CONFIRM", "EDIT_CONFIRM", "REJECT", "NOT_APPLICABLE", "MARK_MISSING", "REQUEST_HELP"]),
  editedValue: z.string().max(2000).optional(),
  note: z.string().max(2000).optional(),
});

export const POST = withErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await requireExtractedFieldOwnership(params.id, user);
  const body = bodySchema.parse(await req.json());
  const updated = await confirmExtractedField(params.id, { userId: user.id, ...body });
  return NextResponse.json({ field: serializeExtractedField(updated) });
});
