import { getAdminSettingsAction } from "@/app/actions/settings";
import GeneralSettingsClient from "./GeneralSettingsClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const res = await getAdminSettingsAction();

  if (!res.ok || !res.settings) {
    redirect("/admin");
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-950 p-6 sm:p-10">
      <GeneralSettingsClient initialSettings={res.settings} />
    </div>
  );
}
