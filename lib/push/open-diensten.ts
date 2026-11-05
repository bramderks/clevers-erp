import { configureerCentralePush, verstuurPushNaarGebruiker } from "@/lib/push/service";
import { prisma } from "@/lib/prisma";
import { kalenderDatumUTC, lokaleDatumSleutel } from "@/lib/planning/tijd";

type OpenDienstHerinneringType = "OPEN_DIENST_72U" | "OPEN_DIENST_48U" | "OPEN_DIENST_24U";

const VENSTERS: Array<{ type: OpenDienstHerinneringType; minuten: number }> = [
  { type: "OPEN_DIENST_72U", minuten: 72 * 60 },
  { type: "OPEN_DIENST_48U", minuten: 48 * 60 },
  { type: "OPEN_DIENST_24U", minuten: 24 * 60 },
];

function binnenVenster(nu: Date, doel: Date) {
  // De cron draait ieder uur. Een melding is verschuldigd
  // vanaf het doelmoment tot 65 minuten daarna, zodat een
  // exacte 72/48/24-uursgrens niet gemist kan worden.
  const verschil = nu.getTime() - doel.getTime();
  return verschil >= 0 && verschil < 65 * 60_000;
}

export async function verstuurOpenDienstMeldingen() {
  if (!configureerCentralePush()) {
    throw new Error("VAPID-configuratie ontbreekt.");
  }

  const nu = new Date();
  const zoekVanaf = new Date(nu.getTime() - 5 * 60_000);
  const zoekTot = new Date(nu.getTime() + 72 * 60 * 60 * 1000 + 65 * 60_000);

  const openDiensten = await prisma.dienstBezetting.findMany({
    where: {
      status: "OPEN",
      medewerkerId: null,
      dienst: {
        datum: {
          gte: kalenderDatumUTC(lokaleDatumSleutel(zoekVanaf)),
          lte: kalenderDatumUTC(lokaleDatumSleutel(zoekTot)),
        },
        week: {
          status: "GEPUBLICEERD",
        },
      },
    },
    include: {
      dienst: {
        include: {
          tags: {
            include: { tag: true },
          },
          week: {
            include: {
              vestiging: true,
            },
          },
        },
      },
    },
  });

  let gecontroleerd = 0;
  let verstuurd = 0;
  let overgeslagen = 0;
  let fouten = 0;

  for (const bezetting of openDiensten) {
    const dienst = bezetting.dienst;
    const begint = new Date(dienst.begintijd);

    if (dienst.week.vestiging.seizoenEinde && begint > dienst.week.vestiging.seizoenEinde) continue;

    const tagIds = dienst.tags.map((item) => item.tagId);
    if (tagIds.length === 0) continue;

    const medewerkers = await prisma.medewerker.findMany({
      where: {
        actief: true,
        systeemGebruikerId: { not: null },
        vestigingen: {
          some: { vestigingId: dienst.week.vestigingId },
        },
        AND: tagIds.map((tagId) => ({
          tags: { some: { tagId } },
        })),
      },
      select: {
        id: true,
        systeemGebruikerId: true,
        voornaam: true,
      },
    });

    for (const venster of VENSTERS) {
      gecontroleerd += 1;
      const doel = new Date(begint.getTime() - venster.minuten * 60_000);
      if (!binnenVenster(nu, doel)) continue;

      for (const medewerker of medewerkers) {
        if (!medewerker.systeemGebruikerId) continue;

        const result = await verstuurPushNaarGebruiker({
          systeemGebruikerId: medewerker.systeemGebruikerId,
          type: venster.type,
          sleutel: "open-dienst:" + bezetting.id + ":" + venster.type,
          titel: "Clevers — open dienst",
          body: dienst.week.vestiging.naam + ": er staat een open dienst klaar. Je kunt je beschikbaarheid doorgeven.",
          href: "/dashboard",
          dienstBezettingId: bezetting.id,
          geplandVoor: doel,
        });
        verstuurd += result.verstuurd;
        fouten += result.fouten;
        overgeslagen += result.overgeslagen;
      }
    }
  }

  return { gecontroleerd, verstuurd, overgeslagen, fouten };
}


/**
 * Stuur direct na het publiceren van een nieuwe open dienst
 * een pushmelding naar alle actieve medewerkers die minimaal
 * alle planningstags van de dienst hebben.
 */
export async function verstuurDirecteOpenDienstMelding(
  dienstBezettingId: string,
) {
  if (!configureerCentralePush()) return { verstuurd: 0, fouten: 0 };

  const bezetting = await prisma.dienstBezetting.findUnique({
    where: { id: dienstBezettingId },
    include: {
      dienst: {
        include: {
          tags: { select: { tagId: true } },
          week: {
            include: {
              vestiging: { select: { id: true, naam: true, seizoenEinde: true } },
            },
          },
        },
      },
    },
  });

  if (!bezetting || bezetting.dienst.week.status !== "GEPUBLICEERD" || bezetting.status !== "OPEN" || bezetting.medewerkerId !== null) {
    return { verstuurd: 0, fouten: 0 };
  }

  const tagIds = bezetting.dienst.tags.map((tag) => tag.tagId);
  if (tagIds.length === 0) return { verstuurd: 0, fouten: 0 };

  const medewerkers = await prisma.medewerker.findMany({
    where: {
      actief: true,
      systeemGebruikerId: { not: null },
      vestigingen: { some: { vestigingId: bezetting.dienst.week.vestigingId } },
      AND: tagIds.map((tagId) => ({
        tags: { some: { tagId } },
      })),
    },
    select: { systeemGebruikerId: true },
  });

  let verstuurd = 0;
  let fouten = 0;

  for (const medewerker of medewerkers) {
    if (!medewerker.systeemGebruikerId) continue;

    const result = await verstuurPushNaarGebruiker({
      systeemGebruikerId: medewerker.systeemGebruikerId,
      type: "OPEN_DIENST_DIRECT",
      sleutel: "open-dienst-direct:" + bezetting.id,
      titel: "Clevers — open dienst",
      body: bezetting.dienst.week.vestiging.naam + ": er is een open dienst voor jouw functie.",
      href: "/dashboard",
      dienstBezettingId: bezetting.id,
    });
    verstuurd += result.verstuurd;
    fouten += result.fouten;
  }

  return { verstuurd, fouten };
}


/**
 * Stuur eenmalig een persoonlijke pushmelding zodra een nieuwe
 * actiegerichte taak voor de ingelogde gebruiker beschikbaar is.
 */
export async function verstuurNieuweTaakMeldingen(
  systeemGebruikerId: string,
  taken: Array<{
    id: string;
    titel: string;
    actie: string;
  }>,
) {
  if (!configureerCentralePush() || taken.length === 0) {
    return { verstuurd: 0, fouten: 0 };
  }

  let verstuurd = 0;
  let fouten = 0;

  for (const taak of taken) {
    if (taak.actie === "EIGENAAR_AANKOMENDE_DIENSTEN") continue;

    const result = await verstuurPushNaarGebruiker({
      systeemGebruikerId,
      type: "TAAK_NIEUW",
      sleutel: "taak-nieuw:" + systeemGebruikerId + ":" + taak.id,
      titel: "Clevers — nieuwe taak",
      body: "Er staat een nieuwe taak voor je klaar.",
      href: "/dashboard",
    });
    verstuurd += result.verstuurd;
    fouten += result.fouten;
  }

  return { verstuurd, fouten };
}
