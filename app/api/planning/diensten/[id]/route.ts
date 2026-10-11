import { NextResponse } from "next/server";

import {
  getCurrentUser,
  hasPermissionForVestiging,
  isEigenaar,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { kalenderDatumUTC, lokaleDatumSleutel, formatDienstTijd, nederlandseDatumTijd, lokaleTijdMinuten } from "@/lib/planning/tijd";

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

      week: {
        select: {
          id: true,
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

async function haalDienstVolledigOp(
  id: string,
) {
  return prisma.dienst.findUnique({
    where: {
      id,
    },

    include: {
      week: {
        select: {
          id: true,
          vestigingId: true,

          vestiging: {
            select: {
              id: true,
              naam: true,
            },
          },
        },
      },

      tags: {
        include: {
          tag: true,
        },

        orderBy: {
          tag: {
            volgorde: "asc",
          },
        },
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

        orderBy: {
          aangemaaktOp: "asc",
        },
      },
    },
  });
}

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

function maakDatumMetTijd(datum: Date, tijd: Date): Date {
  return nederlandseDatumTijd(lokaleDatumSleutel(datum), formatDienstTijd(tijd));
}

function kalenderDatumVanLokaleDienst(begintijd: Date): Date {
  return kalenderDatumUTC(lokaleDatumSleutel(begintijd));
}

function kalenderDatumIsGelijk(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

async function normaliseerKalenderDatum(dienst: {
  id: string;
  datum: Date;
  begintijd: Date;
}) {
  const juisteDatum = kalenderDatumVanLokaleDienst(dienst.begintijd);
  if (kalenderDatumIsGelijk(dienst.datum, juisteDatum)) return dienst;
  return prisma.dienst.update({
    where: { id: dienst.id },
    data: { datum: juisteDatum },
  });}


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
      const andereDiensten = await prisma.dienstBezetting.findMany({
        where: {
          medewerkerId: { in: medewerkerIds },
          status: { not: "AFGEZEGD" },
          dienst: {
            id: { not: id },
            datum: kalenderDatumUTC(lokaleDatumSleutel(datum)),
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

    const bijgewerkt = await prisma.dienst.update({
      where: { id },
      data: {
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
