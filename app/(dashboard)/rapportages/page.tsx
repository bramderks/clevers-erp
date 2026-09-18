import { redirect } from "next/navigation";
import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LoonkostenRapport from "./LoonkostenRapport";

function getISOWeek(datum: Date) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  const dag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dag);
  const jaar = d.getUTCFullYear();
  const eerste = new Date(Date.UTC(jaar, 0, 4));
  const eersteDag = eerste.getUTCDay() || 7;
  return {
    jaar,
    weeknummer: Math.ceil((((d.getTime() - eerste.getTime()) / 86400000) + eersteDag - 1) / 7),
  };
}

function urenVanDienst(begintijd: Date, eindtijd: Date) {
  return Math.max(0, (new Date(eindtijd).getTime() - new Date(begintijd).getTime()) / 3600000);
}

type Dag = {
  datum: string;
  uren: number;
  kosten: number;
  ontbrekendUurloon: number;
};

type Medewerker = {
  medewerkerId: string;
  naam: string;
  uren: number;
  kosten: number;
  uurloon: number | null;
};

type RapportSnapshot = {
  versie?: number;
  vastgelegdOp?: string;
  dagen?: Dag[];
  medewerkers?: Medewerker[];
  ontbrekendUurloon?: number;
};

type RapportBron = {
  omzet: number;
  doelPercentage: number;
  totaalUren: number;
  totaalKosten: number;
  gemiddeldUurloon: number;
  percentageOmzet: number | null;
  ontbrekendUurloon: number;
  dagen: Dag[];
  medewerkers: Medewerker[];
  afgeslotenOp: string | null;
};

function uitSnapshot(loonkosten: {
  omzet: unknown;
  doelPercentage: unknown;
  totaalUren: unknown;
  totaalKosten: unknown;
  gemiddeldUurloon: unknown;
  percentageOmzet: unknown;
  snapshot: unknown;
  afgeslotenOp: Date | null;
}): RapportBron | null {
  if (!loonkosten.afgeslotenOp || !loonkosten.snapshot || typeof loonkosten.snapshot !== "object") {
    return null;
  }

  const snapshot = loonkosten.snapshot as RapportSnapshot;
  if (!Array.isArray(snapshot.dagen) || !Array.isArray(snapshot.medewerkers)) {
    return null;
  }

  return {
    omzet: Number(loonkosten.omzet),
    doelPercentage: Number(loonkosten.doelPercentage),
    totaalUren: Number(loonkosten.totaalUren),
    totaalKosten: Number(loonkosten.totaalKosten),
    gemiddeldUurloon: Number(loonkosten.gemiddeldUurloon),
    percentageOmzet: loonkosten.percentageOmzet == null ? null : Number(loonkosten.percentageOmzet),
    ontbrekendUurloon: Number(snapshot.ontbrekendUurloon ?? 0),
    dagen: snapshot.dagen,
    medewerkers: snapshot.medewerkers,
    afgeslotenOp: loonkosten.afgeslotenOp.toISOString(),
  };
}

export default async function RapportagesPage({
  searchParams,
}: {
  searchParams: Promise<{ vestiging?: string; jaar?: string; week?: string }>;
}) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) redirect("/login");
  if (!(await isEigenaar())) redirect("/dashboard");

  const params = await searchParams;
  const huidig = getISOWeek(new Date());
  const jaar = Number.isInteger(Number(params.jaar)) ? Number(params.jaar) : huidig.jaar;
  const weeknummer = Number.isInteger(Number(params.week)) ? Number(params.week) : huidig.weeknummer;

  const vestigingen = await prisma.vestiging.findMany({
    where: { actief: true },
    select: { id: true, naam: true },
    orderBy: { naam: "asc" },
  });

  const vestigingId =
    params.vestiging && vestigingen.some((v) => v.id === params.vestiging)
      ? params.vestiging
      : vestigingen[0]?.id;

  const week = vestigingId
    ? await prisma.week.findUnique({
        where: {
          vestigingId_jaar_weeknummer: { vestigingId, jaar, weeknummer },
        },
        include: {
          loonkostenWeek: true,
          diensten: {
            orderBy: { datum: "asc" },
            include: {
              bezetting: {
                where: {
                  medewerkerId: { not: null },
                  status: { not: "AFGEZEGD" },
                },
                include: {
                  medewerker: {
                    select: {
                      id: true,
                      voornaam: true,
                      achternaam: true,
                      uurloon: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  const globaleInstelling = await prisma.instelling.findUnique({
    where: { sleutel: "loonkosten_doel_percentage" },
  });
  const globaalDoel = globaleInstelling ? Number(globaleInstelling.waarde) : 20;
  const opgeslagenBron = week?.loonkostenWeek ? uitSnapshot(week.loonkostenWeek) : null;

  let bron: RapportBron;

  if (opgeslagenBron) {
    bron = opgeslagenBron;
  } else {
    const regels = (week?.diensten ?? []).flatMap((dienst) =>
      dienst.bezetting
        .filter((b) => b.medewerker)
        .map((b) => {
          const m = b.medewerker!;
          const uren = urenVanDienst(dienst.begintijd, dienst.eindtijd);
          const uurloon = m.uurloon == null ? null : Number(m.uurloon);
          return {
            datum: dienst.datum.toISOString(),
            medewerkerId: m.id,
            medewerkerNaam: [m.voornaam, m.achternaam].join(" "),
            uren,
            uurloon,
            kosten: uurloon == null ? null : uren * uurloon,
          };
        }),
    );

    const dagenMap = new Map<string, Dag>();
    const medewerkersMap = new Map<string, Medewerker>();

    for (const r of regels) {
      const dag = r.datum.slice(0, 10);
      const d = dagenMap.get(dag) ?? { datum: dag, uren: 0, kosten: 0, ontbrekendUurloon: 0 };
      d.uren += r.uren;
      if (r.kosten == null) d.ontbrekendUurloon += r.uren;
      else d.kosten += r.kosten;
      dagenMap.set(dag, d);

      const m = medewerkersMap.get(r.medewerkerId) ?? {
        medewerkerId: r.medewerkerId,
        naam: r.medewerkerNaam,
        uren: 0,
        kosten: 0,
        uurloon: r.uurloon,
      };
      m.uren += r.uren;
      if (r.kosten != null) m.kosten += r.kosten;
      medewerkersMap.set(r.medewerkerId, m);
    }

    const dagen = Array.from(dagenMap.values()).sort((a, b) => a.datum.localeCompare(b.datum));
    const medewerkers = Array.from(medewerkersMap.values()).sort((a, b) => b.kosten - a.kosten);
    const totaalUren = regels.reduce((t, r) => t + r.uren, 0);
    const totaalKosten = regels.reduce((t, r) => t + (r.kosten ?? 0), 0);
    const urenMetLoon = regels.reduce((t, r) => t + (r.kosten == null ? 0 : r.uren), 0);
    const gemiddeldUurloon = urenMetLoon ? totaalKosten / urenMetLoon : 0;
    const omzet = week?.loonkostenWeek ? Number(week.loonkostenWeek.omzet) : 0;
    const doelPercentage = week?.loonkostenWeek ? Number(week.loonkostenWeek.doelPercentage) : globaalDoel;

    bron = {
      omzet,
      doelPercentage,
      totaalUren,
      totaalKosten,
      gemiddeldUurloon,
      percentageOmzet: omzet > 0 ? (totaalKosten / omzet) * 100 : null,
      ontbrekendUurloon: regels.filter((r) => r.kosten == null).length,
      dagen,
      medewerkers,
      afgeslotenOp: null,
    };
  }

  const vorigeWeek = vestigingId
    ? await prisma.week.findUnique({
        where: {
          vestigingId_jaar_weeknummer: {
            vestigingId,
            jaar: jaar - 1,
            weeknummer,
          },
        },
        include: { loonkostenWeek: true },
      })
    : null;

  const vorigeSeizoen = vorigeWeek?.loonkostenWeek
    ? uitSnapshot(vorigeWeek.loonkostenWeek)
    : null;

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Eigenaar · Rapportage</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Loonkosten</h1>
        <p className="mt-1 text-sm text-slate-600">
          Geplande personeelskosten per week, met een vaste historische afsluiting.
        </p>
      </div>

      <LoonkostenRapport
        vestigingen={vestigingen}
        vestigingId={vestigingId ?? ""}
        jaar={jaar}
        weeknummer={weeknummer}
        weekBestaat={Boolean(week)}
        weekStatus={week?.status ?? null}
        afgeslotenOp={bron.afgeslotenOp}
        omzet={bron.omzet}
        doelPercentage={bron.doelPercentage}
        percentageOmzet={bron.percentageOmzet}
        totaalUren={bron.totaalUren}
        totaalKosten={bron.totaalKosten}
        gemiddeldUurloon={bron.gemiddeldUurloon}
        ontbrekendUurloon={bron.ontbrekendUurloon}
        dagen={bron.dagen}
        medewerkers={bron.medewerkers}
        vorigeSeizoen={vorigeSeizoen}
      />
    </main>
  );
}
