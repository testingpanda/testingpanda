"use client";

import { useState } from "react";
import Link from "next/link";
import { apiJson } from "@/lib/client/apiFetch";

export function GenerateAction({ caseId, alreadyGenerated }: { caseId: string; alreadyGenerated: boolean }) {
  const [result, setResult] = useState<{ fillMethod: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onGenerate() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiJson<{ result: { fillMethod: string } }>(`/api/cases/${caseId}/generate`, { method: "POST" });
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-3">
      {!result && !alreadyGenerated && (
        <button className="btn-primary" disabled={loading} onClick={onGenerate}>
          {loading ? "Generating your final package…" : "Generate final package"}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {(result || alreadyGenerated) && (
        <div className="space-y-2">
          <p className="text-sm text-emerald-700">
            Your final package has been generated{result ? ` (declaration fill method: ${result.fillMethod})` : ""}.
          </p>
          <Link href={`/cases/${caseId}/download`} className="btn-primary inline-block">
            Go to download
          </Link>
        </div>
      )}
    </div>
  );
}
