import type { ReportSpec } from "@/lib/pdf/textReport";

export interface ReviewSummaryLine {
  sectionLabel: string;
  fieldLabel: string;
  value: string;
  status: string;
  sourceDocument: string;
  confidence: number;
}

export interface ManualEntryNotice {
  required: boolean;
  reason?: string;
}

export function buildReviewSummaryReport(params: {
  taxYear: number;
  canton: string;
  generatedAt: string;
  manualEntry: ManualEntryNotice;
  confirmedLines: ReviewSummaryLine[];
  editedLines: ReviewSummaryLine[];
  rejectedLines: ReviewSummaryLine[];
  notApplicableLines: ReviewSummaryLine[];
  missingLines: ReviewSummaryLine[];
  disclaimer: string;
}): ReportSpec {
  const fmt = (l: ReviewSummaryLine) =>
    `[${l.sectionLabel}] ${l.fieldLabel}: ${l.value} — source: ${l.sourceDocument} (confidence ${Math.round(l.confidence * 100)}%)`;

  const sections = [
    {
      heading: "AI-assisted preparation disclaimer",
      lines: [params.disclaimer],
    },
  ];

  if (params.manualEntry.required) {
    sections.push({
      heading: "Manual transcription required",
      lines: [
        params.manualEntry.reason ??
          "The current-year declaration PDF could not be reliably auto-filled. Use the confirmed values below to fill in the official form by hand.",
      ],
    });
  }

  sections.push(
    { heading: "Confirmed values", lines: params.confirmedLines.map(fmt) },
    { heading: "Edited and confirmed values", lines: params.editedLines.map(fmt) },
    { heading: "Rejected AI suggestions", lines: params.rejectedLines.map(fmt) },
    { heading: "Marked not applicable", lines: params.notApplicableLines.map(fmt) },
    { heading: "Marked missing by user", lines: params.missingLines.map(fmt) }
  );

  return {
    title: "Tax Review Summary",
    subtitle: `Canton ${params.canton} — Tax year ${params.taxYear} — Generated ${params.generatedAt}`,
    sections,
  };
}

export function buildSupportingDocsIndexReport(params: {
  taxYear: number;
  documents: Array<{ filename: string; classification: string; pageCount: number | null; uploadedAt: string }>;
}): ReportSpec {
  return {
    title: "Supporting Documents Index",
    subtitle: `Tax year ${params.taxYear}`,
    sections: [
      {
        heading: "Uploaded documents",
        lines: params.documents.map(
          (d) => `${d.filename} — ${d.classification} — ${d.pageCount ?? "?"} page(s) — uploaded ${d.uploadedAt}`
        ),
      },
    ],
  };
}

export function buildAssumptionsWarningsReport(params: {
  taxYear: number;
  assumptions: Array<{ description: string; rationale: string | null }>;
  warnings: Array<{ severity: string; message: string }>;
}): ReportSpec {
  return {
    title: "Assumptions and Warnings",
    subtitle: `Tax year ${params.taxYear}`,
    sections: [
      {
        heading: "Assumptions made by the system",
        lines: params.assumptions.map((a) => `${a.description}${a.rationale ? ` (${a.rationale})` : ""}`),
      },
      {
        heading: "Warnings raised during validation",
        lines: params.warnings.map((w) => `[${w.severity}] ${w.message}`),
      },
    ],
  };
}

export function buildMissingItemsChecklistReport(params: {
  taxYear: number;
  missingDocuments: Array<{ classification: string; status: string; note: string | null }>;
}): ReportSpec {
  return {
    title: "Missing Documents Checklist",
    subtitle: `Tax year ${params.taxYear}`,
    sections: [
      {
        heading: "Items to check before sending your declaration",
        lines: params.missingDocuments.map((m) => `[${m.status}] ${m.classification}${m.note ? ` — ${m.note}` : ""}`),
      },
    ],
  };
}

export function buildAuditTrailReport(params: {
  taxYear: number;
  confirmations: Array<{ action: string; itemLabel: string; userEmail: string; timestamp: string; note: string | null }>;
  finalDeclarationAcceptedAt: string | null;
}): ReportSpec {
  return {
    title: "Audit Trail",
    subtitle: `Tax year ${params.taxYear}`,
    sections: [
      {
        heading: "User confirmations",
        lines: params.confirmations.map(
          (c) => `${c.timestamp} — ${c.userEmail} — ${c.action} — ${c.itemLabel}${c.note ? ` (${c.note})` : ""}`
        ),
      },
      {
        heading: "Final declaration confirmation",
        lines: [params.finalDeclarationAcceptedAt ? `Accepted at ${params.finalDeclarationAcceptedAt}` : "Not yet accepted"],
      },
    ],
  };
}
