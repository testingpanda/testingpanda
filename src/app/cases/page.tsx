import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";

export default async function CasesListPage() {
  const user = await requireUser();
  const cases = await prisma.taxCase.findMany({
    where: { userId: user.id, status: { not: "deleted" } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { documents: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My tax cases</h1>
        <Link href="/cases/new" className="btn-primary">
          New tax case
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="card text-sm text-slate-600">
          You have no tax cases yet. Start one to upload your documents and prepare your Geneva declaration.
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="card flex items-center justify-between hover:border-brand-400">
              <div>
                <p className="font-medium">
                  Tax year {c.taxYear} — Canton {c.canton}
                </p>
                <p className="text-sm text-slate-500">{c._count.documents} document(s) uploaded</p>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
