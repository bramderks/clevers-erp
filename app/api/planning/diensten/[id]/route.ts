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
  });
}

}