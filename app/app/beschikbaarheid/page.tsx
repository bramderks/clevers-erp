import { redirect } from "next/navigation";

import BeschikbaarheidPanel from "@/components/medewerkers/beschikbaarheid/components/BeschikbaarheidPanel";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function MedewerkerAppBeschikbaarheidPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/beschikbaarheid");
  }

  const medewerkerId = gebruiker.medewerker?.id;

  if (!medewerkerId) {
    redirect("/app");
  }

  const medewerker = await prisma.medewerker.findUnique({
    where: { id: medewerkerId },
    select: {
      vestigingen: {
        where: { vestiging: { actief: true } },
        select: {
          vestiging: {
            select: { id: true, naam: true },
          },
        },
      },
    },
  });

  const isBeheerder = gebruiker.organisaties.some(
    (relatie) =>
      relatie.actief &&
      relatie.organisatie.actief &&
      ["eigenaar", "teamleider"].includes(
        relatie.rol.naam.trim().toLowerCase(),
      ),
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-24">
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Clevers
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Mijn beschikbaarheid
        </h1>

        <div className="mt-6">
          <BeschikbaarheidPanel
            medewerkerId={medewerkerId}
            vestigingen={
              medewerker?.vestigingen.map((relatie) => relatie.vestiging) ?? []
            }
            isBeheerder={isBeheerder}
            isEigenMedewerker
          />
        </div>
      </div>
    </main>
  );
}
