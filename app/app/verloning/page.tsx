import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatUren(uren: number) {
  return uren.toFixed(2).replace(".", ",");
}

export default async function AppVerloningPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/verloning");
  }

  const medewerkerId = gebruiker.medewerker?.id;
  if (!medewerkerId) redirect("/app");

  const periode = await prisma.verloningsPeriode.findFirst({
    where: { regels: { some: { medewerkerId } } },
    orderBy: [{ jaar: "desc" }, { maand: "desc" }],
    include: {
      regels: {
        where: { medewerkerId },
        include: { vestiging: { select: { naam: true } } },
        orderBy: { vestiging: { naam: "asc" } },
      },
      controles: {
        where: { medewerkerId },
        select: { status: true },
      },
    },
  });

  const totaalDagen = periode?.regels.reduce((totaal, regel) => totaal + regel.gewerkteDagen, 0) ?? 0;
  const totaalUren = periode?.regels.reduce((totaal, regel) => totaal + Number(regel.gewerkteUren), 0) ?? 0;

  const periodeNaam = periode
    ? new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(
        new Date(periode.jaar, periode.maand - 1, 1),
      )
    : null;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-24">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Clevers</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Mijn verloning</h1>

        {!periode ? (
          <section className="mt-5 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">Nog geen verloning beschikbaar</p>
            <p className="mt-1 text-sm text-slate-500">Zodra een periode is gegenereerd, verschijnt deze hier.</p>
          </section>
        ) : (
          <div className="mt-5 space-y-4">
            <section className="rounded-3xl bg-slate-900 p-5 text-white">
              <p className="text-sm capitalize text-slate-300">{periodeNaam}</p>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div><p className="text-3xl font-bold">{totaalDagen}</p><p className="mt-1 text-sm text-slate-300">gewerkte dagen</p></div>
                <div><p className="text-3xl font-bold">{formatUren(totaalUren)}</p><p className="mt-1 text-sm text-slate-300">gewerkte uren</p></div>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-bold text-slate-900">Per vestiging</h2>
              </div>
              {periode.regels.map((regel) => (
                <div key={regel.id} className="flex items-center justify-between border-b border-slate-100 px-5 py-4 last:border-b-0">
                  <div>
                    <p className="font-semibold text-slate-900">{regel.vestiging.naam}</p>
                    <p className="mt-1 text-sm text-slate-500">{regel.gewerkteDagen} dagen</p>
                  </div>
                  <p className="font-semibold text-slate-900">{formatUren(Number(regel.gewerkteUren))} uur</p>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
