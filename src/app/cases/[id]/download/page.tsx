import { requireUser, requireCaseOwnership } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { DownloadAction } from "@/components/DownloadAction";

export default async function DownloadPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const taxCase = await requireCaseOwnership(params.id, user);
  const hasPackage = await prisma.generatedPDF.findFirst({ where: { taxCaseId: taxCase.id, type: "FINAL_PACKAGE_ZIP" } });

  return (
    <div>
      <h2 className="mb-1 text-lg font-medium">Download your final package</h2>
      <p className="mb-4 text-sm text-slate-500">
        Print, sign, and send the completed declaration to the Geneva cantonal tax administration. Keep the review
        summary and audit trail for your own records.
      </p>
      {hasPackage ? (
        <DownloadAction caseId={taxCase.id} />
      ) : (
        <p className="card text-sm text-slate-600">No package has been generated yet — go to the &ldquo;Generate&rdquo; step first.</p>
      )}
    </div>
  );
}
