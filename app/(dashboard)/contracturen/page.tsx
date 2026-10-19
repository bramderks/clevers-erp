import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kalenderDatumUTC, lokaleDatumSleutel } from "@/lib/planning/tijd";
import { berekenGewerkteUren } from "@/lib/verloning/pauze";
import { berekenUniekeUrenPerInterval } from "@/lib/verloning/overlappendeUren";
import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import StartSaldoForm from "@/components/contracturen/StartSaldoForm";

export const dynamic = "force-dynamic";

const JAREN = [2026, 2027, 2028] as const;

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
function formatUren(uren: number | null | undefined) {
  if (uren === null || uren === undefined || !Number.isFinite(uren)) return "—";
  return new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(uren);
}
function wekenInJaar(jaar: number) {
  const laatsteDag = new Date(Date.UTC(jaar, 11, 31));
  const donderdag = new Date(laatsteDag);
  donderdag.setUTCDate(donderdag.getUTCDate() + 4 - (donderdag.getUTCDay() || 7));
  const eersteDonderdag = new Date(Date.UTC(jaar, 0, 4));
  eersteDonderdag.setUTCDate(eersteDonderdag.getUTCDate() + 4 - (eersteDonderdag.getUTCDay() || 7));
  return 1 + Math.round((donderdag.getTime() - eersteDonderdag.getTime()) / 604800000);
}
function resterendeWekenInJaar(jaar: number, vandaag: Date) {
  if (jaar < vandaag.getUTCFullYear()) return 0;
  if (jaar > vandaag.getUTCFullYear()) return wekenInJaar(jaar);
  const jaarEinde = new Date(Date.UTC(jaar, 11, 31));
  return Math.max(1, Math.ceil((jaarEinde.getTime() - maandagVanWeek(vandaag).getTime() + 1) / 604800000));
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
  const jaarStart = new Date(Date.UTC(JAREN[0], 0, 1));
  const jaarEindeExclusief = new Date(Date.UTC(JAREN[JAREN.length - 1] + 1, 0, 1));

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
        include: { vestiging: { select: { id: true } } },
      },
    },
  });

  if (medewerkers.length === 0) {
    return <PageLayout><PageToolbar title="Contracturen" /><div className="rounded-2xl border border-slate-200 bg-white p-8"><h2 className="text-lg font-semibold text-slate-900">Geen vaste medewerkers gevonden</h2><p className="mt-2 text-sm text-slate-600">Actieve medewerkers met een vast contract verschijnen hier.</p></div></PageLayout>;
  }

  const medewerkerIds = medewerkers.map((medewerker) => medewerker.id);
  const vestigingIds = Array.from(new Set(medewerkers.flatMap((medewerker) => medewerker.vestigingen.map((relatie) => relatie.vestiging.id))));
  const [registraties, bezettingen, weken] = await Promise.all([
    prisma.urenRegistratie.findMany({
      where: { medewerkerId: { in: medewerkerIds }, vestigingId: { in: vestigingIds }, status: "DEFINITIEF", datum: { gte: jaarStart, lt: jaarEindeExclusief } },
      select: { id: true, medewerkerId: true, vestigingId: true, datum: true, gewerkteUren: true, werkelijkeBegintijd: true, werkelijkeEindtijd: true },
    }),
    prisma.dienstBezetting.findMany({
      where: {
        medewerkerId: { in: medewerkerIds },
        status: { in: ["GEPLAND", "BEVESTIGD", "GEWERKT"] },
        dienst: { datum: { gte: jaarStart, lt: jaarEindeExclusief }, week: { status: "GEPUBLICEERD", vestigingId: { in: vestigingIds } } },
      },
      select: { medewerkerId: true, dienst: { select: { datum: true, begintijd: true, eindtijd: true, week: { select: { vestigingId: true } } } } },
    }),
    prisma.week.findMany({
      where: { vestigingId: { in: vestigingIds }, jaar: { gte: JAREN[0], lte: JAREN[JAREN.length - 1] } },
      select: { vestigingId: true, jaar: true, weeknummer: true },
    }),
  ]);

  const uniekeUrenPerRegistratie = berekenUniekeUrenPerInterval(
    registraties.filter((registratie) => registratie.werkelijkeBegintijd && registratie.werkelijkeEindtijd).map((registratie) => ({
      id: registratie.id,
      medewerkerId: registratie.medewerkerId,
      vestigingId: registratie.vestigingId,
      datum: registratie.datum,
      begintijd: registratie.werkelijkeBegintijd!,
      eindtijd: registratie.werkelijkeEindtijd!,
    })),
    berekenGewerkteUren,
  );

  const rijen = medewerkers.flatMap((medewerker) => {
    const medewerkerVestigingen = medewerker.vestigingen.map((relatie) => relatie.vestiging.id);
    const eigenRegistraties = registraties.filter((registratie) =>
      registratie.medewerkerId === medewerker.id && medewerkerVestigingen.includes(registratie.vestigingId),
    );
    const urenRegistratie = (registratie: (typeof eigenRegistraties)[number]) =>
      registratie.werkelijkeBegintijd && registratie.werkelijkeEindtijd
        ? (uniekeUrenPerRegistratie.get(registratie.id) ?? 0)
        : Number(registratie.gewerkteUren);
    const startSaldo = medewerker.contractUrenStartSaldo == null ? null : Number(medewerker.contractUrenStartSaldo);
    const peildatum = medewerker.contractUrenStartPeildatum ? datumUTC(medewerker.contractUrenStartPeildatum) : null;
    const contractUrenPerWeek = medewerker.contractUren == null ? null : Number(medewerker.contractUren);
    const jaarNormIngesteld = medewerker.jaarUrenNorm == null ? null : Number(medewerker.jaarUrenNorm);
    const verlofStart = medewerker.verlofUrenStart == null ? 0 : Number(medewerker.verlofUrenStart);
    const verlofOpgenomen = medewerker.verlofUrenOpgenomen == null ? 0 : Number(medewerker.verlofUrenOpgenomen);
    const resterendVerlof = Math.max(0, verlofStart - verlofOpgenomen);

    return JAREN.map((jaar) => {
      const start = new Date(Date.UTC(jaar, 0, 1));
      const einde = new Date(Date.UTC(jaar + 1, 0, 1));
      const gewerkt = eigenRegistraties.filter((registratie) => {
        const datum = datumUTC(registratie.datum);
        return datum >= start && datum < einde;
      }).reduce((som, registratie) => som + urenRegistratie(registratie), 0);
      const norm = jaarNormIngesteld ?? (contractUrenPerWeek === null ? null : contractUrenPerWeek * 52);
      const isStartSaldoJaar = startSaldo !== null && peildatum !== null && peildatum.getUTCFullYear() === jaar;
      const gewerktSindsPeildatum = isStartSaldoJaar
        ? eigenRegistraties.filter((registratie) => {
            const datum = datumUTC(registratie.datum);
            return datum >= peildatum! && datum < einde;
          }).reduce((som, registratie) => som + urenRegistratie(registratie), 0)
        : 0;
      const resterend = norm === null ? null : isStartSaldoJaar
        ? startSaldo! - gewerktSindsPeildatum
        : norm - (jaar === vandaag.getUTCFullYear() ? verlofStart : 0) - gewerkt;
      const weken = resterendeWekenInJaar(jaar, vandaag);
      const urenPerWeek = resterend === null ? null : weken > 0 ? Math.max(0, resterend) / weken : 0;
      const ingepland = bezettingen.filter((bezetting) => {
        const datum = datumUTC(bezetting.dienst.datum);
        return bezetting.medewerkerId === medewerker.id &&
          medewerkerVestigingen.includes(bezetting.dienst.week.vestigingId) &&
          datum >= (datum > vandaag ? datum : vandaag) && datum >= start && datum < einde;
      }).reduce((som, bezetting) => som + berekenGewerkteUren(bezetting.dienst.begintijd, bezetting.dienst.eindtijd).gewerkteUren, 0);
      return {
        id: `${medewerker.id}-${jaar}`,
        medewerkerId: medewerker.id,
        naam: [medewerker.voornaam, medewerker.tussenvoegsel, medewerker.achternaam].filter(Boolean).join(" "),
        jaar,
        norm,
        gewerkt: Math.round(gewerkt * 100) / 100,
        resterend: resterend === null ? null : Math.round(resterend * 100) / 100,
        verlof: jaar === vandaag.getUTCFullYear() ? resterendVerlof : 0,
        weken,
        perWeek: urenPerWeek === null ? null : Math.round(urenPerWeek * 100) / 100,
        ingepland: Math.round(ingepland * 100) / 100,
        startSaldo,
        peildatum,
        startSaldoNotitie: medewerker.contractUrenStartNotitie,
        normOntbreekt: norm === null,
      };
    });
  });

  return (
    <PageLayout>
      <PageToolbar title="Contracturen" />
      <div className="space-y-5">
        <p className="text-sm text-slate-600">Jaaroverzicht voor vaste contracten. Gewerkte uren zijn definitief goedgekeurde registraties; geplande uren tellen alleen mee uit gepubliceerde weken.</p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Jaarbalans per medewerker</h2>
            <p className="mt-1 text-sm text-slate-500">Per jaar zie je de norm, gewerkte uren en wat er gemiddeld nog per week nodig is.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
                <th className="px-4 py-3">Medewerker</th>
                <th className="px-4 py-3">Jaar</th>
                <th className="px-4 py-3 text-right">Totaal jaar (uur)</th>
                <th className="px-4 py-3 text-right">Gewerkt (uur)</th>
                <th className="px-4 py-3 text-right">Resterend (uur)</th>
                <th className="px-4 py-3 text-right">Verlofuren</th>
                <th className="px-4 py-3 text-right">Resterende weken</th>
                <th className="px-4 py-3 text-right">Nog te werken per week</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rijen.map((rij) => <tr key={rij.id} className="align-middle hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <a className="hover:underline" href={`/medewerkers/${encodeURIComponent(rij.medewerkerId)}?tab=contract`}>{rij.naam}</a>
                    {rij.jaar === JAREN[0] && <details className="mt-2 text-xs font-normal text-slate-600">
                      <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-800">Startsaldo aanpassen</summary>
                      <StartSaldoForm medewerkerId={rij.medewerkerId} medewerkerNaam={rij.naam} startSaldo={rij.startSaldo} peildatum={rij.peildatum ? rij.peildatum.toISOString().slice(0, 10) : null} notitie={rij.startSaldoNotitie} />
                    </details>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{rij.jaar}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatUren(rij.norm)}{rij.normOntbreekt && <p className="text-xs text-amber-700">Contractnorm ontbreekt</p>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatUren(rij.gewerkt)}</td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${rij.resterend !== null && rij.resterend < 0 ? "text-amber-700" : "text-slate-900"}`}>{formatUren(rij.resterend)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatUren(rij.verlof)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rij.weken}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatUren(rij.perWeek)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-slate-500">De jaaruren zijn contracturen per week × 52, tenzij een eigen jaarurennorm is ingevuld. Het startsaldo geldt alleen voor het jaar waarin de peildatum valt. Verlofuren tonen het resterende verloftegoed voor het huidige jaar. Toekomstige jaren beginnen met de volledige jaarurennorm.</p>
      </div>
    </PageLayout>
  );
}
