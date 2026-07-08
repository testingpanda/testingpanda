import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function isPasswordStrongEnough(plain: string): boolean {
  // MVP policy: length is the dominant factor. Documented as a TODO to add
  // breached-password checks (e.g. HaveIBeenPwned k-anonymity API) in production.
  return typeof plain === "string" && plain.length >= 10;
}
