import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kalenderDatumUTC, lokaleDatumSleutel } from "@/lib/planning/tijd";
import { berekenContractUren, begrensRapportageUren } from "@/lib/contracturen/berekening";
import { berekenGewerkteUren } from "@/lib/verloning/pauze";
import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";

export const dynamic = "force-dynamic";

function datumUTC(datum: Date) {
  return new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
}
function plusDagen(datum: Date, aantal: number) {
  const resultaat = new Date(datum);
  resultaat.setUTCDate(resultaat.getUTCDate() + aantal);
  return resultaat;
}
function maandagVanWeek(datum: Date) {
  const resultaat = datumUTC(datum);
  resultaat.setUTCDate(resultaat.getUTCDate() - ((resultaat.getUTCDay() + 6) % 7));
  return resultaat;
}
function isoWeekStart(jaar: number, weeknummer: number) {
  const maandag = maandagVanWeek(new Date(Date.UTC(jaar, 0, 4)));
  maandag.setUTCDate(maandag.getUTCDate() + (weeknummer - 1) * 7);
  return maandag;
}
function formatUren(uren: number | null | undefined) {
  if (uren === null || uren === undefined || !Number.isFinite(uren)) return "—";
  return new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(uren) + " uur";
}
function formatDatum(datum: Date) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(datum);
}

export default async function ContracturenPage() {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) redirect("/login");
  const organisatieIds = gebruiker.organisaties.filter((relatie) =>
    relatie.actief && relatie.organisatie.actief &&
    ["eigenaar", "super admin"].includes(relatie.rol.naam.trim().toLowerCase()),
  ).map((relatie) => relatie.organisatieId);
  if (organisatieIds.length === 0) redirect("/dashboard");

  const vandaag = kalenderDatumUTC(lokaleDatumSleutel(new Date()));
  const weekStart = maandagVanWeek(vandaag);
  const volgendeWeek = plusDagen(weekStart, 7);
  const huidigJaar = vandaag.getUTCFullYear();
  const standaardStart = new Date(Date.UTC(huidigJaar, 0, 1));
  const standaardEinde = new Date(Date.UTC(huidigJaar, 11, 31));

  const medewerkers = await prisma.medewerker.findMany({
    where: {
      actief: true,
      contractType: "VAST",
      vestigingen: { some: { vestiging: { actief: true, organisatieId: { in: organisatieIds } } } },
    },
    orderBy: [{ achternaam: "asc" }, { voornaam: "asc" }],
    include: {
      vestigingen: {
        where: { vestiging: { actief: true, organisatieId: { in: organisatieIds } } },
        include: { vestiging: { select: { id: true, naam: true, organisatieId: true, seizoenStart: true, seizoenEinde: true } } },
      },
    },
  });

  if (medewerkers.length === 0) {
    return <PageLayout><PageToolbar title="Contracturen" /><div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Geen vaste medewerkers gevonden</h2><p className="mt-2 text-sm text-slate-600">Zodra een medewerker een actief vast contract heeft en aan een vestiging is gekoppeld, verschijnt de urenbalans hier.</p></div></PageLayout>;
  }

  const vestigingIds = Array.from(new Set(medewerkers.flatMap((medewerker) => medewerker.vestigingen.map((relatie) => relatie.vestiging.id))));
  const perioden = medewerkers.map((medewerker) => {
    const starts = medewerker.vestigingen.map((relatie) => relatie.vestiging.seizoenStart).filter((datum): datum is Date => datum !== null).map(datumUTC);
    const eindes = medewerker.vestigingen.map((relatie) => relatie.vestiging.seizoenEinde).filter((datum): datum is Date => datum !== null).map(datumUTC);
    return {
      medewerkerId: medewerker.id,
      start: starts.length ? new Date(Math.min(...starts.map((datum) => datum.getTime()))) : standaardStart,
      einde: eindes.length ? new Date(Math.max(...eindes.map((datum) => datum.getTime()))) : standaardEinde,
    };
  });
  const globaleStart = new Date(Math.min(...perioden.map((periode) => periode.start.getTime())));
  const globaleEinde = new Date(Math.max(...perioden.map((periode) => periode.einde.getTime())));
  const globaleEindeExclusief = plusDagen(globaleEinde, 1);
  const medewerkerIds = medewerkers.map((medewerker) => medewerker.id);

  const [registraties, bezettingen, weken] = await Promise.all([
    prisma.urenRegistratie.findMany({
      where: { medewerkerId: { in: medewerkerIds }, vestigingId: { in: vestigingIds }, status: "DEFINITIEF", datum: { gte: globaleStart, lt: globaleEindeExclusief } },
      select: { medewerkerId: true, vestigingId: true, datum: true, gewerkteUren: true },
    }),
    prisma.dienstBezetting.findMany({
      where: {
        medewerkerId: { in: medewerkerIds },
        status: { in: ["GEPLAND", "BEVESTIGD", "GEWERKT"] },
        dienst: { datum: { gte: weekStart, lt: globaleEindeExclusief }, week: { status: "GEPUBLICEERD", vestigingId: { in: vestigingIds } } },
      },
      select: { medewerkerId: true, dienst: { select: { datum: true, begintijd: true, eindtijd: true, week: { select: { status: true, jaar: true, weeknummer: true, vestigingId: true } } } } },
    }),
    prisma.week.findMany({
      where: { vestigingId: { in: vestigingIds }, jaar: { gte: globaleStart.getUTCFullYear() - 1, lte: globaleEinde.getUTCFullYear() + 1 } },
      select: { vestigingId: true, jaar: true, weeknummer: true },
    }),
  ]);

  const rijen = medewerkers.map((medewerker) => {
    const periode = perioden.find((item) => item.medewerkerId === medewerker.id)!;
    const medewerkerVestigingen = medewerker.vestigingen.map((relatie) => relatie.vestiging.id);
    const eigenRegistraties = registraties.filter((registratie) =>
      registratie.medewerkerId === medewerker.id && medewerkerVestigingen.includes(registratie.vestigingId) &&
      datumUTC(registratie.datum) >= periode.start && datumUTC(registratie.datum) <= periode.einde,
    );
    const gewerkteUren = eigenRegistraties.reduce((som, registratie) => som + Number(registratie.gewerkteUren), 0);
    const gewerkteUrenDezeWeek = eigenRegistraties.filter((registratie) =>
      datumUTC(registratie.datum) >= weekStart && datumUTC(registratie.datum) < volgendeWeek,
    ).reduce((som, registratie) => som + Number(registratie.gewerkteUren), 0);

    const eigenBezettingen = bezettingen.filter((bezetting) =>
      bezetting.medewerkerId === medewerker.id && medewerkerVestigingen.includes(bezetting.dienst.week.vestigingId) &&
      bezetting.dienst.week.status === "GEPUBLICEERD" && datumUTC(bezetting.dienst.datum) >= periode.start &&
      datumUTC(bezetting.dienst.datum) <= periode.einde,
    );
    const liveIngeplandDezeWeek = eigenBezettingen.filter((bezetting) =>
      datumUTC(bezetting.dienst.datum) >= weekStart && datumUTC(bezetting.dienst.datum) < volgendeWeek,
    ).reduce((som, bezetting) => som + berekenGewerkteUren(bezetting.dienst.begintijd, bezetting.dienst.eindtijd).gewerkteUren, 0);
    const liveIngeplandRestSeizoen = eigenBezettingen.filter((bezetting) =>
      datumUTC(bezetting.dienst.datum) >= vandaag,
    ).reduce((som, bezetting) => som + berekenDienstUren(bezetting.dienst.begintijd, bezetting.dienst.eindtijd), 0);

    const resterendeWeken = new Set(weken
      .filter((week) => medewerkerVestigingen.includes(week.vestigingId))
      .filter((week) => {
        const start = isoWeekStart(week.jaar, week.weeknummer);
        const einde = plusDagen(start, 6);
        return start <= periode.einde && einde >= periode.start && einde >= vandaag;
      })
      .map((week) => `${week.jaar}-${week.weeknummer}`)).size;

    const contractUren = medewerker.contractUren == null ? null : Number(medewerker.contractUren);
    const jaarUrenNorm = medewerker.jaarUrenNorm == null ? null : Number(medewerker.jaarUrenNorm);
    const verlofUrenStart = medewerker.verlofUrenStart == null ? null : Number(medewerker.verlofUrenStart);
    const verlofUrenOpgenomen = medewerker.verlofUrenOpgenomen == null ? 0 : Number(medewerker.verlofUrenOpgenomen);
    const balans = berekenContractUren({ contractUren, jaarUrenNorm, verlofUrenStart, gewerkteUren, liveIngepland: liveIngeplandRestSeizoen, resterendeOpeningsweken: resterendeWeken });

    return {
      id: medewerker.id,
      naam: [medewerker.voornaam, medewerker.tussenvoegsel, medewerker.achternaam].filter(Boolean).join(" "),
      contractUren,
      jaarUrenNorm: balans.jaarNorm,
      normOntbreekt: contractUren === null && jaarUrenNorm === null,
      verlofUrenStart,
      verlofUrenOpgenomen,
      resterendVerlof: verlofUrenStart === null ? null : Math.max(0, verlofUrenStart - verlofUrenOpgenomen),
      gewerkteUren: balans.gewerkteUren,
      gewerkteUrenDezeWeek: Math.round(gewerkteUrenDezeWeek * 100) / 100,
      rapportageUrenDezeWeek: begrensRapportageUren(liveIngeplandDezeWeek, contractUren),
      liveIngeplandDezeWeek: Math.round(liveIngeplandDezeWeek * 100) / 100,
      liveIngeplandRestSeizoen: balans.liveIngepland,
      resterendTeWerken: balans.resterendTeWerken,
      nogNietIngepland: balans.nogNietIngepland,
      resterendeOpeningsweken: balans.resterendeOpeningsweken,
      gemiddeldNogTeWerkenPerWeek: balans.gemiddeldNogTeWerkenPerWeek,
      gemiddeldNogInTePlannenPerWeek: balans.gemiddeldNogInTePlannenPerWeek,
      prognoseOverschot: balans.prognoseOverschot,
      seizoenStart: periode.start,
      seizoenEinde: periode.einde,
    };
  });

  const totalen = rijen.reduce((som, rij) => ({
    medewerkers: som.medewerkers + 1,
    tekort: som.tekort + Math.max(0, rij.nogNietIngepland),
    overschot: som.overschot + rij.prognoseOverschot,
  }), { medewerkers: 0, tekort: 0, overschot: 0 });

  return (
    <PageLayout>
      <PageToolbar title="Contracturen" />
      <div className="space-y-6">
        <p className="text-sm text-slate-600">Realtime urenbalans voor vaste contracten. Alleen LIVE-gepubliceerde diensten tellen mee in de prognose. De urenregistratie telt alleen goedgekeurde uren met status DEFINITIEF mee.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Vaste medewerkers</p><p className="mt-2 text-2xl font-semibold text-slate-900">{totalen.medewerkers}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Nog niet ingepland</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatUren(totalen.tekort)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Prognose overschot</p><p className="mt-2 text-2xl font-semibold text-amber-700">{formatUren(totalen.overschot)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Peildatum</p><p className="mt-2 text-lg font-semibold text-slate-900">{formatDatum(vandaag)}</p></div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Urenbalans per medewerker</h2><p className="mt-1 text-sm text-slate-500">Prognose wordt direct bijgewerkt na publicatie van een week en na goedkeuring van uren.</p></div>
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
                <th className="px-4 py-3">Medewerker</th><th className="px-4 py-3">Contract</th><th className="px-4 py-3">Jaar-/seizoensnorm</th><th className="px-4 py-3">Verlof resterend</th><th className="px-4 py-3">Goedgekeurd gewerkt</th><th className="px-4 py-3">LIVE ingepland deze week</th><th className="px-4 py-3">LIVE ingepland rest seizoen</th><th className="px-4 py-3">Nog te werken</th><th className="px-4 py-3">Nog niet ingepland</th><th className="px-4 py-3">Openingsweken</th><th className="px-4 py-3">Gem. nog nodig/week</th><th className="px-4 py-3">Gem. nog in te plannen/week</th><th className="px-4 py-3">Prognose overschot</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rijen.map((rij) => <tr key={rij.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-slate-900"><a className="hover:underline" href={`/medewerkers/${encodeURIComponent(rij.id)}?tab=contract`}>{rij.naam}</a>{rij.normOntbreekt && <p className="mt-1 text-xs font-normal text-amber-700">Contracturen/norm ontbreekt</p>}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{formatUren(rij.contractUren)}<p className="mt-1 text-xs text-slate-500">per week</p></td>
                  <td className="px-4 py-4 whitespace-nowrap">{formatUren(rij.jaarUrenNorm)}<p className="mt-1 text-xs text-slate-500">{formatDatum(rij.seizoenStart)} – {formatDatum(rij.seizoenEinde)}</p></td>
                  <td className="px-4 py-4 whitespace-nowrap">{formatUren(rij.resterendVerlof)}<p className="mt-1 text-xs text-slate-500">start: {formatUren(rij.verlofUrenStart)} · opgenomen: {formatUren(rij.verlofUrenOpgenomen)}</p></td>
                  <td className="px-4 py-4 whitespace-nowrap">{formatUren(rij.gewerkteUren)}<p className="mt-1 text-xs text-slate-500">deze week werkelijk: {formatUren(rij.gewerkteUrenDezeWeek)}<br/>rapportagebasis: {formatUren(rij.rapportageUrenDezeWeek)}</p></td>
                  <td className="px-4 py-4 whitespace-nowrap">{formatUren(rij.liveIngeplandDezeWeek)}</td><td className="px-4 py-4 whitespace-nowrap">{formatUren(rij.liveIngeplandRestSeizoen)}</td>
                  <td className={`px-4 py-4 whitespace-nowrap font-semibold ${rij.resterendTeWerken < 0 ? "text-amber-700" : "text-slate-900"}`}>{formatUren(Math.max(0, rij.resterendTeWerken))}{rij.resterendTeWerken < 0 && <p className="mt-1 text-xs font-normal text-amber-700">Overschot gerealiseerd</p>}</td>
                  <td className={`px-4 py-4 whitespace-nowrap font-semibold ${rij.nogNietIngepland < 0 ? "text-amber-700" : "text-slate-900"}`}>{formatUren(Math.max(0, rij.nogNietIngepland))}{rij.nogNietIngepland < 0 && <p className="mt-1 text-xs font-normal text-amber-700">Overprognose: {formatUren(Math.abs(rij.nogNietIngepland))}</p>}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{rij.resterendeOpeningsweken}</td><td className="px-4 py-4 whitespace-nowrap">{formatUren(rij.gemiddeldNogTeWerkenPerWeek)}</td><td className="px-4 py-4 whitespace-nowrap">{formatUren(rij.gemiddeldNogInTePlannenPerWeek)}</td><td className="px-4 py-4 whitespace-nowrap">{formatUren(rij.prognoseOverschot)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Rekenregels:</strong> jaar-/seizoensnorm = ingevulde norm of contracturen × 52; te werken uren = jaar-/seizoensnorm − verloftegoed bij start seizoen; alle definitief goedgekeurde uren tellen mee voor de jaarbalans en verloning. De wekelijkse rapportagebasis wordt begrensd op contracturen. Alleen diensten in weken met status GEPUBLICEERD tellen mee als LIVE ingepland. De actuele verlofstand wordt getoond op basis van het ingevulde starttegoed en de geregistreerde opgenomen verlofuren.</div>
      </div>
    </PageLayout>
  );
}
