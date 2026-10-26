import { NextResponse } from "next/server";

import {
  hasPermissionForVestiging,
  isEigenaar,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { kalenderDatumUTC, lokaleDatumSleutel, lokaleKalenderDatumUTC, nederlandseDatumTijd, lokaleTijdMinuten } from "@/lib/planning/tijd";
import { lokaleDagGrenzen } from "@/lib/planning/tijd";
import { berekenGewerkteUren } from "@/lib/verloning/pauze";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type PlanningTagInput = {
  tagId: string;
  aantal: number;
};

/*
 * ============================================================
 * TIJDINSTELLINGEN
 * ============================================================
 *
 * Diensten kunnen worden gepland:
 *
 * - vanaf 08:30
 * - tot maximaal 23:00
 * - uitsluitend per 15 minuten
 *
 * Geldige voorbeelden:
 *
 * 08:30
 * 08:45
 * 09:00
 * 09:15
 * ...
 * 22:30
 * 23:00
 */

const START_MINUTEN = 8 * 60 + 30;
const EINDE_MINUTEN = 23 * 60;
const TIJD_INTERVAL = 15;

/*
 * ============================================================
 * ORGANISATIE OPHALEN
 * ============================================================
 */

async function haalOrganisatieIdOp(
  vestigingId: string,
): Promise<string> {
  const vestiging =
    await prisma.vestiging.findUnique({
      where: {
        id: vestigingId,
      },
      select: {
        organisatieId: true,
      },
    });

  if (!vestiging) {
    throw new Error(
      "Vestiging niet gevonden.",
    );
  }

  return vestiging.organisatieId;
}

/*
 * ============================================================
 * DIENST OPHALEN
 * ============================================================
 */

async function haalDienstOp(id: string) {
  return prisma.dienst.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      datum: true,
      begintijd: true,
      eindtijd: true,

      week: {
        select: {
          id: true,
          status: true,
          vestigingId: true,
          jaar: true,
          weeknummer: true,
          vestiging: {
            select: {
              organisatieId: true,
            },
          },
        },
      },
      bezetting: {
        where: {
          status: { not: "AFGEZEGD" },
          medewerkerId: { not: null },
        },
        select: {
          medewerkerId: true,
        },
      },
    },
  });
}

/*
 * ============================================================
 * VOLLEDIGE DIENST OPHALEN
 * ============================================================
 */

/*
 * ============================================================
 * TAGS VERWERKEN
 * ============================================================
 */

function verwerkTags(
  tags: unknown,
): PlanningTagInput[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const uniekeTags = new Map<
    string,
    PlanningTagInput
  >();

  for (const tag of tags) {
    /*
     * Ondersteuning voor alleen een tag-ID.
     */

    if (typeof tag === "string") {
      uniekeTags.set(tag, {
        tagId: tag,
        aantal: 1,
      });

      continue;
    }

    /*
     * Ondersteuning voor:
     *
     * {
     *   tagId: "...",
     *   aantal: 2
     * }
     */

    if (
      typeof tag === "object" &&
      tag !== null &&
      "tagId" in tag &&
      typeof tag.tagId === "string"
    ) {
      const aantal =
        "aantal" in tag &&
        typeof tag.aantal === "number" &&
        Number.isInteger(tag.aantal) &&
        tag.aantal > 0
          ? tag.aantal
          : 1;

      uniekeTags.set(tag.tagId, {
        tagId: tag.tagId,
        aantal,
      });
    }
  }

  return Array.from(
    uniekeTags.values(),
  );
}

/*
 * ============================================================
 * DATUM VERWERKEN
 * ============================================================
 */

function datumUitWaarde(waarde: unknown): Date | null {
  if (typeof waarde !== "string") return null;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(waarde)) return kalenderDatumUTC(waarde);
    const datum = new Date(waarde);
    return Number.isNaN(datum.getTime()) ? null : datum;
  } catch {
    return null;
  }
}

function tijdUitWaarde(waarde: unknown, datum: Date): Date | null {
  if (typeof waarde !== "string") return null;
  if (/^\d{1,2}:\d{2}$/.test(waarde)) {
    try { return nederlandseDatumTijd(lokaleDatumSleutel(datum), waarde); } catch { return null; }
  }
  const bestaande = new Date(waarde);
  return Number.isNaN(bestaande.getTime()) ? null : bestaande;
}

function tijdNaarMinuten(datum: Date): number {
  return lokaleTijdMinuten(datum);
}

function isoWeekVanDatum(datum: Date): { jaar: number; weeknummer: number } {
  const sleutel = lokaleDatumSleutel(datum);
  const [jaar, maand, dag] = sleutel.split("-").map(Number);
  const utcDatum = new Date(Date.UTC(jaar, maand - 1, dag));
  const dagVanWeek = utcDatum.getUTCDay() || 7;
  utcDatum.setUTCDate(utcDatum.getUTCDate() + 4 - dagVanWeek);
  const isoJaar = utcDatum.getUTCFullYear();
  const jaarStart = new Date(Date.UTC(isoJaar, 0, 1));
  const weeknummer = Math.ceil(
    ((utcDatum.getTime() - jaarStart.getTime()) / 86400000 + 1) / 7,
  );
  return { jaar: isoJaar, weeknummer };
}

function isGeldigTijdsinterval(datum: Date): boolean {
  return lokaleTijdMinuten(datum) % TIJD_INTERVAL === 0;
}

/*
 * ============================================================
 * DIENST WIJZIGEN
 * ============================================================
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const bestaand = await haalDienstOp(id);

    if (!bestaand) {
      return NextResponse.json(
        { fout: "Dienst niet gevonden." },
        { status: 404 },
      );
    }

    if (bestaand.week.status === "AFGESLOTEN") {
      return NextResponse.json(
        { fout: "Deze dienst hoort bij een afgesloten planningweek en kan niet meer worden gewijzigd." },
        { status: 409 },
      );
    }

    const organisatieId = await haalOrganisatieIdOp(
      bestaand.week.vestigingId,
    );
    const eigenaar = await isEigenaar(organisatieId);

    if (!eigenaar) {
      return NextResponse.json(
        { fout: "Alleen de eigenaar kan een dienst wijzigen." },
        { status: 403 },
      );
    }

    const toegang = await hasPermissionForVestiging(
      permissions.planning.update,
      bestaand.week.vestigingId,
    );

    if (!toegang) {
      return NextResponse.json(
        { fout: "Je hebt geen rechten om deze dienst te wijzigen." },
        { status: 403 },
      );
    }

    let body: {
      datum?: unknown;
      begintijd?: unknown;
      eindtijd?: unknown;
      opmerkingen?: unknown;
      tags?: unknown;
      isReserve?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { fout: "De aanvraag bevat geen geldige JSON." },
        { status: 400 },
      );
    }

    const datum = datumUitWaarde(body.datum);
    const begintijd = datum && tijdUitWaarde(body.begintijd, datum);
    const eindtijd = datum && tijdUitWaarde(body.eindtijd, datum);

    if (!datum || !begintijd || !eindtijd) {
      return NextResponse.json(
        { fout: "Datum, begintijd en eindtijd zijn verplicht en moeten geldig zijn." },
        { status: 400 },
      );
    }

    const isoWeek = isoWeekVanDatum(datum);
    if (
      isoWeek.jaar !== bestaand.week.jaar ||
      isoWeek.weeknummer !== bestaand.week.weeknummer
    ) {
      return NextResponse.json(
        { fout: "De gekozen datum valt niet binnen de geselecteerde planningweek." },
        { status: 400 },
      );
    }

    const beginMinuten = tijdNaarMinuten(begintijd);
    const eindeMinuten = tijdNaarMinuten(eindtijd);

    if (
      beginMinuten < START_MINUTEN ||
      eindeMinuten > EINDE_MINUTEN ||
      eindeMinuten <= beginMinuten ||
      eindeMinuten - beginMinuten < 30 ||
      !isGeldigTijdsinterval(begintijd) ||
      !isGeldigTijdsinterval(eindtijd)
    ) {
      return NextResponse.json(
        { fout: "Controleer de diensttijden. Diensten starten vanaf 08:30, eindigen uiterlijk om 23:00 en worden per 15 minuten ingepland met een minimale duur van 30 minuten." },
        { status: 400 },
      );
    }

    const dienstTags = verwerkTags(body.tags);
    if (dienstTags.length === 0) {
      return NextResponse.json(
        { fout: "Selecteer minimaal één planningstag." },
        { status: 400 },
      );
    }

    const opmerkingen =
      typeof body.opmerkingen === "string" && body.opmerkingen.trim()
        ? body.opmerkingen.trim()
        : null;

    /*
     * Het wijzigen van diensttijden mag geen bestaande bezetting
     * onveilig maken. Controleer daarom ook bij bewerken de
     * afgesproken reistijdbuffer tussen vestigingen.
     */
    const medewerkerIds = bestaand.bezetting
      .map((bezetting) => bezetting.medewerkerId)
      .filter((medewerkerId): medewerkerId is string => medewerkerId !== null);

    if (medewerkerIds.length > 0) {
      const dagGrenzen = lokaleDagGrenzen(begintijd);
      const andereDiensten = await prisma.dienstBezetting.findMany({
        where: {
          medewerkerId: { in: medewerkerIds },
          status: { not: "AFGEZEGD" },
          dienst: {
            id: { not: id },
            begintijd: { gte: dagGrenzen.start, lt: dagGrenzen.einde },
            week: {
              vestiging: {
                organisatieId: bestaand.week.vestiging.organisatieId,
              },
            },
          },
        },
        select: {
          medewerkerId: true,
          dienst: {
            select: {
              begintijd: true,
              eindtijd: true,
              week: {
                select: {
                  vestiging: {
                    select: { id: true, naam: true },
                  },
                },
              },
            },
          },
        },
      });

      const buffer = 60 * 60 * 1000;
      const conflict = andereDiensten.find((bezetting) => {
        if (bezetting.dienst.week.vestiging.id === bestaand.week.vestigingId) {
          return false;
        }
        return (
          begintijd.getTime() < bezetting.dienst.eindtijd.getTime() + buffer &&
          eindtijd.getTime() > bezetting.dienst.begintijd.getTime() - buffer
        );
      });

      if (conflict) {
        return NextResponse.json(
          {
            fout: `De gewijzigde dienst conflicteert met een dienst in ${conflict.dienst.week.vestiging.naam}. Tussen vestigingen is 1 uur reistijd gereserveerd.`,
            code: "ANDERE_VESTIGING_ZELFDE_DAG",
          },
          { status: 409 },
        );
      }
    }

    if (body.isReserve !== undefined && typeof body.isReserve !== "boolean") {
      return NextResponse.json({ fout: "isReserve moet een boolean zijn." }, { status: 400 });
    }

    const tijdenGewijzigd =
      lokaleDatumSleutel(bestaand.datum) !== lokaleDatumSleutel(datum) ||
      bestaand.begintijd.getTime() !== begintijd.getTime() ||
      bestaand.eindtijd.getTime() !== eindtijd.getTime();

    const alleRegistraties = await prisma.urenRegistratie.findMany({
      where: { dienstBezetting: { dienstId: id } },
      select: {
        id: true,
        datum: true,
        status: true,
        werkelijkeBegintijd: true,
        werkelijkeEindtijd: true,
      },
    });

    if (tijdenGewijzigd && alleRegistraties.some((registratie) => !["TE_CONTROLEREN", "AFGEKEURD"].includes(registratie.status))) {
      return NextResponse.json(
        { fout: "Deze dienst heeft al definitief gecontroleerde uren. Heropen eerst de verloning of corrigeer de urenregistratie voordat je de diensttijden wijzigt.", code: "DEFINITIEVE_UREN_NIET_WIJZIGBAAR" },
        { status: 409 },
      );
    }

    // Synchroniseer ook als de dienst al eerder is gewijzigd maar de
    // gekoppelde urenregistratie nog de oude tijden bevat. In dat geval
    // kan tijdenGewijzigd false zijn, terwijl de registratie nog achterloopt.
    const registratieLooptAchter = (registratie: (typeof alleRegistraties)[number]) =>
      lokaleDatumSleutel(registratie.werkelijkeBegintijd) !== lokaleDatumSleutel(begintijd) ||
      lokaleDatumSleutel(registratie.werkelijkeEindtijd) !== lokaleDatumSleutel(eindtijd) ||
      lokaleTijdMinuten(registratie.werkelijkeBegintijd) !== lokaleTijdMinuten(begintijd) ||
      lokaleTijdMinuten(registratie.werkelijkeEindtijd) !== lokaleTijdMinuten(eindtijd);

    const bestaandeRegistraties = alleRegistraties.filter((registratie) =>
      ["TE_CONTROLEREN", "AFGEKEURD"].includes(registratie.status) &&
      (tijdenGewijzigd || registratieLooptAchter(registratie) || registratie.status === "AFGEKEURD"),
    );

    const maandSleutels = new Map<string, { jaar: number; maand: number }>();
    for (const registratie of bestaandeRegistraties) {
      for (const sleutelDatum of [registratie.datum, begintijd]) {
        const [jaar, maand] = lokaleDatumSleutel(sleutelDatum).split("-").map(Number);
        maandSleutels.set(`${jaar}-${maand}`, { jaar, maand });
      }
    }

    const verloningsPeriodes = maandSleutels.size > 0
      ? await prisma.verloningsPeriode.findMany({
          where: {
            OR: Array.from(maandSleutels.values()).map(({ jaar, maand }) => ({ jaar, maand })),
          },
          select: { id: true, jaar: true, maand: true, status: true },
        })
      : [];

    if (verloningsPeriodes.some((periode) => periode.status !== "AANGEMAAKT")) {
      return NextResponse.json(
        {
          fout: "De uren van deze dienst vallen in een verloningsperiode die al klaarstaat of verwerkt is. Heropen eerst de verloning voordat je de diensttijden wijzigt.",
          code: "VERLONINGSPERIODE_NIET_WIJZIGBAAR",
        },
        { status: 409 },
      );
    }

    const bijgewerkt = await prisma.$transaction(async (tx) => {
      const dienst = await tx.dienst.update({
        where: { id },
        data: {
          ...(typeof body.isReserve === "boolean" ? { isReserve: body.isReserve } : {}),
          datum: kalenderDatumUTC(lokaleDatumSleutel(datum)),
          begintijd,
          eindtijd,
          opmerkingen,
          tags: {
            deleteMany: {},
            create: dienstTags.map((tag) => ({
              tagId: tag.tagId,
              aantal: tag.aantal,
            })),
          },
        },
        include: {
          week: {
            select: {
              id: true,
              vestigingId: true,
            },
          },
          tags: {
            include: { tag: true },
            orderBy: { tag: { volgorde: "asc" } },
          },
          bezetting: {
            include: {
              medewerker: {
                select: {
                  id: true,
                  personeelsnummer: true,
                  aanhef: true,
                  voornaam: true,
                  tussenvoegsel: true,
                  achternaam: true,
                },
              },
            },
            orderBy: { aangemaaktOp: "asc" },
          },
        },
      });

      if (tijdenGewijzigd) {
        const berekening = berekenGewerkteUren(begintijd, eindtijd);
        for (const registratie of bestaandeRegistraties) {
          await tx.urenRegistratie.update({
            where: { id: registratie.id },
            data: {
              datum: lokaleKalenderDatumUTC(begintijd),
              werkelijkeBegintijd: begintijd,
              werkelijkeEindtijd: eindtijd,
              pauzeMinuten: berekening.pauzeMinuten,
              gewerkteUren: berekening.gewerkteUren,
              status: "TE_CONTROLEREN",
              gecontroleerdDoorId: null,
              gecontroleerdOp: null,
            },
          });
        }
      } else {
        // Een afgekeurde registratie moet bij opslaan altijd opnieuw
        // worden gesynchroniseerd met de actuele dienst. Zo blijven geen
        // oude tijden staan wanneer de dienst al eerder is aangepast.
        const afgekeurdeRegistraties = bestaandeRegistraties.filter(
          (registratie) => registratie.status === "AFGEKEURD",
        );
        const berekening = berekenGewerkteUren(begintijd, eindtijd);
        for (const registratie of bestaandeRegistraties) {
          await tx.urenRegistratie.update({
            where: { id: registratie.id },
            data: {
              ...(afgekeurdeRegistraties.some((afgekeurd) => afgekeurd.id === registratie.id)
                ? {
                    datum: lokaleKalenderDatumUTC(begintijd),
                    werkelijkeBegintijd: begintijd,
                    werkelijkeEindtijd: eindtijd,
                    pauzeMinuten: berekening.pauzeMinuten,
                    gewerkteUren: berekening.gewerkteUren,
                  }
                : {}),
              status: "TE_CONTROLEREN",
              gecontroleerdDoorId: null,
              gecontroleerdOp: null,
            },
          });
        }
      }

      const conceptPeriodeIds = verloningsPeriodes
        .filter((periode) => periode.status === "AANGEMAAKT")
        .map((periode) => periode.id);
      if (conceptPeriodeIds.length > 0) {
        await tx.verloningsRegel.deleteMany({
          where: { verloningsPeriodeId: { in: conceptPeriodeIds } },
        });
      }

      return dienst;
    });

    return NextResponse.json(bijgewerkt);
  } catch (error) {
    console.error("Fout bij wijzigen dienst:", error);
    return NextResponse.json(
      { fout: "De dienst kon niet worden gewijzigd." },
      { status: 500 },
    );
  }
}

/*
 * ============================================================
 * DIENST VERWIJDEREN
 * ============================================================
 *
 * Verwijderen is alleen toegestaan voor de eigenaar met
 * planning.delete-rechten op de vestiging van de dienst.
 * Gerelateerde diensttags, bezettingen en ruilverzoeken worden
 * door de ingestelde Prisma-relaties mee verwijderd.
 */
export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const dienst = await haalDienstOp(id);

    if (!dienst) {
      return NextResponse.json(
        { fout: "Dienst niet gevonden." },
        { status: 404 },
      );
    }

    if (dienst.week.status === "AFGESLOTEN") {
      return NextResponse.json(
        { fout: "Deze dienst hoort bij een afgesloten planningweek en kan niet meer worden verwijderd." },
        { status: 409 },
      );
    }

    const organisatieId = await haalOrganisatieIdOp(
      dienst.week.vestigingId,
    );
    const eigenaar = await isEigenaar(organisatieId);

    if (!eigenaar) {
      return NextResponse.json(
        { fout: "Alleen de eigenaar kan een dienst verwijderen." },
        { status: 403 },
      );
    }

    const toegang = await hasPermissionForVestiging(
      permissions.planning.delete,
      dienst.week.vestigingId,
    );

    if (!toegang) {
      return NextResponse.json(
        { fout: "Je hebt geen rechten om deze dienst te verwijderen." },
        { status: 403 },
      );
    }

    // Uren die nog ter controle staan of expliciet zijn afgekeurd mogen
    // samen met de dienst worden verwijderd. Definitieve uren en perioden
    // die al klaarstaan of verwerkt zijn blijven beschermd.
    const bezettingen = await prisma.dienstBezetting.findMany({
      where: { dienstId: id },
      select: {
        status: true,
        urenregistratie: {
          select: { id: true, status: true, datum: true },
        },
      },
    });

    const registraties = bezettingen
      .map((bezetting) => bezetting.urenregistratie)
      .filter((registratie): registratie is NonNullable<typeof registratie> => registratie !== null);

    const heeftGewerkteDienstZonderRegistratie = bezettingen.some(
      (bezetting) => bezetting.status === "GEWERKT" && bezetting.urenregistratie === null,
    );
    const heeftNietConceptRegistratie = registraties.some(
      (registratie) => !["TE_CONTROLEREN", "AFGEKEURD"].includes(registratie.status),
    );

    if (heeftGewerkteDienstZonderRegistratie || heeftNietConceptRegistratie) {
      return NextResponse.json(
        {
          fout: "Deze dienst heeft uren die al definitief zijn, zijn afgekeurd of niet veilig automatisch kunnen worden verwijderd. Controleer eerst de urenregistratie.",
          code: "DIENST_HEEFT_DEFINITIEVE_UREN",
        },
        { status: 409 },
      );
    }

    const maandSleutels = Array.from(new Map(
      registraties.map((registratie) => {
        const jaar = registratie.datum.getUTCFullYear();
        const maand = registratie.datum.getUTCMonth() + 1;
        return [`${jaar}-${maand}`, { jaar, maand }];
      }),
    ).values());

    const verloningsPeriodes = maandSleutels.length > 0
      ? await prisma.verloningsPeriode.findMany({
          where: {
            OR: maandSleutels.map(({ jaar, maand }) => ({ jaar, maand })),
          },
          select: { jaar: true, maand: true, status: true },
        })
      : [];

    if (verloningsPeriodes.some((periode) => periode.status !== "AANGEMAAKT")) {
      return NextResponse.json(
        {
          fout: "Deze dienst valt in een verloningsperiode die al klaarstaat of verwerkt is. Pas eerst de verloning aan voordat je de dienst verwijdert.",
          code: "VERLONINGSPERIODE_NIET_WIJZIGBAAR",
        },
        { status: 409 },
      );
    }

    // Prisma verwijdert de gekoppelde, nog niet definitieve registraties
    // via de bestaande cascade-relatie in dezelfde databasebewerking.
    await prisma.dienst.delete({
      where: { id },
    });

    return NextResponse.json({ succes: true, verwijderdId: id });
  } catch (error) {
    console.error("Fout bij verwijderen dienst:", error);
    return NextResponse.json(
      { fout: "De dienst kon niet worden verwijderd." },
      { status: 500 },
    );
  }
}
