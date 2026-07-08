"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/apiFetch";

export function DeleteCaseButton({ caseId, taxYear }: { caseId: string; taxYear: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (!confirm(`Permanently delete your ${taxYear} tax case and all uploaded documents? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await apiFetch(`/api/cases/${caseId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn-danger" disabled={loading} onClick={onDelete}>
      {loading ? "Deleting…" : "Delete permanently"}
    </button>
  );
}
