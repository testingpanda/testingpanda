"use client";

import { useRef, useState } from "react";
import { apiFetch, apiJson } from "@/lib/client/apiFetch";

interface DocSummary {
  id: string;
  originalFilename: string;
  classification: string | null;
  classificationConfidence: number | null;
  status: string;
  sizeBytes: number;
}

const DOC_TYPE_OPTIONS = [
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

export function UploadWorkspace({ caseId, initialDocuments }: { caseId: string; initialDocuments: DocSummary[] }) {
  const [documents, setDocuments] = useState<DocSummary[]>(initialDocuments);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const genericInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const { documents } = await apiJson<{ documents: DocSummary[] }>(`/api/cases/${caseId}/documents`);
    setDocuments(documents);
  }

  async function uploadOne(file: File, classification?: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (classification) formData.append("classification", classification);
    const res = await apiFetch(`/api/cases/${caseId}/documents`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Upload failed");
    return data.document as DocSummary;
  }

  async function handleSlotUpload(file: File | null, classification: string) {
    if (!file) return;
    setError(null);
    setBusy(classification);
    try {
      await uploadOne(file, classification);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleGenericUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy("generic");
    try {
      for (const file of Array.from(files)) {
        await uploadOne(file);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
      if (genericInputRef.current) genericInputRef.current.value = "";
    }
  }

  async function handleDelete(documentId: string) {
    if (!confirm("Remove this document and everything extracted from it?")) return;
    await apiFetch(`/api/documents/${documentId}`, { method: "DELETE" });
    await refresh();
  }

  const previousDoc = documents.find((d) => d.classification === "PreviousTaxDeclaration");
  const currentDoc = documents.find((d) => d.classification === "CurrentBlankDeclaration");
  const supportingDocs = documents.filter(
    (d) => d.classification !== "PreviousTaxDeclaration" && d.classification !== "CurrentBlankDeclaration"
  );

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <UploadSlot
          title="1. Previous year's tax declaration"
          description="The filled-in declaration you submitted last year (used for comparison)."
          existing={previousDoc}
          busy={busy === "PreviousTaxDeclaration"}
          onSelect={(file) => handleSlotUpload(file, "PreviousTaxDeclaration")}
          onDelete={handleDelete}
        />
        <UploadSlot
          title="2. This year's blank declaration"
          description="The empty official form to be filled in for this tax year."
          existing={currentDoc}
          busy={busy === "CurrentBlankDeclaration"}
          onSelect={(file) => handleSlotUpload(file, "CurrentBlankDeclaration")}
          onDelete={handleDelete}
        />
      </div>

      <div className="card">
        <h3 className="mb-1 font-medium">3. Supporting documents</h3>
        <p className="mb-3 text-sm text-slate-500">
          Salary certificates, bank statements, 3rd pillar certificates, insurance, mortgage, childcare, medical, donations,
          securities, real estate — upload as many as you have. Each will be classified automatically.
        </p>
        <input
          ref={genericInputRef}
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg"
          disabled={busy === "generic"}
          onChange={(e) => handleGenericUpload(e.target.files)}
          className="text-sm"
        />
        {busy === "generic" && <p className="mt-2 text-sm text-amber-600">Uploading and processing…</p>}

        {supportingDocs.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100">
            {supportingDocs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{doc.originalFilename}</p>
                  <p className="text-slate-500">
                    {doc.classification ?? "Classifying…"}
                    {doc.classificationConfidence !== null && doc.classificationConfidence !== undefined
                      ? ` (${Math.round(doc.classificationConfidence * 100)}% confidence)`
                      : ""}{" "}
                    — {doc.status}
                  </p>
                </div>
                <button className="btn-ghost text-red-600" onClick={() => handleDelete(doc.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function UploadSlot({
  title,
  description,
  existing,
  busy,
  onSelect,
  onDelete,
}: {
  title: string;
  description: string;
  existing?: DocSummary;
  busy: boolean;
  onSelect: (file: File | null) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="card">
      <h3 className="font-medium">{title}</h3>
      <p className="mb-3 text-sm text-slate-500">{description}</p>
      {existing ? (
        <div className="flex items-center justify-between rounded-md bg-slate-50 p-2 text-sm">
          <span>{existing.originalFilename}</span>
          <button className="btn-ghost text-red-600" onClick={() => onDelete(existing.id)}>
            Remove
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          disabled={busy}
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      )}
      {busy && <p className="mt-2 text-sm text-amber-600">Uploading and processing…</p>}
    </div>
  );
}
