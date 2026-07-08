"use client";

import { useState } from "react";
import { ConfirmationCard } from "@/components/ConfirmationCard";

interface FieldItem {
  id: string;
  label: string;
  value: string | null;
  currency: string | null;
  status: string;
  confidence: number;
  evidenceExcerpt: string | null;
  sourceDocumentName: string;
  sourcePageNumber: number | null;
}

export function ExtractionReviewList({ initialFields }: { initialFields: FieldItem[] }) {
  const [fields, setFields] = useState(initialFields);

  if (fields.length === 0) {
    return <p className="card text-sm text-slate-600">No extracted fields yet — upload documents first.</p>;
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <ConfirmationCard
          key={field.id}
          id={field.id}
          kind="extracted-field"
          label={field.label}
          value={field.value}
          currency={field.currency}
          status={field.status}
          confidence={field.confidence}
          evidenceExcerpt={field.evidenceExcerpt}
          sourceDocumentName={field.sourceDocumentName}
          sourcePageNumber={field.sourcePageNumber}
          onUpdated={(updated) => setFields((fs) => fs.map((f) => (f.id === field.id ? { ...f, status: updated.status } : f)))}
        />
      ))}
    </div>
  );
}
