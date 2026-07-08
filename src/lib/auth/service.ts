import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/auth/password";

export class AuthServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function registerUser(email: string, password: string, name?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new AuthServiceError("A valid email is required", 422);
  }
  if (!isPasswordStrongEnough(password)) {
    throw new AuthServiceError("Password must be at least 10 characters", 422);
  }
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    // Deliberately vague to avoid account enumeration.
    throw new AuthServiceError("Unable to create account with these details", 409);
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email: normalizedEmail, passwordHash, name: name?.trim() || null },
  });
  return user;
}

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    // Constant-ish work to reduce timing-based user enumeration.
    await verifyPassword(password, "$2a$12$invalidsaltinvalidsaltinvalidsalu");
    throw new AuthServiceError("Invalid email or password", 401);
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AuthServiceError("Invalid email or password", 401);
  }
  return user;
}
