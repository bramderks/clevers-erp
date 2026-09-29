import { redirect } from "next/navigation";
import { Bell, Settings } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import PushNotificationSettings from "@/components/app/PushNotificationSettings";

export const dynamic = "force-dynamic";

export default async function InstellingenPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/instellingen");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Instellingen
            </h1>
            <p className="text-sm text-slate-500">
              Persoonlijke instellingen voor je Clevers-account.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Bell size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">
              Pushmeldingen
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Ontvang meldingen van Clevers op dit apparaat, bijvoorbeeld over
              taken, diensten en beschikbaarheidsdeadlines.
            </p>

            <div className="mt-5">
              <PushNotificationSettings />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
