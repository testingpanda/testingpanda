"use client";

import { useState } from "react";
import { apiJson } from "@/lib/client/apiFetch";
import { StatusBadge } from "@/components/StatusBadge";

export interface ConfirmationCardProps {
  id: string;
  kind: "extracted-field" | "tax-field-mapping";
  label: string;
  sectionLabel?: string;
  value: string | null;
  currency?: string | null;
  status: string;
  confidence?: number | null;
  sourceDocumentName?: string | null;
  sourcePageNumber?: number | null;
  evidenceExcerpt?: string | null;
  onUpdated?: (result: any) => void;
}

const ENDPOINT_BASE: Record<ConfirmationCardProps["kind"], string> = {
  "extracted-field": "/api/extracted-fields",
  "tax-field-mapping": "/api/tax-field-mappings",
};

export function ConfirmationCard(props: ConfirmationCardProps) {
  const [editing, setEditing] = useState(false);
  const [helping, setHelping] = useState(false);
  const [editValue, setEditValue] = useState(props.value ?? "");
  const [helpNote, setHelpNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState(props.status);

  async function act(action: string, extra?: { editedValue?: string; note?: string }) {
    setBusy(true);
    try {
      const data = await apiJson(`${ENDPOINT_BASE[props.kind]}/${props.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ action, ...extra }),
      });
      const updated = (data as any).field ?? (data as any).mapping;
      setLocalStatus(updated?.status ?? localStatus);
      setEditing(false);
      setHelping(false);
      props.onUpdated?.(updated);
    } finally {
      setBusy(false);
    }
  }

  const confidencePct = props.confidence !== null && props.confidence !== undefined ? Math.round(props.confidence * 100) : null;
  const needsAttention = confidencePct !== null && confidencePct < 75;

  return (
    <div className={`card ${needsAttention ? "border-amber-300" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {props.sectionLabel && <p className="text-xs uppercase tracking-wide text-slate-400">{props.sectionLabel}</p>}
          <p className="font-medium">{props.label}</p>
          <p className="mt-1 text-lg">
            {props.value ?? <span className="text-slate-400">Not found</span>}
            {props.currency && props.value ? ` ${props.currency}` : ""}
          </p>
          <dl className="mt-2 space-y-0.5 text-xs text-slate-500">
            {props.sourceDocumentName && (
              <div>
                Source: {props.sourceDocumentName}
                {props.sourcePageNumber ? `, page ${props.sourcePageNumber}` : ""}
              </div>
            )}
            {confidencePct !== null && <div>Confidence: {confidencePct}%</div>}
            {props.evidenceExcerpt && <div className="italic">&ldquo;{props.evidenceExcerpt}&rdquo;</div>}
          </dl>
        </div>
        <StatusBadge status={localStatus} />
      </div>

      {editing && (
        <div className="mt-3 flex gap-2">
          <input className="input" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
          <button className="btn-primary" disabled={busy} onClick={() => act("EDIT_CONFIRM", { editedValue: editValue })}>
            Save
          </button>
          <button className="btn-secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      )}

      {helping && (
        <div className="mt-3 flex gap-2">
          <input
            className="input"
            placeholder="What do you need help understanding?"
            value={helpNote}
            onChange={(e) => setHelpNote(e.target.value)}
          />
          <button className="btn-primary" disabled={busy} onClick={() => act("REQUEST_HELP", { note: helpNote })}>
            Send
          </button>
          <button className="btn-secondary" onClick={() => setHelping(false)}>
            Cancel
          </button>
        </div>
      )}

      {!editing && !helping && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => act("CONFIRM")}>
            Confirm
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => act("REJECT")}>
            Reject
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => act("NOT_APPLICABLE")}>
            Not applicable
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => act("MARK_MISSING")}>
            Mark missing
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => setHelping(true)}>
            Need help / explanation
          </button>
        </div>
      )}
    </div>
  );
}
