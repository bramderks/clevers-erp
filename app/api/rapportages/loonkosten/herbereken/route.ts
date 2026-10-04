import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { berekenGewerkteUren } from "@/lib/verloning/pauze";


function getISOWeek(datum: Date) {
  const d = new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
  const dag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dag);
  const jaar = d.getUTCFullYear();
  const eerste = new Date(Date.UTC(jaar, 0, 4));
  const eersteDag = eerste.getUTCDay() || 7;
  return { jaar, weeknummer: Math.ceil((((d.getTime() - eerste.getTime()) / 86400000) + eersteDag - 1) / 7) };
}
function datumVanLokaleBegintijd(begintijd: Date) {
  const delen = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(begintijd);
  const jaar = delen.find((d) => d.type === "year")?.value;
  const maand = delen.find((d) => d.type === "month")?.value;
  const dag = delen.find((d) => d.type === "day")?.value;
  return new Date(Date.UTC(Number(jaar), Number(maand) - 1, Number(dag)));
}

function dienstValtInWeek(dienst: { begintijd: Date }, jaar: number, weeknummer: number) {
  const iso = getISOWeek(datumVanLokaleBegintijd(dienst.begintijd));
  return iso.jaar === jaar && iso.weeknummer === weeknummer;
}

function uurloonVoorDienst(
  medewerker: {
    uurloon: unknown;
    loonperiodes: Array<{ uurloon: unknown; periodeStart: Date; periodeEinde: Date }>;
  },
  datum: Date,
) {
  const periode = medewerker.loonperiodes.find(
    (item) => item.periodeStart <= datum && item.periodeEinde >= datum,
  );
  if (periode) return Number(periode.uurloon);
  return medewerker.uurloon == null ? null : Number(medewerker.uurloon);
}

export async function POST(request: NextRequest) {
  try {
    const gebruiker = await getCurrentUser();
    if (!gebruiker || !(await isEigenaar())) {
      return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
    }

    const body = await request.json();
    const vestigingId = typeof body.vestigingId === "string" ? body.vestigingId : "";
    const jaar = Number(body.jaar);
    const weeknummer = Number(body.weeknummer);

    if (!vestigingId || !Number.isInteger(jaar) || !Number.isInteger(weeknummer)) {
      throw new Error("Ongeldige week.");
    }

    const week = await prisma.week.findUnique({
      where: { vestigingId_jaar_weeknummer: { vestigingId, jaar, weeknummer } },
      include: {
        vestiging: { select: { organisatieId: true } },
        loonkostenWeek: true,
        diensten: {
          orderBy: { datum: "asc" },
          include: {
            bezetting: {
              where: { medewerkerId: { not: null }, status: { not: "AFGEZEGD" } },
              include: {
                medewerker: {
                  select: {
                    id: true,
                    voornaam: true,
                    achternaam: true,
                    uurloon: true,
                    loonperiodes: {
                      where: { actief: true },
                      select: { uurloon: true, periodeStart: true, periodeEinde: true },
                      orderBy: { periodeStart: "desc" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!week) throw new Error("Deze planningweek bestaat niet.");
    if (week.status !== "AFGESLOTEN" || !week.loonkostenWeek) {
      throw new Error("Deze week is niet afgesloten.");
    }

    const eigenaarVoorVestiging = gebruiker.organisaties.some(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        relatie.rol.naam.trim().toLowerCase() === "eigenaar" &&
        relatie.organisatieId === week.vestiging.organisatieId,
    );
    if (!eigenaarVoorVestiging) {
      return NextResponse.json({ error: "Geen toegang tot deze vestiging." }, { status: 403 });
    }

    const actueleWeekDiensten = week.diensten.filter((dienst) => dienstValtInWeek(dienst, jaar, weeknummer));
    const regels = actueleWeekDiensten.flatMap((dienst) =>
      dienst.bezetting.filter((b) => b.medewerker).map((bezetting) => {
        const medewerker = bezetting.medewerker!;
        const uren = berekenGewerkteUren(dienst.begintijd, dienst.eindtijd).gewerkteUren;
        const uurloon = uurloonVoorDienst(medewerker, dienst.datum);
        return {
          datum: dienst.datum.toISOString().slice(0, 10),
          medewerkerId: medewerker.id,
          medewerkerNaam: [medewerker.voornaam, medewerker.achternaam].filter(Boolean).join(" "),
          uren,
          uurloon,
          kosten: uurloon == null ? null : uren * uurloon,
        };
      }),
    );

    const dagenMap = new Map<string, { datum: string; uren: number; kosten: number; ontbrekendUurloon: number }>();
    const medewerkersMap = new Map<string, {
      medewerkerId: string; naam: string; uren: number; kosten: number; uurloon: number | null;
    }>();

    for (const regel of regels) {
      const dag = dagenMap.get(regel.datum) ?? { datum: regel.datum, uren: 0, kosten: 0, ontbrekendUurloon: 0 };
      dag.uren += regel.uren;
      if (regel.kosten == null) dag.ontbrekendUurloon += regel.uren;
      else dag.kosten += regel.kosten;
      dagenMap.set(regel.datum, dag);

      const medewerker = medewerkersMap.get(regel.medewerkerId) ?? {
        medewerkerId: regel.medewerkerId,
        naam: regel.medewerkerNaam,
        uren: 0,
        kosten: 0,
        uurloon: regel.uurloon,
      };
      medewerker.uren += regel.uren;
      if (regel.kosten != null) medewerker.kosten += regel.kosten;
      medewerkersMap.set(regel.medewerkerId, medewerker);
    }

    const dagen = Array.from(dagenMap.values())
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .map((dag) => ({
        ...dag,
        gemiddeldUurloon: dag.uren - dag.ontbrekendUurloon > 0
          ? dag.kosten / (dag.uren - dag.ontbrekendUurloon)
          : 0,
      }));
    const medewerkers = Array.from(medewerkersMap.values()).sort((a, b) => b.kosten - a.kosten);
    const totaalUren = regels.reduce((t, regel) => t + regel.uren, 0);
    const totaalKosten = regels.reduce((t, regel) => t + (regel.kosten ?? 0), 0);
    const urenMetLoon = regels.reduce((t, regel) => t + (regel.kosten == null ? 0 : regel.uren), 0);
    const gemiddeldUurloon = urenMetLoon ? totaalKosten / urenMetLoon : 0;
    const omzet = Number(week.loonkostenWeek.omzet);
    const doelPercentage = Number(week.loonkostenWeek.doelPercentage);
    const percentageOmzet = omzet > 0 ? (totaalKosten / omzet) * 100 : null;

    const diensten = actueleWeekDiensten.map((dienst) => ({
      datum: dienst.datum.toISOString(),
      begintijd: dienst.begintijd.toISOString(),
      eindtijd: dienst.eindtijd.toISOString(),
      pauzeMinuten: berekenGewerkteUren(dienst.begintijd, dienst.eindtijd).pauzeMinuten,
      medewerkers: dienst.bezetting.filter((b) => b.medewerker).map((b) => ({
        medewerkerId: b.medewerker!.id,
        naam: [b.medewerker!.voornaam, b.medewerker!.achternaam].filter(Boolean).join(" "),
        uurloon: uurloonVoorDienst(b.medewerker!, dienst.datum),
      })),
    }));

    const snapshot = {
      versie: 5,
      vastgelegdOp: new Date().toISOString(),
      dagen,
      medewerkers,
      diensten,
      ontbrekendUurloon: regels.filter((regel) => regel.kosten == null).length,
    };

    await prisma.loonkostenWeek.update({
      where: { id: week.loonkostenWeek.id },
      data: {
        totaalUren,
        totaalKosten,
        gemiddeldUurloon,
        percentageOmzet,
        snapshot,
        afgeslotenOp: new Date(),
        afgeslotenDoorId: gebruiker.id,
      },
    });

    return NextResponse.json({
      ok: true,
      totaalUren,
      totaalKosten,
      gemiddeldUurloon,
      percentageOmzet,
      diensten: actueleWeekDiensten.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Herberekenen mislukt." },
      { status: 400 },
    );
  }
}
