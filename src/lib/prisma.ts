import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Privacy-by-design: Prisma's query logging is intentionally NOT enabled
 * here, even at "query" level, because bound parameter values (salaries,
 * bank balances, health data...) would end up in application logs.
 */
export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
