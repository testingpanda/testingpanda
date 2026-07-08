import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";

export default async function AdminPage() {
  await requireAdmin();
  const cases = await prisma.taxCase.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } }, _count: { select: { documents: true, validationIssues: true } } },
  });

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Admin — all tax cases</h1>
      <p className="mb-4 text-sm text-slate-500">
        Debugging view only. Raw extracted values are never shown here — only statuses and counts.
      </p>
      <div className="space-y-3">
        {cases.map((c) => (
          <Link key={c.id} href={`/admin/cases/${c.id}`} className="card flex items-center justify-between hover:border-brand-400">
            <div>
              <p className="font-medium">
                {c.user.email} — Tax year {c.taxYear} ({c.canton})
              </p>
              <p className="text-sm text-slate-500">
                {c._count.documents} document(s) · {c._count.validationIssues} validation issue(s)
              </p>
            </div>
            <StatusBadge status={c.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
