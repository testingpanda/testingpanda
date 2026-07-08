"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/client/apiFetch";

const CURRENT_YEAR = new Date().getFullYear();

export default function NewCasePage() {
  const router = useRouter();
  const [taxYear, setTaxYear] = useState(CURRENT_YEAR - 1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { taxCase } = await apiJson<{ taxCase: { id: string } }>("/api/cases", {
        method: "POST",
        body: JSON.stringify({ taxYear, canton: "GE" }),
      });
      router.push(`/cases/${taxCase.id}/upload`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create case");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Start a new tax case</h1>
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="label">Canton</label>
          <input className="input bg-slate-50" value="Geneva (GE)" disabled />
          <p className="mt-1 text-xs text-slate-500">Only Geneva is supported in this MVP.</p>
        </div>
        <div>
          <label className="label">Tax year</label>
          <input
            className="input"
            type="number"
            required
            min={2015}
            max={2100}
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={loading} type="submit">
          {loading ? "Creating…" : "Create tax case"}
        </button>
      </form>
    </div>
  );
}
