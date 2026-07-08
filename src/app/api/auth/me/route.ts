import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/handler";
import { getSession } from "@/lib/auth/session";

export const GET = withErrorHandling(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: session.sub, email: session.email, role: session.role } });
});
