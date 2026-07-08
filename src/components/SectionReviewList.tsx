"use client";

import { useState } from "react";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { apiJson } from "@/lib/client/apiFetch";

interface SectionItem {
  id: string;
  declarationFieldLabel: string;
  mappedValue: string | null;
  mappedCurrency: string | null;
  status: string;
  confidence: number | null;
  evidenceExcerpt: string | null;
  sourceDocumentName: string | null;
  sourcePageNumber: number | null;
}

interface Section {
  id: string;
  key: string;
  label: string;
  description: string | null;
  required: boolean;
  items: SectionItem[];
}

export function SectionReviewList({ caseId, initialSections }: { caseId: string; initialSections: Section[] }) {
  const [sections, setSections] = useState(initialSections);
  const [busySectionId, setBusySectionId] = useState<string | null>(null);

  async function resolveEmpty(sectionId: string, action: "NOT_APPLICABLE" | "MARK_MISSING") {
    setBusySectionId(sectionId);
    try {
      const { mapping } = await apiJson<{ mapping: SectionItem }>(`/api/cases/${caseId}/sections/${sectionId}/resolve-empty`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setSections((secs) => secs.map((s) => (s.id === sectionId ? { ...s, items: [mapping] } : s)));
    } finally {
      setBusySectionId(null);
    }
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <div key={section.id}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-base font-semibold">{section.label}</h3>
            {section.required && <span className="badge bg-red-50 text-red-700">Required</span>}
          </div>
          {section.description && <p className="mb-3 text-sm text-slate-500">{section.description}</p>}

          {section.items.length === 0 ? (
            <div className="card space-y-3 text-sm text-slate-500">
              <p>
                No information found for this section. If this doesn&apos;t apply to you, say so below — otherwise upload a
                supporting document, or add it under &ldquo;Missing info&rdquo;.
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={busySectionId === section.id}
                  onClick={() => resolveEmpty(section.id, "NOT_APPLICABLE")}
                >
                  Not applicable to me
                </button>
                <button
                  className="btn-secondary"
                  disabled={busySectionId === section.id}
                  onClick={() => resolveEmpty(section.id, "MARK_MISSING")}
                >
                  I need to find this document
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {section.items.map((item) => (
                <ConfirmationCard
                  key={item.id}
                  id={item.id}
                  kind="tax-field-mapping"
                  label={item.declarationFieldLabel}
                  value={item.mappedValue}
                  currency={item.mappedCurrency}
                  status={item.status}
                  confidence={item.confidence}
                  evidenceExcerpt={item.evidenceExcerpt}
                  sourceDocumentName={item.sourceDocumentName}
                  sourcePageNumber={item.sourcePageNumber}
                  onUpdated={(updated) =>
                    setSections((secs) =>
                      secs.map((s) =>
                        s.id === section.id
                          ? { ...s, items: s.items.map((it) => (it.id === item.id ? { ...it, status: updated.status } : it)) }
                          : s
                      )
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
