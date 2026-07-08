import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/handler";
import { authenticateUser, AuthServiceError } from "@/lib/auth/service";
import { createSessionToken, attachAuthCookies } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/audit/log";
import { checkRateLimit, clientIdentifierFromRequest } from "@/lib/security/rateLimit";
import { getEnv } from "@/lib/env";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = withErrorHandling(async (req: Request) => {
  const env = getEnv();
  const identifier = clientIdentifierFromRequest(req);
  const rate = checkRateLimit(`login:${identifier}`, env.RATE_LIMIT_LOGIN_MAX, env.RATE_LIMIT_LOGIN_WINDOW_SECONDS);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
  }

  const { email, password } = bodySchema.parse(await req.json());

  try {
    const user = await authenticateUser(email, password);
    const token = await createSessionToken({ sub: user.id, email: user.email, role: user.role });
    await recordAuditLog({ userId: user.id, action: "USER_LOGIN", entityType: "User", entityId: user.id, request: req });
    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    return attachAuthCookies(res, token);
  } catch (err) {
    if (err instanceof AuthServiceError) {
      // Deliberately omit the email from metadata — it is a personal identifier
      // and must not be written into the audit log (see AuditLog schema note).
      await recordAuditLog({ action: "USER_LOGIN_FAILED", entityType: "User", request: req });
    }
    throw err;
  }
});
