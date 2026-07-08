"use client";

import { useState } from "react";
import { apiJson } from "@/lib/client/apiFetch";
import { StatusBadge } from "@/components/StatusBadge";

interface MissingDoc {
  id: string;
  classification: string;
  reason: string;
  status: string;
  note: string | null;
}

export function MissingDocumentsList({ initialItems }: { initialItems: MissingDoc[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const { missingDocument } = await apiJson<{ missingDocument: MissingDoc }>(`/api/missing-documents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setItems((its) => its.map((it) => (it.id === id ? missingDocument : it)));
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="card text-sm text-slate-600">
        No missing-document alerts right now. This list fills in automatically when something you declared last year
        seems absent this year.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="card flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{item.classification}</p>
            <p className="text-sm text-slate-500">{item.note}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            <button className="btn-secondary" disabled={busyId === item.id} onClick={() => setStatus(item.id, "CONFIRMED_MISSING")}>
              Confirm missing
            </button>
            <button className="btn-secondary" disabled={busyId === item.id} onClick={() => setStatus(item.id, "MARKED_NOT_APPLICABLE")}>
              Not applicable
            </button>
            <button className="btn-ghost" disabled={busyId === item.id} onClick={() => setStatus(item.id, "RESOLVED")}>
              Resolved
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
