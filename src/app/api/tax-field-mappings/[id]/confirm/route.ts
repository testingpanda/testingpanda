import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/handler";
import { requireUser, requireTaxFieldMappingOwnership } from "@/lib/auth/guard";
import { confirmTaxFieldMapping } from "@/lib/confirmations/service";
import { serializeTaxFieldMapping } from "@/lib/api/serialize";

const bodySchema = z.object({
  action: z.enum(["CONFIRM", "EDIT_CONFIRM", "REJECT", "NOT_APPLICABLE", "MARK_MISSING", "REQUEST_HELP"]),
  editedValue: z.string().max(2000).optional(),
  note: z.string().max(2000).optional(),
});

export const POST = withErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await requireTaxFieldMappingOwnership(params.id, user);
  const body = bodySchema.parse(await req.json());
  const updated = await confirmTaxFieldMapping(params.id, { userId: user.id, ...body });
  return NextResponse.json({ mapping: serializeTaxFieldMapping(updated) });
});
