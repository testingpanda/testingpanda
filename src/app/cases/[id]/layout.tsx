import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, requireCaseOwnership, AuthError } from "@/lib/auth/guard";
import { StatusBadge } from "@/components/StatusBadge";

const STEPS = [
  { href: "upload", label: "1. Upload" },
  { href: "documents", label: "2. Classification" },
  { href: "extraction", label: "3. Extraction review" },
  { href: "review", label: "4. Section review" },
  { href: "missing", label: "5. Missing info" },
  { href: "checklist", label: "6. Final checklist" },
  { href: "download", label: "7. Download" },
];

export default async function CaseLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const user = await requireUser();
  let taxCase;
  try {
    taxCase = await requireCaseOwnership(params.id, user);
  } catch (err) {
    if (err instanceof AuthError) notFound();
    throw err;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/cases" className="text-sm text-slate-500 hover:underline">
            ← All cases
          </Link>
          <h1 className="text-xl font-semibold">
            Tax year {taxCase.taxYear} — Canton {taxCase.canton}
          </h1>
        </div>
        <StatusBadge status={taxCase.status} />
      </div>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm">
        {STEPS.map((step) => (
          <Link key={step.href} href={`/cases/${params.id}/${step.href}`} className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">
            {step.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
