import { NextResponse } from "next/server";

import {
  getCurrentUser,
  hasPermissionForVestiging,
  isEigenaar,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { lokaleDagGrenzen } from "@/lib/planning/tijd";

const TOEGESTANE_STATUSSEN = [
  "OPEN",
  "GEPLAND",
  "BEVESTIGD",
  "AFGEZEGD",
  "GEWERKT",
  "ZIEK_GEMELD",
] as const;

type BezettingStatus =
  (typeof TOEGESTANE_STATUSSEN)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function haalBezettingOp(
  id: string,
) {
  return prisma.dienstBezetting.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      dienstId: true,
      medewerkerId: true,
      status: true,
      statusVoorZiekmelding: true,
      ziekgemeldOp: true,

      dienst: {
        select: {
          datum: true,
          begintijd: true,
          eindtijd: true,
          week: {
            select: {
              status: true,
              vestigingId: true,
              vestiging: {
                select: {
                  id: true,
                  naam: true,
                  organisatieId: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const gebruiker = await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          fout: "Je moet ingelogd zijn.",
        },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const bestaandeBezetting =
      await haalBezettingOp(id);

    if (!bestaandeBezetting) {
      return NextResponse.json(
        {
          fout: "Bezetting niet gevonden.",
        },
        { status: 404 },
      );
    }

    if (bestaandeBezetting.dienst.week.status === "AFGESLOTEN") {
      return NextResponse.json(
        { fout: "De bezetting van een afgesloten planningweek kan niet worden gewijzigd." },
        { status: 409 },
      );
    }

    const vestigingId =
      bestaandeBezetting.dienst.week.vestigingId;

    const organisatieId =
      bestaandeBezetting.dienst.week.vestiging
        .organisatieId;

    /*
     * ============================================================
     * MEDEWERKER — EIGEN DIENST BEVESTIGEN
     * ============================================================
     *
     * Een medewerker mag uitsluitend zijn eigen geplande dienst
     * van GEPLAND naar BEVESTIGD zetten.
     *
     * Andere velden of statuswijzigingen blijven uitsluitend voor
     * de Eigenaar.
     */

    const eigenMedewerkerId =
      gebruiker.medewerker?.id ?? null;

    if (eigenMedewerkerId !== null) {
      const isEigenBezetting =
        bestaandeBezetting.medewerkerId ===
        eigenMedewerkerId;

      const isUitsluitendBevestigen =
        body.medewerkerId === undefined &&
        body.status === "BEVESTIGD" &&
        Object.keys(body).every(
          (key) => key === "status",
        );

      if (
        isEigenBezetting &&
        isUitsluitendBevestigen
      ) {
        if (
          bestaandeBezetting.status !==
          "GEPLAND"
        ) {
          return NextResponse.json(
            {
              fout:
                "Alleen een geplande dienst kan door de medewerker worden bevestigd.",
            },
            { status: 400 },
          );
        }

        const bevestigdeBezetting =
          await prisma.dienstBezetting.update({
            where: {
              id,
            },
            data: {
              status: "BEVESTIGD",
            },
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
          });

        return NextResponse.json(
          bevestigdeBezetting,
        );
      }
    }

    /*
     * ============================================================
     * EIGENAAR — VOLLEDIG BEHEER
     * ============================================================
     *
     * Alleen de Eigenaar mag de bezetting daadwerkelijk beheren.
     * Teamleider en Medewerker mogen geen andere bezettingsgegevens
     * wijzigen.
     */

    const eigenaar = await isEigenaar(
      organisatieId,
    );

    if (!eigenaar) {
      return NextResponse.json(
        {
          fout:
            "Alleen de eigenaar kan de bezetting wijzigen.",
        },
        { status: 403 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.update,
        vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om de bezetting te wijzigen.",
        },
        { status: 403 },
      );
    }

    if (
      bestaandeBezetting.status ===
      "GEWERKT"
    ) {
      return NextResponse.json(
        {
          fout:
            "Deze bezetting kan niet meer worden gewijzigd omdat de dienst als gewerkt is geregistreerd.",
        },
        { status: 400 },
      );
    }

    const data: {
      medewerkerId?: string | null;
      status?: BezettingStatus;
      statusVoorZiekmelding?: string | null;
      ziekgemeldOp?: Date | null;
      ziekmeldingId?: string | null;
    } = {};

    if (body.actie === "HERSTEL_ZIEKMELDING") {
      if (bestaandeBezetting.status !== "ZIEK_GEMELD") {
        return NextResponse.json({ fout: "Deze dienst is niet als ziekgemeld gemarkeerd." }, { status: 409 });
      }
      data.status = (bestaandeBezetting.statusVoorZiekmelding as BezettingStatus | null) ?? "GEPLAND";
      data.statusVoorZiekmelding = null;
      data.ziekmeldingId = null;
    }

    if (
      body.medewerkerId !== undefined
    ) {
      if (
        body.medewerkerId !== null &&
        typeof body.medewerkerId !== "string"
      ) {
        return NextResponse.json(
          {
            fout: "medewerkerId is ongeldig.",
          },
          { status: 400 },
        );
      }

      if (body.medewerkerId) {
        const medewerker =
          await prisma.medewerker.findUnique({
            where: {
              id: body.medewerkerId,
            },
            select: {
              id: true,
              actief: true,
              vestigingen: {
                where: {
                  vestigingId,
                },
                select: {
                  id: true,
                },
              },
            },
          });

        if (!medewerker) {
          return NextResponse.json(
            {
              fout: "Medewerker niet gevonden.",
            },
            { status: 404 },
          );
        }

        if (!medewerker.actief) {
          return NextResponse.json(
            {
              fout:
                "Een inactieve medewerker kan niet worden ingepland.",
            },
            { status: 400 },
          );
        }

        if (
          medewerker.vestigingen.length ===
          0
        ) {
          return NextResponse.json(
            {
              fout:
                "Deze medewerker hoort niet bij deze vestiging.",
            },
            { status: 400 },
          );
        }

        const dubbeleBezetting =
          await prisma.dienstBezetting.findFirst({
            where: {
              dienstId:
                bestaandeBezetting.dienstId,
              medewerkerId:
                body.medewerkerId,
              id: {
                not: id,
              },
            },
            select: {
              id: true,
            },
          });

        if (dubbeleBezetting) {
          return NextResponse.json(
            {
              fout:
                "Deze medewerker staat al op deze dienst.",
            },
            { status: 409 },
          );
        }

        /*
         * Houd bij het wijzigen van een bezetting dezelfde
         * vestigingsoverlapregel aan als bij het toevoegen:
         * tussen verschillende vestigingen is één uur reistijd nodig.
         */
        if (body.medewerkerId !== bestaandeBezetting.medewerkerId) {
          const dagGrenzen = lokaleDagGrenzen(
            bestaandeBezetting.dienst.begintijd,
          );
          const andereVestigingBezettingen =
            await prisma.dienstBezetting.findMany({
              where: {
                medewerkerId: body.medewerkerId,
                status: { not: "AFGEZEGD" },
                dienst: {
                  id: { not: bestaandeBezetting.dienstId },
                  begintijd: { gte: dagGrenzen.start, lt: dagGrenzen.einde },
                  week: {
                    vestiging: {
                      organisatieId,
                    },
                  },
                },
              },
              select: {
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

          const conflict = andereVestigingBezettingen.find((bezetting) => {
            if (
              bezetting.dienst.week.vestiging.id === vestigingId
            ) {
              return false;
            }

            const buffer = 60 * 60 * 1000;
            return (
              bestaandeBezetting.dienst.begintijd.getTime() <
                bezetting.dienst.eindtijd.getTime() + buffer &&
              bestaandeBezetting.dienst.eindtijd.getTime() >
                bezetting.dienst.begintijd.getTime() - buffer
            );
          });

          if (conflict) {
            return NextResponse.json(
              {
                fout: `Deze medewerker heeft op dezelfde dag al een dienst in ${conflict.dienst.week.vestiging.naam}. Tussen vestigingen is 1 uur reistijd gereserveerd.`,
                code: "ANDERE_VESTIGING_ZELFDE_DAG",
              },
              { status: 409 },
            );
          }
        }
      }

      data.medewerkerId =
        body.medewerkerId;
    }

    if (body.status !== undefined) {
      if (
        typeof body.status !== "string" ||
        !TOEGESTANE_STATUSSEN.includes(
          body.status as BezettingStatus,
        )
      ) {
        return NextResponse.json(
          {
            fout:
              "Ongeldige bezettingsstatus.",
          },
          { status: 400 },
        );
      }

      data.status = body.status as BezettingStatus;
      if (body.status === "ZIEK_GEMELD" && bestaandeBezetting.status !== "ZIEK_GEMELD") {
        data.statusVoorZiekmelding = bestaandeBezetting.status;
        data.ziekgemeldOp = new Date();
      } else if (body.status !== "ZIEK_GEMELD" && bestaandeBezetting.status === "ZIEK_GEMELD") {
        data.statusVoorZiekmelding = null;
        data.ziekmeldingId = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          fout:
            "Er is geen geldige wijziging opgegeven.",
        },
        { status: 400 },
      );
    }

    const bezetting =
      await prisma.dienstBezetting.update({
        where: {
          id,
        },
        data,
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
      });

    if (data.status === "ZIEK_GEMELD") {
      await prisma.ruilverzoek.updateMany({
        where: {
          dienstBezettingId: id,
          status: { in: ["AANGEVRAAGD", "WACHT_OP_EIGENAAR"] },
        },
        data: { status: "GEANNULEERD" },
      });
      await prisma.dienstBezetting.update({
        where: { id },
        data: { isRuilAangeboden: false },
      });
    }

    return NextResponse.json(
      bezetting,
    );
  } catch (error) {
    console.error(
      "Fout bij wijzigen bezetting:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De bezetting kon niet worden gewijzigd.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const gebruiker = await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          fout: "Je moet ingelogd zijn.",
        },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    const bestaandeBezetting =
      await haalBezettingOp(id);

    if (!bestaandeBezetting) {
      return NextResponse.json(
        {
          fout: "Bezetting niet gevonden.",
        },
        { status: 404 },
      );
    }

    if (bestaandeBezetting.dienst.week.status === "AFGESLOTEN") {
      return NextResponse.json(
        { fout: "De bezetting van een afgesloten planningweek kan niet worden gewijzigd." },
        { status: 409 },
      );
    }

    const vestigingId =
      bestaandeBezetting.dienst.week.vestigingId;

    const organisatieId =
      bestaandeBezetting.dienst.week.vestiging
        .organisatieId;

    const eigenaar = await isEigenaar(
      organisatieId,
    );

    if (!eigenaar) {
      return NextResponse.json(
        {
          fout:
            "Alleen de eigenaar kan de bezetting verwijderen.",
        },
        { status: 403 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.update,
        vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om de bezetting te verwijderen.",
        },
        { status: 403 },
      );
    }

    if (
      bestaandeBezetting.status ===
      "GEWERKT"
    ) {
      return NextResponse.json(
        {
          fout:
            "Deze bezetting kan niet worden verwijderd omdat de dienst als gewerkt is geregistreerd.",
        },
        { status: 400 },
      );
    }

    const urenregistratie = await prisma.urenRegistratie.findUnique({
      where: { dienstBezettingId: id },
      select: { id: true },
    });

    if (urenregistratie) {
      return NextResponse.json(
        {
          fout: "Deze bezetting kan niet worden verwijderd omdat er een urenregistratie aan gekoppeld is.",
          code: "BEZETTING_HEEFT_URENREGISTRATIE",
        },
        { status: 409 },
      );
    }

    await prisma.dienstBezetting.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      succes: true,
    });
  } catch (error) {
    console.error(
      "Fout bij verwijderen bezetting:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De bezetting kon niet worden verwijderd.",
      },
      { status: 500 },
    );
  }
}
