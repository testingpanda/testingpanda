import { describe, it, expect, afterEach } from "vitest";
import { requireCaseOwnership, requireDocumentOwnership, AuthError } from "@/lib/auth/guard";
import { createTestUser, createTestCase, createTestDocument, cleanupUser } from "./helpers";

describe("access control", () => {
  let ownerId: string | undefined;
  let strangerId: string | undefined;

  afterEach(async () => {
    if (ownerId) await cleanupUser(ownerId);
    if (strangerId) await cleanupUser(strangerId);
    ownerId = undefined;
    strangerId = undefined;
  });

  it("lets the owning user access their own case", async () => {
    const owner = await createTestUser();
    ownerId = owner.id;
    const taxCase = await createTestCase(owner.id);

    const result = await requireCaseOwnership(taxCase.id, { id: owner.id, email: owner.email, role: "USER", name: null });
    expect(result.id).toBe(taxCase.id);
  });

  it("denies a different user access to someone else's case (404, not 403)", async () => {
    const owner = await createTestUser();
    ownerId = owner.id;
    const stranger = await createTestUser();
    strangerId = stranger.id;
    const taxCase = await createTestCase(owner.id);

    await expect(
      requireCaseOwnership(taxCase.id, { id: stranger.id, email: stranger.email, role: "USER", name: null })
    ).rejects.toBeInstanceOf(AuthError);

    try {
      await requireCaseOwnership(taxCase.id, { id: stranger.id, email: stranger.email, role: "USER", name: null });
    } catch (err) {
      expect((err as AuthError).status).toBe(404);
    }
  });

  it("allows an admin to access any user's case", async () => {
    const owner = await createTestUser();
    ownerId = owner.id;
    const admin = await createTestUser("ADMIN");
    strangerId = admin.id;
    const taxCase = await createTestCase(owner.id);

    const result = await requireCaseOwnership(taxCase.id, { id: admin.id, email: admin.email, role: "ADMIN", name: null });
    expect(result.id).toBe(taxCase.id);
  });

  it("denies access to a document belonging to another user's case", async () => {
    const owner = await createTestUser();
    ownerId = owner.id;
    const stranger = await createTestUser();
    strangerId = stranger.id;
    const taxCase = await createTestCase(owner.id);
    const doc = await createTestDocument(taxCase.id, owner.id);

    await expect(
      requireDocumentOwnership(doc.id, { id: stranger.id, email: stranger.email, role: "USER", name: null })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("treats a soft-deleted case as not found for ownership checks", async () => {
    const owner = await createTestUser();
    ownerId = owner.id;
    const taxCase = await createTestCase(owner.id);
    const { prisma } = await import("@/lib/prisma");
    await prisma.taxCase.update({ where: { id: taxCase.id }, data: { status: "deleted" } });

    await expect(
      requireCaseOwnership(taxCase.id, { id: owner.id, email: owner.email, role: "USER", name: null })
    ).rejects.toBeInstanceOf(AuthError);
  });
});
