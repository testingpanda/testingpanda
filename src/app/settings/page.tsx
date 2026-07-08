import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { DeleteCaseButton } from "@/components/DeleteCaseButton";

export default async function SettingsPage() {
  const user = await requireUser();
  const cases = await prisma.taxCase.findMany({
    where: { userId: user.id, status: { not: "deleted" } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">Account: {user.email}</p>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Data deletion</h2>
        <p className="mb-4 text-sm text-slate-500">
          Deleting a tax case permanently removes every uploaded document, extracted value, and generated PDF for that
          case from storage and the database. This cannot be undone.
        </p>
        {cases.length === 0 ? (
          <p className="card text-sm text-slate-600">No tax cases to delete.</p>
        ) : (
          <div className="space-y-3">
            {cases.map((c) => (
              <div key={c.id} className="card flex items-center justify-between">
                <span>
                  Tax year {c.taxYear} — Canton {c.canton} — status: {c.status}
                </span>
                <DeleteCaseButton caseId={c.id} taxYear={c.taxYear} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
