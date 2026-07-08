import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/guard";
import { AuthServiceError } from "@/lib/auth/service";

/**
 * Uniform error handling for API route handlers. Deliberately logs only
 * error class + message (structural information), never full error objects
 * or request bodies, to avoid leaking tax data into application logs.
 */
export function withErrorHandling<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof AuthError || err instanceof AuthServiceError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 422 });
      }
      // eslint-disable-next-line no-console
      console.error("Unhandled API error:", err instanceof Error ? err.message : "unknown error");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
