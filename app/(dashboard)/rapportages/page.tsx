import { redirect } from "next/navigation";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function uren(waarde: unknown) {
  return Number(waarde ?? 0);
}

export default async function RapportagesPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) redirect("/login");

  const eigenaar = await isEigenaar();

  if (!eigenaar) redirect("/dashboard");

  const vandaag = new Date();
  const start = new Date(vandaag.getFullYear(), vandaag.getMonth(), 1);
  const einde = new Date(vandaag.getFullYear(), vandaag.getMonth() + 1, 1);

  const [medewerkers, openDiensten, gewerkteUren, perVestiging] =
    await Promise.all([
      prisma.medewerker.count({ where: { actief: true } }),
      prisma.dienstBezetting.count({ where: { status: "OPEN" } }),
      prisma.urenRegistratie.aggregate({
        where: { datum: { gte: start, lt: einde }, status: "DEFINITIEF" },
        _sum: { gewerkteUren: true },
      }),
      prisma.vestiging.findMany({
        where: { actief: true },
        select: {
          id: true,
          naam: true,
          urenregistraties: {
            where: { datum: { gte: start, lt: einde }, status: "DEFINITIEF" },
            select: { gewerkteUren: true },
          },
          weken: {
            select: {
              diensten: {
                select: {
                  bezetting: {
                    where: { status: "OPEN" },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { naam: "asc" },
      }),
    ]);

  const totaalUren = uren(gewerkteUren._sum.gewerkteUren);

  return (
    <main className="space-y-8">
      <div>
        <p className="text-sm text-slate-500">Eigenaar</p>
        <h1 className="text-2xl font-bold text-slate-900">Rapportages</h1>
        <p className="mt-1 text-sm text-slate-600">
          Actueel overzicht van personeel, uren en planning.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Actieve medewerkers</p>
          <p className="mt-2 text-3xl font-bold">{medewerkers}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Open dienstplekken</p>
          <p className="mt-2 text-3xl font-bold">{openDiensten}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Definitieve uren deze maand</p>
          <p className="mt-2 text-3xl font-bold">{totaalUren.toFixed(2)}</p>
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="font-bold text-slate-900">Per vestiging</h2>
        </div>
        <div className="divide-y">
          {perVestiging.map((vestiging) => {
            const vestigingUren = vestiging.urenregistraties.reduce(
              (totaal, registratie) => totaal + uren(registratie.gewerkteUren),
              0,
            );
            const vestigingOpen = vestiging.weken.reduce(
              (totaal, week) =>
                totaal +
                week.diensten.reduce(
                  (dienstTotaal, dienst) =>
                    dienstTotaal + dienst.bezetting.length,
                  0,
                ),
              0,
            );

            return (
              <div key={vestiging.id} className="grid gap-3 p-5 sm:grid-cols-3">
                <p className="font-semibold text-slate-900">{vestiging.naam}</p>
                <p className="text-sm text-slate-600">
                  {vestigingUren.toFixed(2)} definitieve uren
                </p>
                <p className="text-sm text-slate-600">
                  {vestigingOpen} open dienstplekken
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
