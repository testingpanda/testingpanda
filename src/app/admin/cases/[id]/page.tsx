import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit/log";
import { StatusBadge } from "@/components/StatusBadge";

export default async function AdminCaseDetailPage({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const taxCase = await prisma.taxCase.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      user: { select: { email: true } },
      documents: true,
      validationIssues: true,
      _count: { select: { extractedFields: true, fieldMappings: true } },
    },
  });

  await recordAuditLog({ userId: admin.id, taxCaseId: taxCase.id, action: "ADMIN_CASE_VIEWED", entityType: "TaxCase", entityId: taxCase.id });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          {taxCase.user.email} — Tax year {taxCase.taxYear}
        </h1>
        <StatusBadge status={taxCase.status} />
      </div>

      <div className="card">
        <h2 className="mb-2 font-medium">Documents ({taxCase.documents.length})</h2>
        <ul className="space-y-1 text-sm">
          {taxCase.documents.map((d) => (
            <li key={d.id}>
              {d.originalFilename} — {d.classification ?? "unclassified"} — {d.status}
              {d.classificationConfidence !== null && ` (${Math.round((d.classificationConfidence ?? 0) * 100)}%)`}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-2 font-medium">
          Extracted fields: {taxCase._count.extractedFields} · Declaration mappings: {taxCase._count.fieldMappings}
        </h2>
        <p className="text-sm text-slate-500">Raw values are encrypted and intentionally not shown in this admin view.</p>
      </div>

      <div className="card">
        <h2 className="mb-2 font-medium">Validation issues ({taxCase.validationIssues.length})</h2>
        <ul className="space-y-1 text-sm">
          {taxCase.validationIssues.map((v) => (
            <li key={v.id}>
              [{v.severity}] {v.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
