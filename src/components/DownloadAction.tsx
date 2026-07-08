"use client";

import { useState } from "react";
import { apiJson } from "@/lib/client/apiFetch";

export function DownloadAction({ caseId }: { caseId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onDownload() {
    setError(null);
    setLoading(true);
    try {
      const { token } = await apiJson<{ token: string }>(`/api/cases/${caseId}/download-token`);
      window.location.href = `/api/download?token=${encodeURIComponent(token)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare your download");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button className="btn-primary" disabled={loading} onClick={onDownload}>
        {loading ? "Preparing download…" : "Download final package (.zip)"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
