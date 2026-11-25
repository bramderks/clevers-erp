import { redirect } from "next/navigation";
import { BarChart3, CalendarDays, Clock3, Euro, Users, Wallet } from "lucide-react";
import { getCurrentUser, heeftRol, hasPermissionForVestiging, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions } from "@/lib/permissions";

type SnapshotMedewerker = { medewerkerId: string; naam: string; uren: number };
type SnapshotDienst = { datum: string; medewerkers: { medewerkerId: string; naam: string }[] };
type WeekSnapshot = { versie?: number; medewerkers?: SnapshotMedewerker[]; diensten?: SnapshotDienst[]; ontbrekendUurloon?: number };

const euro = (value: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const uren = (value: number) => new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value) + " uur";
const pct = (value: number | null) => value == null ? "—" : value.toFixed(1).replace(".", ",") + "%";

function Kpi({ label, value, detail, icon: Icon, positive }: {
  label: string; value: string; detail: string; icon: React.ComponentType<{ size?: number }>; positive?: boolean;
}) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-500">{label}</p><span className="rounded-xl bg-slate-100 p-2 text-slate-600"><Icon size={18} /></span></div>
    <p className={"mt-3 text-2xl font-bold tracking-tight " + (positive ? "text-emerald-700" : "text-slate-900")}>{value}</p>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </div>;
}

export default async function ManagementbarometerPage({
  searchParams,
}: {
  searchParams: Promise<{ jaar?: string; vestiging?: string }>;
}) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) redirect("/login");
  const eigenaar = await isEigenaar();
  const teamleider = await heeftRol("teamleider");
  if (!eigenaar && !teamleider) redirect("/dashboard");

  const params = await searchParams;
  const huidigJaar = new Date().getFullYear();
  const gevraagdJaar = Number(params.jaar);
  const jaar = Number.isInteger(gevraagdJaar) && gevraagdJaar >= 2027 && gevraagdJaar <= huidigJaar + 5
    ? gevraagdJaar : Math.max(2027, huidigJaar);

  const alleVestigingen = await prisma.vestiging.findMany({
    where: { actief: true, organisatie: { actief: true } },
    select: { id: true, naam: true },
    orderBy: { naam: "asc" },
  });
  const toegankelijkeVestigingen = eigenaar ? alleVestigingen : (await Promise.all(
    alleVestigingen.map(async (vestiging) => ({
      vestiging,
      toegang: await hasPermissionForVestiging(permissions.rapportages.view, vestiging.id),
    })),
  )).filter((item) => item.toegang).map((item) => item.vestiging);
  if (toegankelijkeVestigingen.length === 0) redirect("/dashboard");

  const geselecteerdeVestiging = params.vestiging && params.vestiging !== "alle" &&
    toegankelijkeVestigingen.some((item) => item.id === params.vestiging) ? params.vestiging : "alle";
  const vestigingIds = geselecteerdeVestiging === "alle" ? toegankelijkeVestigingen.map((item) => item.id) : [geselecteerdeVestiging];

  const weken = await prisma.week.findMany({
    where: { jaar, status: "AFGESLOTEN", vestigingId: { in: vestigingIds } },
    include: { vestiging: { select: { id: true, naam: true } }, loonkostenWeek: true },
    orderBy: [{ weeknummer: "asc" }, { vestiging: { naam: "asc" } }],
  });

  const vestigingWeken: {
    vestigingId: string; vestigingNaam: string; weeknummer: number; omzet: number; uren: number;
    kosten: number; percentage: number | null; besparingEuro: number; besparingUren: number; ontbrekendUurloon: number;
  }[] = [];
  const medewerkersMap = new Map<string, { medewerkerId: string; naam: string; uren: number; dagen: Set<string> }>();

  for (const week of weken) {
    const loonkosten = week.loonkostenWeek;
    if (!loonkosten?.afgeslotenOp || !loonkosten.snapshot || typeof loonkosten.snapshot !== "object") continue;
    const snapshot = loonkosten.snapshot as unknown as WeekSnapshot;
    if ((snapshot.versie ?? 0) < 6 || !Array.isArray(snapshot.medewerkers)) continue;

    const omzet = Number(loonkosten.omzet) || 0;
    const totaalUren = Number(loonkosten.totaalUren) || 0;
    const kosten = Number(loonkosten.totaalKosten) || 0;
    const gemiddeldUurloon = Number(loonkosten.gemiddeldUurloon) || (totaalUren > 0 ? kosten / totaalUren : 0);
    const ontbrekendUurloon = Number(snapshot.ontbrekendUurloon ?? 0);
    const compleet = ontbrekendUurloon === 0 && gemiddeldUurloon > 0;
    const budget = omzet * 0.20;
    const besparingEuro = compleet ? budget - kosten : 0;
    const besparingUren = compleet ? besparingEuro / gemiddeldUurloon : 0;
    vestigingWeken.push({
      vestigingId: week.vestigingId, vestigingNaam: week.vestiging.naam, weeknummer: week.weeknummer,
      omzet, uren: totaalUren, kosten, percentage: omzet > 0 ? kosten / omzet * 100 : null,
      besparingEuro, besparingUren, ontbrekendUurloon,
    });

    const dagenPerMedewerker = new Map<string, Set<string>>();
    for (const dienst of snapshot.diensten ?? []) {
      const dag = String(dienst.datum).slice(0, 10);
      for (const medewerker of dienst.medewerkers ?? []) {
        const dagen = dagenPerMedewerker.get(medewerker.medewerkerId) ?? new Set<string>();
        dagen.add(dag);
        dagenPerMedewerker.set(medewerker.medewerkerId, dagen);
      }
    }
    for (const medewerker of snapshot.medewerkers) {
      const huidig = medewerkersMap.get(medewerker.medewerkerId) ?? {
        medewerkerId: medewerker.medewerkerId, naam: medewerker.naam, uren: 0, dagen: new Set<string>(),
      };
      huidig.naam = medewerker.naam || huidig.naam;
      huidig.uren += Number(medewerker.uren) || 0;
      for (const dag of dagenPerMedewerker.get(medewerker.medewerkerId) ?? []) huidig.dagen.add(dag);
      medewerkersMap.set(medewerker.medewerkerId, huidig);
    }
  }

  const weekMap = new Map<number, {
    weeknummer: number; omzet: number; uren: number; kosten: number; besparingEuro: number;
    besparingUren: number; vestigingen: Set<string>; onvolledig: boolean;
  }>();
  for (const week of vestigingWeken) {
    const rij = weekMap.get(week.weeknummer) ?? {
      weeknummer: week.weeknummer, omzet: 0, uren: 0, kosten: 0, besparingEuro: 0,
      besparingUren: 0, vestigingen: new Set<string>(), onvolledig: false,
    };
    rij.omzet += week.omzet;
    rij.uren += week.uren;
    rij.kosten += week.kosten;
    rij.besparingEuro += week.besparingEuro;
    rij.besparingUren += week.besparingUren;
    rij.vestigingen.add(week.vestigingNaam);
    if (week.ontbrekendUurloon > 0) rij.onvolledig = true;
    weekMap.set(week.weeknummer, rij);
  }
  const weekRijen = Array.from(weekMap.values()).sort((a, b) => a.weeknummer - b.weeknummer)
    .map((week) => ({ ...week, vestigingen: Array.from(week.vestigingen) }));
  const totaal = vestigingWeken.reduce((acc, week) => ({
    omzet: acc.omzet + week.omzet, uren: acc.uren + week.uren, kosten: acc.kosten + week.kosten,
    besparingEuro: acc.besparingEuro + week.besparingEuro, besparingUren: acc.besparingUren + week.besparingUren,
  }), { omzet: 0, uren: 0, kosten: 0, besparingEuro: 0, besparingUren: 0 });

  const topMedewerkers = Array.from(medewerkersMap.values()).map((medewerker) => ({
    medewerkerId: medewerker.medewerkerId, naam: medewerker.naam, uren: medewerker.uren,
    dagen: medewerker.dagen.size, gemiddeldPerDag: medewerker.dagen.size > 0 ? medewerker.uren / medewerker.dagen.size : 0,
  })).sort((a, b) => b.uren - a.uren).slice(0, 10);

  const vestigingTotalen = toegankelijkeVestigingen.filter((vestiging) => vestigingIds.includes(vestiging.id)).map((vestiging) => {
    const regels = vestigingWeken.filter((week) => week.vestigingId === vestiging.id);
    const omzet = regels.reduce((sum, week) => sum + week.omzet, 0);
    const kosten = regels.reduce((sum, week) => sum + week.kosten, 0);
    const urenTotaal = regels.reduce((sum, week) => sum + week.uren, 0);
    return {
      id: vestiging.id, naam: vestiging.naam, weken: regels.length, omzet, kosten, uren: urenTotaal,
      percentage: omzet > 0 ? kosten / omzet * 100 : null,
      besparingEuro: regels.reduce((sum, week) => sum + week.besparingEuro, 0),
      besparingUren: regels.reduce((sum, week) => sum + week.besparingUren, 0),
    };
  });

  const percentage = totaal.omzet > 0 ? totaal.kosten / totaal.omzet * 100 : null;
  const gemiddeldeUurkosten = totaal.uren > 0 ? totaal.kosten / totaal.uren : 0;
  const aantalOnvolledig = vestigingWeken.filter((week) => week.ontbrekendUurloon > 0).length;

  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">Management · Personeelsinzet</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Managementbarometer</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Stuur op slimme personeelsinzet: ruimte creëren op rustige dagen en capaciteit inzetten wanneer de omzet daarom vraagt. De norm is 20% personeelskosten van de omzet.</p>
      </header>

      <form method="GET" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <label className="flex-1 text-xs font-semibold text-slate-500">Jaar
          <select name="jaar" defaultValue={jaar} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900">
            {Array.from({ length: Math.max(1, huidigJaar + 4 - 2027 + 1) }, (_, index) => 2027 + index).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="flex-1 text-xs font-semibold text-slate-500">Vestiging
          <select name="vestiging" defaultValue={geselecteerdeVestiging} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900">
            <option value="alle">Alle vestigingen</option>
            {toegankelijkeVestigingen.map((vestiging) => <option key={vestiging.id} value={vestiging.id}>{vestiging.naam}</option>)}
          </select>
        </label>
        <div className="flex items-end"><button className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto">Toepassen</button></div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-lg font-bold text-slate-900">Resultaat {jaar}</h2><p className="text-sm text-slate-500">Uitsluitend afgesloten weken · norm 20% · {weekRijen.length} afgesloten weken</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">Cumulatief vanaf 1 januari {jaar}</span>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Bespaarde uren" value={uren(totaal.besparingUren)} detail="Ruimte onder de 20%-norm, omgerekend tegen gemiddelde uurkosten" icon={Clock3} positive={totaal.besparingUren >= 0} />
        <Kpi label="Bespaarde loonkosten" value={euro(totaal.besparingEuro)} detail="Verschil ten opzichte van 20% van de omzet" icon={Euro} positive={totaal.besparingEuro >= 0} />
        <Kpi label="Totale omzet" value={euro(totaal.omzet)} detail="Omzet uit afgesloten weken" icon={BarChart3} />
        <Kpi label="Totaal ingezette uren" value={uren(totaal.uren)} detail="Uren uit afgesloten weekrapportages" icon={Clock3} />
        <Kpi label="Personeelskosten / omzet" value={pct(percentage)} detail="Gewogen jaarpercentage: totale kosten ÷ totale omzet" icon={Wallet} positive={percentage !== null && percentage <= 20} />
        <Kpi label="Gemiddelde loonkosten per uur" value={gemiddeldeUurkosten > 0 ? euro(gemiddeldeUurkosten) : "—"} detail="Totale loonkosten ÷ ingezette uren" icon={Users} />
      </section>

      {aantalOnvolledig > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{aantalOnvolledig} afgesloten vestigingsweek/weken heeft/hebben ontbrekende uurlonen. Voor die weken wordt geen besparing berekend; het totale kostenpercentage kan daardoor onvolledig zijn.</div>}

      {weekRijen.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <CalendarDays className="mx-auto text-slate-400" size={30} />
          <h3 className="mt-3 font-semibold text-slate-900">Nog geen afgesloten weken in {jaar}</h3>
          <p className="mt-1 text-sm text-slate-500">Zodra een week is afgesloten en de loonkostensnapshot compleet is, verschijnen de cijfers hier automatisch.</p>
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-bold text-slate-900">Wekelijkse ontwikkeling</h3><p className="mt-1 text-xs text-slate-500">Afgesloten vestigingen worden per week opgeteld. Positief betekent ruimte onder de norm; negatief betekent boven de norm.</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Week</th><th className="px-4 py-3 text-right">Omzet</th><th className="px-4 py-3 text-right">Ingezette uren</th><th className="px-4 py-3 text-right">Loonkosten</th><th className="px-4 py-3 text-right">% omzet</th><th className="px-4 py-3 text-right">Verschil t.o.v. 20%</th><th className="px-4 py-3 text-right">Urenruimte</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{weekRijen.map((week) => {
                const weekPct = week.omzet > 0 ? week.kosten / week.omzet * 100 : null;
                return <tr key={week.weeknummer} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">Week {week.weeknummer}<div className="text-xs font-normal text-slate-400">{week.vestigingen.join(", ")}</div></td>
                  <td className="px-4 py-3 text-right tabular-nums">{euro(week.omzet)}</td><td className="px-4 py-3 text-right tabular-nums">{uren(week.uren)}</td><td className="px-4 py-3 text-right tabular-nums">{euro(week.kosten)}</td>
                  <td className={"px-4 py-3 text-right font-semibold tabular-nums " + (weekPct !== null && weekPct <= 20 ? "text-emerald-700" : "text-rose-700")}>{pct(weekPct)}</td>
                  <td className={"px-4 py-3 text-right tabular-nums " + (week.besparingEuro >= 0 ? "text-emerald-700" : "text-rose-700")}>{week.onvolledig ? "Onvolledige loongegevens" : euro(week.besparingEuro)}</td>
                  <td className={"px-4 py-3 text-right font-semibold tabular-nums " + (week.besparingUren >= 0 ? "text-emerald-700" : "text-rose-700")}>{week.onvolledig ? "—" : uren(week.besparingUren)}</td>
                </tr>;
              })}</tbody>
            </table></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-bold text-slate-900">Resultaat per vestiging</h3><p className="mt-1 text-xs text-slate-500">De 20%-norm wordt per vestiging en per afgesloten week toegepast.</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left">Vestiging</th><th className="px-4 py-3 text-right">Weken</th><th className="px-4 py-3 text-right">Omzet</th><th className="px-4 py-3 text-right">Uren</th><th className="px-4 py-3 text-right">% loonkosten</th><th className="px-4 py-3 text-right">Besparing</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{vestigingTotalen.map((item) => <tr key={item.id}>
                <td className="px-4 py-3 font-semibold">{item.naam}</td><td className="px-4 py-3 text-right">{item.weken}</td><td className="px-4 py-3 text-right">{euro(item.omzet)}</td><td className="px-4 py-3 text-right">{uren(item.uren)}</td><td className="px-4 py-3 text-right">{pct(item.percentage)}</td><td className="px-4 py-3 text-right font-semibold">{euro(item.besparingEuro)}<div className="text-xs font-normal text-slate-500">{uren(item.besparingUren)}</div></td>
              </tr>)}</tbody>
            </table></div>
          </section>
        </>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-bold text-slate-900">Top 10 medewerkers · gewerkte uren en dagen</h3><p className="mt-1 text-xs text-slate-500">Uren en unieke werkdagen uit de bevroren medewerkers- en dienstenregistratie van afgesloten weken.</p></div>
        {topMedewerkers.length === 0 ? <p className="p-6 text-sm text-slate-500">Nog geen medewerkersgegevens beschikbaar.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">Medewerker</th><th className="px-4 py-3 text-right">Gewerkte dagen</th><th className="px-4 py-3 text-right">Gewerkte uren</th><th className="px-4 py-3 text-right">Gemiddeld per dag</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{topMedewerkers.map((item, index) => <tr key={item.medewerkerId}>
            <td className="px-4 py-3 text-slate-400">{index + 1}</td><td className="px-4 py-3 font-semibold text-slate-900">{item.naam}</td><td className="px-4 py-3 text-right tabular-nums">{item.dagen}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{uren(item.uren)}</td><td className="px-4 py-3 text-right tabular-nums">{uren(item.gemiddeldPerDag)}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>
      <p className="text-xs leading-5 text-slate-500">Berekening: personeelsbudget = 20% van de omzet. Bespaarde loonkosten = personeelsbudget minus berekende loonkosten. Bespaarde uren = het verschil gedeeld door het gemiddelde uurloon van die afgesloten vestigingsweek. Bij ontbrekende uurlonen wordt voor die vestigingsweek geen besparing berekend. Bedragen zijn gebaseerd op de in Clevers ERP vastgelegde uurlonen.</p>
    </main>
  );
}
