import { redirect } from "next/navigation";
import { CalendarDays, Settings } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import PlanningWeergaveSettings from "@/components/app/PlanningWeergaveSettings";

export const dynamic = "force-dynamic";

export default async function AppInstellingenPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/instellingen");
  }

  if (!gebruiker.medewerker?.id) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-24">
      <div className="mx-auto max-w-lg space-y-5">
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Settings size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Mijn account
            </p>
            <h1 className="text-2xl font-bold text-slate-900">Instellingen</h1>
          </div>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <CalendarDays size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900">
                Startweergave van het planbord
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Kies wat je ziet wanneer je Planning opent. Deze persoonlijke
                keuze wordt automatisch gedeeld met de webversie van Clevers ERP.
              </p>
              <div className="mt-5">
                <PlanningWeergaveSettings
                  initialValue={gebruiker.planningWeergave}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
