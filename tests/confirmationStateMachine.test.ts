import { describe, it, expect } from "vitest";
import { applyConfirmationAction, isResolvedStatus } from "@/lib/validation/engine";

describe("confirmation state machine", () => {
  it("maps every ConfirmationAction to the correct ItemStatus", () => {
    expect(applyConfirmationAction("CONFIRM")).toBe("confirmed");
    expect(applyConfirmationAction("EDIT_CONFIRM")).toBe("edited_confirmed");
    expect(applyConfirmationAction("REJECT")).toBe("rejected");
    expect(applyConfirmationAction("NOT_APPLICABLE")).toBe("not_applicable");
    expect(applyConfirmationAction("MARK_MISSING")).toBe("missing");
  });

  it("REQUEST_HELP is informational only and does not change status", () => {
    expect(applyConfirmationAction("REQUEST_HELP")).toBeNull();
  });

  it("treats extracted/needs_review/unresolved as unresolved", () => {
    expect(isResolvedStatus("extracted")).toBe(false);
    expect(isResolvedStatus("needs_review")).toBe(false);
    expect(isResolvedStatus("unresolved")).toBe(false);
  });

  it("treats confirmed/edited_confirmed/rejected/not_applicable/missing as resolved", () => {
    expect(isResolvedStatus("confirmed")).toBe(true);
    expect(isResolvedStatus("edited_confirmed")).toBe(true);
    expect(isResolvedStatus("rejected")).toBe(true);
    expect(isResolvedStatus("not_applicable")).toBe(true);
    expect(isResolvedStatus("missing")).toBe(true);
  });
});
