"use client";

import { useState } from "react";
import { apiJson } from "@/lib/client/apiFetch";

interface DocSummary {
  id: string;
  originalFilename: string;
  classification: string | null;
  classificationConfidence: number | null;
  classificationSource: string | null;
  status: string;
  textExtractionMethod: string;
}

const CLASSIFICATION_OPTIONS = [
  "PreviousTaxDeclaration",
  "CurrentBlankDeclaration",
  "SalaryCertificate",
  "BankStatement",
  "SecuritiesStatement",
  "ThirdPillar",
  "PensionFund",
  "HealthInsurance",
  "MedicalExpense",
  "Childcare",
  "Mortgage",
  "RealEstate",
  "Donation",
  "Debt",
  "Insurance",
  "SelfEmployment",
  "Vehicle",
  "Other",
];

export function DocumentClassificationList({ initialDocuments }: { initialDocuments: DocSummary[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function reclassify(id: string, classification: string) {
    setSavingId(id);
    try {
      const { document } = await apiJson<{ document: DocSummary }>(`/api/documents/${id}/reclassify`, {
        method: "POST",
        body: JSON.stringify({ classification }),
      });
      setDocuments((docs) => docs.map((d) => (d.id === id ? { ...d, ...document } : d)));
    } finally {
      setSavingId(null);
    }
  }

  if (documents.length === 0) {
    return <p className="card text-sm text-slate-600">No documents uploaded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div key={doc.id} className="card flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{doc.originalFilename}</p>
            <p className="text-sm text-slate-500">
              Status: {doc.status} · Text extraction: {doc.textExtractionMethod}
              {doc.classificationConfidence !== null &&
                ` · AI confidence: ${Math.round((doc.classificationConfidence ?? 0) * 100)}%`}
              {doc.classificationSource && ` · Source: ${doc.classificationSource}`}
            </p>
          </div>
          <select
            className="input w-56"
            value={doc.classification ?? ""}
            disabled={savingId === doc.id}
            onChange={(e) => reclassify(doc.id, e.target.value)}
          >
            <option value="" disabled>
              Select type…
            </option>
            {CLASSIFICATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
