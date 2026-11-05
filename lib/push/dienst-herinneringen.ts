import { configureerCentralePush, verstuurPushNaarGebruiker } from "@/lib/push/service";
import { prisma } from "@/lib/prisma";
import { kalenderDatumUTC, lokaleDatumSleutel, nederlandseDatumTijd, formatDienstTijd } from "@/lib/planning/tijd";

type HerinneringType = "DIENST_24U" | "DIENST_12U" | "DIENST_2U";

const HERINNERINGEN: Array<{
  type: HerinneringType;
  minuten: number;
}> = [
  { type: "DIENST_24U", minuten: 24 * 60 },
  { type: "DIENST_12U", minuten: 12 * 60 },
  { type: "DIENST_2U", minuten: 2 * 60 },
];

function datumMetTijd(datum: Date, tijd: Date) {
  return nederlandseDatumTijd(
    lokaleDatumSleutel(datum),
    formatDienstTijd(tijd),
  );
}

function binnenVenster(
  nu: Date,
  doel: Date,
  minuten: number,
) {
  const verschil = doel.getTime() - nu.getTime();

  const venster = minuten * 60_000;

  return verschil <= venster && verschil >= -venster;
}

export async function verstuurDienstHerinneringen() {
  if (!configureerCentralePush()) {
    throw new Error("VAPID-configuratie ontbreekt.");
  }

  const nu = new Date();
  const zoekTot = new Date(nu.getTime() + 24 * 60 * 60 * 1000 + 5 * 60_000);

  const bezettingen = await prisma.dienstBezetting.findMany({
    where: {
      medewerkerId: { not: null },
      status: {
        in: ["GEPLAND", "BEVESTIGD"],
      },
      dienst: {
        datum: {
          gte: kalenderDatumUTC(
            lokaleDatumSleutel(new Date(nu.getTime() - 24 * 60 * 60 * 1000)),
          ),
          lte: kalenderDatumUTC(lokaleDatumSleutel(zoekTot)),
        },
        week: {
          status: "GEPUBLICEERD",
        },
      },
      medewerker: {
        systeemGebruikerId: { not: null },
      },
    },
    include: {
      dienst: true,
      medewerker: {
        select: {
          id: true,
          voornaam: true,
          achternaam: true,
          systeemGebruikerId: true,
        },
      },
    },
  });

  let gecontroleerd = 0;
  let verstuurd = 0;
  let overgeslagen = 0;
  let fouten = 0;

  for (const bezetting of bezettingen) {
    if (!bezetting.medewerker?.systeemGebruikerId) continue;

    const begint = datumMetTijd(
      bezetting.dienst.datum,
      bezetting.dienst.begintijd,
    );

    for (const herinnering of HERINNERINGEN) {
      gecontroleerd += 1;

      const doel = new Date(
        begint.getTime() - herinnering.minuten * 60_000,
      );

      if (!binnenVenster(nu, doel, 5)) continue;

      const result = await verstuurPushNaarGebruiker({
        systeemGebruikerId: bezetting.medewerker.systeemGebruikerId,
        type: herinnering.type,
        sleutel: "dienst:" + bezetting.id + ":" + herinnering.type,
        titel: "Clevers — dienstherinnering",
        body:
          herinnering.type === "DIENST_24U"
            ? "Je dienst begint over ongeveer 24 uur."
            : herinnering.type === "DIENST_12U"
              ? "Je dienst begint over ongeveer 12 uur."
              : "Je dienst begint over ongeveer 2 uur.",
        href: "/app/planning",
        dienstBezettingId: bezetting.id,
        geplandVoor: doel,
      });
      verstuurd += result.verstuurd;
      fouten += result.fouten;
      overgeslagen += result.overgeslagen;
    }
  }

  return {
    gecontroleerd,
    verstuurd,
    overgeslagen,
    fouten,
  };
}

