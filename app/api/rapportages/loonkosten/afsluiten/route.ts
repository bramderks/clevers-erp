import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function urenVanDienst(begintijd: Date, eindtijd: Date) {
  return Math.max(
    0,
    (new Date(eindtijd).getTime() - new Date(begintijd).getTime()) / 3600000,
  );
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
    const omzet = Number(body.omzet);
    const doelPercentage = Number(body.doelPercentage);

    if (
      !vestigingId ||
      !Number.isInteger(jaar) ||
      !Number.isInteger(weeknummer) ||
      weeknummer < 1 ||
      weeknummer > 53
    ) {
      throw new Error("Ongeldige week.");
    }
    if (!Number.isFinite(omzet) || omzet < 0) {
      throw new Error("Omzet moet 0 of hoger zijn.");
    }
    if (!Number.isFinite(doelPercentage) || doelPercentage <= 0 || doelPercentage > 100) {
      throw new Error("Doelpercentage moet tussen 0 en 100 liggen.");
    }

    const week = await prisma.week.findUnique({
      where: {
        vestigingId_jaar_weeknummer: { vestigingId, jaar, weeknummer },
      },
      include: {
        vestiging: { select: { organisatieId: true } },
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
    });

    if (!week) {
      throw new Error("Deze planningweek bestaat nog niet.");
    }

    if (week.status === "AFGESLOTEN") {
      return NextResponse.json(
        { error: "Deze planningweek is al afgesloten." },
        { status: 409 },
      );
    }

    if (week.vestiging.organisatieId !== gebruiker.organisaties.find(
      (relatie) => relatie.actief && relatie.organisatie.actief,
    )?.organisatieId) {
      // isEigenaar() is organisatiebreed; de concrete week wordt hieronder
      // nogmaals via de eigenaarrelaties gecontroleerd.
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
    }

    const regels = week.diensten.flatMap((dienst) =>
      dienst.bezetting
        .filter((bezetting) => bezetting.medewerker)
        .map((bezetting) => {
          const medewerker = bezetting.medewerker!;
          const uren = urenVanDienst(dienst.begintijd, dienst.eindtijd);
          const uurloon = medewerker.uurloon == null ? null : Number(medewerker.uurloon);
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
      medewerkerId: string;
      naam: string;
      uren: number;
      kosten: number;
      uurloon: number | null;
    }>();

    for (const regel of regels) {
      const dag = dagenMap.get(regel.datum) ?? {
        datum: regel.datum,
        uren: 0,
        kosten: 0,
        ontbrekendUurloon: 0,
      };
      dag.uren += regel.uren;
      if (regel.kosten == null) {
        dag.ontbrekendUurloon += regel.uren;
      } else {
        dag.kosten += regel.kosten;
      }
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

    const dagen = Array.from(dagenMap.values()).sort((a, b) => a.datum.localeCompare(b.datum));
    const medewerkers = Array.from(medewerkersMap.values()).sort((a, b) => b.kosten - a.kosten);
    const totaalUren = regels.reduce((totaal, regel) => totaal + regel.uren, 0);
    const totaalKosten = regels.reduce((totaal, regel) => totaal + (regel.kosten ?? 0), 0);
    const urenMetLoon = regels.reduce((totaal, regel) => totaal + (regel.kosten == null ? 0 : regel.uren), 0);
    const gemiddeldUurloon = urenMetLoon ? totaalKosten / urenMetLoon : 0;
    const percentageOmzet = omzet > 0 ? (totaalKosten / omzet) * 100 : null;

    const snapshot = {
      versie: 1,
      vastgelegdOp: new Date().toISOString(),
      dagen,
      medewerkers,
      ontbrekendUurloon: regels.filter((regel) => regel.kosten == null).length,
    };

    await prisma.$transaction(async (tx) => {
      await tx.loonkostenWeek.upsert({
        where: { weekId: week.id },
        update: {
          omzet,
          doelPercentage,
          totaalUren,
          totaalKosten,
          gemiddeldUurloon,
          percentageOmzet,
          snapshot,
          afgeslotenOp: new Date(),
          afgeslotenDoorId: gebruiker.id,
        },
        create: {
          weekId: week.id,
          omzet,
          doelPercentage,
          totaalUren,
          totaalKosten,
          gemiddeldUurloon,
          percentageOmzet,
          snapshot,
          afgeslotenOp: new Date(),
          afgeslotenDoorId: gebruiker.id,
        },
      });

      await tx.instelling.upsert({
        where: { sleutel: "loonkosten_doel_percentage" },
        update: {
          waarde: String(doelPercentage),
          omschrijving: "Maximaal gewenst percentage loonkosten van de omzet",
        },
        create: {
          sleutel: "loonkosten_doel_percentage",
          waarde: String(doelPercentage),
          omschrijving: "Maximaal gewenst percentage loonkosten van de omzet",
        },
      });

      await tx.week.update({
        where: { id: week.id },
        data: { status: "AFGESLOTEN" },
      });
    });

    return NextResponse.json({ ok: true, afgesloten: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Afsluiten mislukt." },
      { status: 400 },
    );
  }
}
