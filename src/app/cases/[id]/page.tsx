import { redirect } from "next/navigation";

export default function CaseOverviewPage({ params }: { params: { id: string } }) {
  redirect(`/cases/${params.id}/upload`);
}
