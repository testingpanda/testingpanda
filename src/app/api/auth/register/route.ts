import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/handler";
import { registerUser } from "@/lib/auth/service";
import { createSessionToken, attachAuthCookies } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/audit/log";
import { checkRateLimit, clientIdentifierFromRequest } from "@/lib/security/rateLimit";
import { getEnv } from "@/lib/env";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().max(200).optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const env = getEnv();
  const rate = checkRateLimit(
    `register:${clientIdentifierFromRequest(req)}`,
    env.RATE_LIMIT_LOGIN_MAX,
    env.RATE_LIMIT_LOGIN_WINDOW_SECONDS
  );
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const { email, password, name } = bodySchema.parse(await req.json());
  const user = await registerUser(email, password, name);
  const token = await createSessionToken({ sub: user.id, email: user.email, role: user.role });

  await recordAuditLog({ userId: user.id, action: "USER_REGISTERED", entityType: "User", entityId: user.id, request: req });

  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  return attachAuthCookies(res, token);
});
