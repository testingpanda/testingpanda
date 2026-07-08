const STATUS_STYLES: Record<string, string> = {
  created: "bg-slate-100 text-slate-700",
  documents_uploaded: "bg-slate-100 text-slate-700",
  extraction_in_progress: "bg-amber-100 text-amber-800",
  extraction_completed: "bg-amber-100 text-amber-800",
  user_review_in_progress: "bg-blue-100 text-blue-800",
  validation_blocked: "bg-red-100 text-red-800",
  ready_for_generation: "bg-emerald-100 text-emerald-800",
  generated: "bg-emerald-100 text-emerald-800",
  finalized: "bg-emerald-200 text-emerald-900",
  deleted: "bg-slate-200 text-slate-500",

  extracted: "bg-slate-100 text-slate-700",
  needs_review: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  edited_confirmed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  not_applicable: "bg-slate-200 text-slate-600",
  missing: "bg-orange-100 text-orange-800",
  unresolved: "bg-amber-100 text-amber-800",

  INFO: "bg-blue-100 text-blue-800",
  WARNING: "bg-amber-100 text-amber-800",
  BLOCKING: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700";
  return <span className={`badge ${style}`}>{status.replace(/_/g, " ")}</span>;
}
