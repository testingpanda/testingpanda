"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/client/apiFetch";

const CHECKS = [
  { key: "reviewedAllValues", label: "I have reviewed all extracted values." },
  { key: "understandsNotCertifiedAdvice", label: "I understand this is AI-assisted preparation, not certified tax advice." },
  { key: "remainsResponsible", label: "I understand I remain responsible for the tax declaration." },
  { key: "confirmsComplete", label: "I confirm the information is complete to the best of my knowledge." },
  { key: "wantsToGenerate", label: "I want to generate the final printable package." },
] as const;

export function FinalDeclarationForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allChecked = CHECKS.every((c) => checked[c.key]);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await apiJson(`/api/cases/${caseId}/final-declaration`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(CHECKS.map((c) => [c.key, true]))),
      });
      router.push(`/cases/${caseId}/generate`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record your confirmation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-4">
      <h3 className="font-medium">Final declaration</h3>
      <div className="space-y-2">
        {CHECKS.map((c) => (
          <label key={c.key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(checked[c.key])}
              onChange={(e) => setChecked((prev) => ({ ...prev, [c.key]: e.target.checked }))}
            />
            {c.label}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={!allChecked || loading} onClick={onSubmit}>
        {loading ? "Recording…" : "Accept and continue to generation"}
      </button>
    </div>
  );
}
