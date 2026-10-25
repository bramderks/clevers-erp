import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaarVoorMedewerker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const gebruiker = await getCurrentUser();
    if (!gebruiker) {
      return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
    }

    const organisatieIds = [
      ...new Set(
        gebruiker.organisaties
          .filter(
            (relatie) =>
              relatie.actief &&
              relatie.organisatie.actief &&
              ["eigenaar", "super admin"].includes(relatie.rol.naam.trim().toLowerCase()),
          )
          .map((relatie) => relatie.organisatieId),
      ),
    ];

    if (organisatieIds.length === 0) {
      return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });
    }

    const meldingen = await prisma.ziekmelding.findMany({
      where: {
        status: "ZIEK",
        medewerker: {
          vestigingen: {
            some: {
              vestiging: {
                organisatieId: { in: organisatieIds },
                actief: true,
                organisatie: { actief: true },
              },
            },
          },
        },
      },
      orderBy: { ziekVanaf: "desc" },
      select: {
        id: true,
        medewerkerId: true,
        ziekVanaf: true,
        verwachtHersteldOp: true,
        hersteldOp: true,
        opmerking: true,
        status: true,
        medewerker: {
          select: {
            id: true,
            voornaam: true,
            achternaam: true,
            vestigingen: {
              select: {
                vestiging: {
                  select: {
                    organisatieId: true,
                    actief: true,
                    organisatie: { select: { actief: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const zichtbaar = meldingen
      .filter((melding) => {
        const organisatieVanMedewerker = [
          ...new Set(
            melding.medewerker.vestigingen
              .filter((relatie) => relatie.vestiging.actief && relatie.vestiging.organisatie.actief)
              .map((relatie) => relatie.vestiging.organisatieId),
          ),
        ];
        return (
          organisatieVanMedewerker.length > 0 &&
          organisatieVanMedewerker.every((id) => organisatieIds.includes(id))
        );
      })
      .map(({ medewerker, ...melding }) => ({
        ...melding,
        medewerker: {
          id: medewerker.id,
          voornaam: medewerker.voornaam,
          achternaam: medewerker.achternaam,
        },
      }));

    return NextResponse.json(zichtbaar, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Ziekmeldingen ophalen mislukt:", error);
    return NextResponse.json({ fout: "Ziekmeldingen konden niet worden opgehaald." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const gebruiker = await getCurrentUser();
    if (!gebruiker) {
      return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
    }

    let body: { id?: unknown; hersteldOp?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ fout: "De aanvraag bevat geen geldige JSON." }, { status: 400 });
    }

    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ fout: "Ziekmelding ontbreekt." }, { status: 400 });
    }

    const melding = await prisma.ziekmelding.findFirst({
      where: { id, status: "ZIEK" },
      select: { id: true, medewerkerId: true },
    });

    if (!melding) {
      return NextResponse.json({ fout: "Actieve ziekmelding niet gevonden." }, { status: 404 });
    }

    if (!(await isEigenaarVoorMedewerker(melding.medewerkerId))) {
      return NextResponse.json({ fout: "Alleen een eigenaar van de organisaties van deze medewerker mag de ziekmelding afsluiten." }, { status: 403 });
    }

    let hersteldOp = new Date();
    if (body.hersteldOp !== undefined && body.hersteldOp !== null && body.hersteldOp !== "") {
      if (typeof body.hersteldOp !== "string") {
        return NextResponse.json({ fout: "Hersteldatum is ongeldig." }, { status: 400 });
      }
      hersteldOp = new Date(body.hersteldOp);
      if (Number.isNaN(hersteldOp.getTime())) {
        return NextResponse.json({ fout: "Hersteldatum is ongeldig." }, { status: 400 });
      }
    }

    const resultaat = await prisma.$transaction(async (tx) => {
      const bijgewerkt = await tx.ziekmelding.update({
        where: { id: melding.id },
        data: { status: "HERSTELD", hersteldOp },
      });

      await tx.auditLog.create({
        data: {
          systeemGebruikerId: gebruiker.id,
          module: "MEDEWERKERS",
          actie: "ZIEKMELDING_HERSTELD",
          recordId: bijgewerkt.id,
          details: { medewerkerId: bijgewerkt.medewerkerId },
        },
      });

      return bijgewerkt;
    });

    return NextResponse.json({ succes: true, melding: resultaat }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Ziekmelding herstellen mislukt:", error);
    return NextResponse.json({ fout: "De ziekmelding kon niet worden afgesloten." }, { status: 500 });
  }
}
