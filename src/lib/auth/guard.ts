import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export interface AuthedUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  name: string | null;
}

/** Throws AuthError(401) if there is no valid session. Use in API routes and server components. */
export async function requireUser(): Promise<AuthedUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Authentication required", 401);
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) throw new AuthError("Authentication required", 401);
  return { id: user.id, email: user.email, role: user.role, name: user.name };
}

/** Throws AuthError(403) if the current user is not an admin. */
export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AuthError("Admin access required", 403);
  return user;
}

/** Ensures the tax case belongs to the given user (or the user is an admin). Throws AuthError(404) otherwise, deliberately not 403, to avoid leaking existence of other users' cases. */
export async function requireCaseOwnership(caseId: string, user: AuthedUser) {
  const taxCase = await prisma.taxCase.findUnique({ where: { id: caseId } });
  if (!taxCase || taxCase.status === "deleted") throw new AuthError("Tax case not found", 404);
  if (taxCase.userId !== user.id && user.role !== "ADMIN") {
    throw new AuthError("Tax case not found", 404);
  }
  return taxCase;
}

/** Same ownership rule as requireCaseOwnership, resolved from a document/extracted-field's parent case. */
export async function requireDocumentOwnership(documentId: string, user: AuthedUser) {
  const document = await prisma.uploadedDocument.findUnique({ where: { id: documentId }, include: { taxCase: true } });
  if (!document || document.taxCase.status === "deleted") throw new AuthError("Document not found", 404);
  if (document.taxCase.userId !== user.id && user.role !== "ADMIN") {
    throw new AuthError("Document not found", 404);
  }
  return document;
}

export async function requireExtractedFieldOwnership(extractedFieldId: string, user: AuthedUser) {
  const field = await prisma.extractedField.findUnique({ where: { id: extractedFieldId }, include: { taxCase: true } });
  if (!field || field.taxCase.status === "deleted") throw new AuthError("Field not found", 404);
  if (field.taxCase.userId !== user.id && user.role !== "ADMIN") throw new AuthError("Field not found", 404);
  return field;
}

export async function requireTaxFieldMappingOwnership(mappingId: string, user: AuthedUser) {
  const mapping = await prisma.taxFieldMapping.findUnique({ where: { id: mappingId }, include: { taxCase: true } });
  if (!mapping || mapping.taxCase.status === "deleted") throw new AuthError("Mapping not found", 404);
  if (mapping.taxCase.userId !== user.id && user.role !== "ADMIN") throw new AuthError("Mapping not found", 404);
  return mapping;
}
