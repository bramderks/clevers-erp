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
  gemiddeldUurloon?: number;
};

type DienstDetail = {
  datum: string;
  begintijd: string;
  eindtijd: string;
  medewerkers: { medewerkerId: string; naam: string; uurloon: number | null }[];
};

type SeizoenWeek = {
  jaar: number;
  weeknummer: number;
  startDatum: string;
  afgesloten: boolean;
  omzet: number | null;
  verwachteOmzet: number | null;
  prognoseBron: "werkelijk" | "handmatig" | "vorig_seizoen_groei" | null;
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
  diensten?: DienstDetail[];
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
  diensten: DienstDetail[];
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
    diensten: snapshot.diensten ?? [],
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
    select: { id: true, naam: true, seizoenStart: true, seizoenEinde: true },
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
    for (const d of dagen) {
      d.gemiddeldUurloon = d.uren - d.ontbrekendUurloon > 0 ? d.kosten / (d.uren - d.ontbrekendUurloon) : 0;
    }
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
      diensten: (week?.diensten ?? []).map((dienst) => ({
        datum: dienst.datum.toISOString(),
        begintijd: dienst.begintijd.toISOString(),
        eindtijd: dienst.eindtijd.toISOString(),
        medewerkers: dienst.bezetting.filter((b) => b.medewerker).map((b) => ({
          medewerkerId: b.medewerker!.id,
          naam: [b.medewerker!.voornaam, b.medewerker!.achternaam].filter(Boolean).join(" "),
          uurloon: b.medewerker!.uurloon == null ? null : Number(b.medewerker!.uurloon),
        })),
      })),
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

  const gekozenVestiging = vestigingen.find((v) => v.id === vestigingId);
  const seizoenStart = gekozenVestiging?.seizoenStart;
  const seizoenEinde = gekozenVestiging?.seizoenEinde;

  function weekStart(jaarNummer: number, weekNummer: number) {
    const vierdeJanuari = new Date(Date.UTC(jaarNummer, 0, 4));
    const dag = vierdeJanuari.getUTCDay() || 7;
    const maandag = new Date(vierdeJanuari);
    maandag.setUTCDate(vierdeJanuari.getUTCDate() - dag + 1 + (weekNummer - 1) * 7);
    return maandag;
  }

  const seizoenWeken: SeizoenWeek[] = [];
  if (vestigingId && seizoenStart && seizoenEinde) {
    const startJaar = seizoenStart.getUTCFullYear();
    const eindJaar = seizoenEinde.getUTCFullYear();
    const alleWeken = await prisma.week.findMany({
      where: { vestigingId, jaar: { gte: startJaar, lte: eindJaar } },
      orderBy: [{ jaar: "asc" }, { weeknummer: "asc" }],
      select: { jaar: true, weeknummer: true, status: true, loonkostenWeek: { select: { omzet: true } } },
    });

    for (const w of alleWeken) {
      const start = weekStart(w.jaar, w.weeknummer);
      if (start < seizoenStart || start > seizoenEinde) continue;
      seizoenWeken.push({
        jaar: w.jaar,
        weeknummer: w.weeknummer,
        startDatum: start.toISOString(),
        afgesloten: w.status === "AFGESLOTEN" && w.loonkostenWeek != null,
        omzet: w.loonkostenWeek ? Number(w.loonkostenWeek.omzet) : null,
        verwachteOmzet: null,
        prognoseBron: null,
      });
    }
  }

  const vorigSeizoenWeken = seizoenWeken.length
    ? await prisma.week.findMany({
        where: {
          vestigingId,
          OR: seizoenWeken.map((w) => ({ jaar: w.jaar - 1, weeknummer: w.weeknummer })),
        },
        select: { jaar: true, weeknummer: true, status: true, loonkostenWeek: { select: { omzet: true } } },
      })
    : [];

  const tweeSeizoenenTerugWeken = seizoenWeken.length
    ? await prisma.week.findMany({
        where: {
          vestigingId,
          OR: seizoenWeken.map((w) => ({ jaar: w.jaar - 2, weeknummer: w.weeknummer })),
        },
        select: { jaar: true, weeknummer: true, status: true, loonkostenWeek: { select: { omzet: true } } },
      })
    : [];

  const vorigSeizoenMap = new Map(
    vorigSeizoenWeken.map((w) => [
      `${w.jaar}-${w.weeknummer}`,
      {
        omzet: w.loonkostenWeek ? Number(w.loonkostenWeek.omzet) : null,
        afgesloten: w.status === "AFGESLOTEN" && w.loonkostenWeek != null,
      },
    ]),
  );

  const tweeSeizoenenMap = new Map(
    tweeSeizoenenTerugWeken.map((w) => [
      `${w.jaar}-${w.weeknummer}`,
      w.loonkostenWeek ? Number(w.loonkostenWeek.omzet) : null,
    ]),
  );

  // De prognose voor toekomstige weken volgt de gemiddelde week-op-week
  // seizoen-op-seizoen groei van het vorige seizoen t.o.v. het seizoen daarvoor.
  const groeipercentages: number[] = [];
  for (const vorig of vorigSeizoenWeken) {
    if (vorig.status !== "AFGESLOTEN" || !vorig.loonkostenWeek) continue;
    const vorigBedrag = Number(vorig.loonkostenWeek.omzet);
    const tweeTerug = tweeSeizoenenMap.get(`${vorig.jaar - 1}-${vorig.weeknummer}`);
    if (tweeTerug != null && tweeTerug > 0 && vorigBedrag > 0) {
      groeipercentages.push((vorigBedrag / tweeTerug) - 1);
    }
  }
  const gemiddeldeSeizoensgroei = groeipercentages.length
    ? groeipercentages.reduce((t, g) => t + g, 0) / groeipercentages.length
    : null;

  const seizoenWekenMetPrognose = seizoenWeken.map((w) => {
    const vorig = vorigSeizoenMap.get(`${w.jaar - 1}-${w.weeknummer}`);
    const werkelijk = w.afgesloten ? w.omzet : null;
    const handmatig = !w.afgesloten && w.omzet != null ? w.omzet : null;
    const automatisch = !w.afgesloten && handmatig == null && vorig?.omzet != null && gemiddeldeSeizoensgroei != null
      ? vorig.omzet * (1 + gemiddeldeSeizoensgroei)
      : null;

    return {
      ...w,
      verwachteOmzet: werkelijk ?? handmatig ?? automatisch,
      prognoseBron: werkelijk != null
        ? "werkelijk" as const
        : handmatig != null
          ? "handmatig" as const
          : automatisch != null
            ? "vorig_seizoen_groei" as const
            : null,
    };
  });

  const seizoenOmzetAfgesloten = seizoenWekenMetPrognose.filter((w) => w.afgesloten).reduce((t, w) => t + (w.omzet ?? 0), 0);
  const seizoenOmzetVerwacht = seizoenWekenMetPrognose.reduce((t, w) => t + (w.verwachteOmzet ?? 0), 0);
  const vorigSeizoenOmzet = vorigSeizoenWeken.filter((w) => w.status === "AFGESLOTEN" && w.loonkostenWeek != null).reduce((t, w) => t + (Number(w.loonkostenWeek?.omzet) || 0), 0);

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
        diensten={bron.diensten}
        seizoenWeken={seizoenWekenMetPrognose}
        vorigSeizoenMap={seizoenWeken.map((w) => ({
          key: `${w.jaar}-${w.weeknummer}`,
          ...(vorigSeizoenMap.get(`${w.jaar - 1}-${w.weeknummer}`) ?? { omzet: null, afgesloten: false }),
        }))}
        seizoenOmzetAfgesloten={seizoenOmzetAfgesloten}
        seizoenOmzetVerwacht={seizoenOmzetVerwacht}
        gemiddeldeSeizoensgroei={gemiddeldeSeizoensgroei}
        vorigSeizoenOmzet={vorigSeizoenOmzet}
        seizoenStart={seizoenStart?.toISOString() ?? null}
        seizoenEinde={seizoenEinde?.toISOString() ?? null}
        vorigeSeizoen={vorigeSeizoen}
      />
    </main>
  );
}
