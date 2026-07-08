import Link from "next/link";
import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { checkGenerationGate } from "@/lib/validation/engine";
import { FinalDeclarationForm } from "@/components/FinalDeclarationForm";
import { AI_ASSISTANCE_DISCLAIMER } from "@/lib/pdf/package";

export default async function ChecklistPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);
  const gate = await checkGenerationGate(taxCase.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-medium">Final validation checklist</h2>
        <p className="text-sm text-slate-500">
          Everything below must be resolved before you can generate your final package. Nothing is finalized without your
          explicit confirmation.
        </p>
      </div>

      {gate.canGenerate ? (
        <p className="card border-emerald-300 bg-emerald-50 text-sm text-emerald-800">
          All mandatory items have been reviewed. You can proceed to the final declaration below.
        </p>
      ) : (
        <div className="card border-amber-300 bg-amber-50">
          <p className="mb-2 text-sm font-medium text-amber-900">The following items still need your attention:</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-amber-900">
            {gate.blockingReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href={`/cases/${taxCase.id}/extraction`} className="text-brand-700 underline">
              Go to extraction review
            </Link>
            <Link href={`/cases/${taxCase.id}/review`} className="text-brand-700 underline">
              Go to section review
            </Link>
          </div>
        </div>
      )}

      <div className="card bg-slate-50 text-sm text-slate-700">{AI_ASSISTANCE_DISCLAIMER}</div>

      {gate.canGenerate && <FinalDeclarationForm caseId={taxCase.id} />}
    </div>
  );
}
