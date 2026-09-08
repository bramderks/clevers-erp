import { redirect } from "next/navigation";

import VakantiePlanningPanel from "@/components/medewerkers/VakantiePlanningPanel";
import { getCurrentUser } from "@/lib/auth";

export default async function AppVakantiePage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/vakantie");
  }

  const medewerkerId = gebruiker.medewerker?.id;

  if (!medewerkerId) {
    redirect("/app");
  }

  const isEigenaar = gebruiker.organisaties.some(
    (relatie) =>
      relatie.actief &&
      relatie.organisatie.actief &&
      relatie.rol.naam.trim().toLowerCase() === "eigenaar",
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-24">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Clevers
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Mijn vakantieplanning
        </h1>

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <VakantiePlanningPanel
            medewerkerId={medewerkerId}
            isEigenaar={isEigenaar}
            magIndienen
          />
        </div>
      </div>
    </main>
  );
}
