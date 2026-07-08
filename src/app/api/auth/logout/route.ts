import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { getSession, clearAuthCookies } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/audit/log";

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getSession();
  if (session) {
    await recordAuditLog({ userId: session.sub, action: "USER_LOGOUT", entityType: "User", entityId: session.sub, request: req });
  }
  return clearAuthCookies(NextResponse.json({ ok: true }));
});
