import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ error: "Je moet ingelogd zijn." }, { status: 401 });

  const taken: Array<{
    id: string;
    type: string;
    categorie: string;
    titel: string;
    omschrijving: string;
    actie: string;
    aangemaaktOp: Date;
    gegevens: Record<string, unknown>;
  }> = [];

  const eigenaarRelaties = gebruiker.organisaties.filter(
    (r) =>
      r.actief &&
      r.organisatie.actief &&
      r.rol.naam.trim().toLowerCase() === "eigenaar",
  );
  const organisatieIds = eigenaarRelaties.map((r) => r.organisatieId);

  if (organisatieIds.length) {
    const geregistreerdeMedewerkers = await prisma.medewerker.findMany({
      where: {
        actief: false,
        status: {
          module: "MEDEWERKER",
          code: "AANGEMELD",
        },
        systeemGebruiker: {
          isNot: null,
        },
      },
      include: {
        systeemGebruiker: { select: { email: true } },
        status: true,
        vestigingen: {
          include: { vestiging: true },
        },
      },
      orderBy: { aangemaaktOp: "asc" },
    });

    const gebruikteUitnodigingen = await prisma.medewerkerUitnodiging.findMany({
      where: {
        organisatieId: { in: organisatieIds },
        gebruiktOp: { not: null },
      },
      select: {
        email: true,
        gebruiktOp: true,
      },
    });

    const geregistreerdeEmails = new Set(
      gebruikteUitnodigingen.map((i) => i.email.trim().toLowerCase()),
    );

    for (const m of geregistreerdeMedewerkers) {
      const email = m.systeemGebruiker?.email?.trim().toLowerCase();
      if (!email || !geregistreerdeEmails.has(email)) continue;

      const uitnodiging = gebruikteUitnodigingen.find(
        (i) => i.email.trim().toLowerCase() === email,
      );

      taken.push({
        id: `registratie-${m.id}`,
        type: "MEDEWERKER_GEREGISTREERD",
        categorie: "Medewerkers",
        titel: "Nieuwe medewerker heeft zich geregistreerd",
        omschrijving: `${m.voornaam} ${m.achternaam} · De medewerker heeft het account geactiveerd en wacht op toewijzing van een rol.`,
        actie: "MEDEWERKER_ROL_TOEWIJZEN",
        aangemaaktOp: uitnodiging?.gebruiktOp ?? m.aangemaaktOp,
        gegevens: {
          href: `/medewerkers/${m.id}?tab=algemeen&edit=1`,
          medewerkerId: m.id,
        },
      });
    }

    const actieveMedewerkers = await prisma.medewerker.findMany({
      where: {
        actief: true,
        vestigingen: {
          some: {
            vestiging: {
              organisatieId: { in: organisatieIds },
              actief: true,
            },
          },
        },
      },
      include: {
        rollen: true,
        vestigingen: { include: { vestiging: true } },
      },
    });

    for (const m of actieveMedewerkers) {
      const dossierKlaar = Boolean(
        m.personeelsnummer &&
          m.contractType &&
          m.datumInDienst &&
          m.uurloon !== null &&
          m.vestigingen.length > 0,
      );

      if (!dossierKlaar) {
        taken.push({
          id: `dossier-${m.id}`,
          type: "MEDEWERKER_DOSSIER_INVULLEN",
          categorie: "Medewerkers",
          titel: "Dossier medewerker invullen",
          omschrijving: `${m.voornaam} ${m.achternaam} · Vul het medewerkerdossier verder aan.`,
          actie: "MEDEWERKER_DOSSIER_INVULLEN",
          aangemaaktOp: m.aangemaaktOp,
          gegevens: {
            href: `/medewerkers/${m.id}`,
            medewerkerId: m.id,
          },
        });
      }
    }
  }

  if (gebruiker.medewerker?.id) {
    const medewerkerId = gebruiker.medewerker.id;
    const relaties = await prisma.medewerkerVestiging.findMany({
      where: {
        medewerkerId,
        vestiging: { actief: true },
      },
      select: {
        vestigingId: true,
        vestiging: { select: { naam: true } },
      },
    });

    for (const relatie of relaties) {
      const weken = await prisma.week.findMany({
        where: {
          vestigingId: relatie.vestigingId,
          status: { in: ["OPEN", "IN_PLANNING"] },
          OR: [
            { jaar: { gt: new Date().getFullYear() } },
            {
              jaar: new Date().getFullYear(),
              weeknummer: {
                gte: Math.ceil(
                  (Date.now() -
                    new Date(new Date().getFullYear(), 0, 1).getTime()) /
                    604800000,
                ),
              },
            },
          ],
        },
        orderBy: [
          { jaar: "asc" },
          { weeknummer: "asc" },
        ],
        select: {
          id: true,
          jaar: true,
          weeknummer: true,
          beschikbaarheidDeadline: true,
        },
      });

      const ontbrekend = [];
      for (const week of weken) {
        if (week.beschikbaarheidDeadline && week.beschikbaarheidDeadline < new Date()) {
          continue;
        }

        const count = await prisma.beschikbaarheid.count({
          where: {
            medewerkerId,
            weekId: week.id,
          },
        });

        if (!count) ontbrekend.push(week);
      }

      if (ontbrekend.length) {
        taken.push({
          id: `beschikbaarheid-seizoen-${relatie.vestigingId}`,
          type: "BESCHIKBAARHEID_RESTEREND_SEIZOEN",
          categorie: "Beschikbaarheid",
          titel: "Beschikbaarheid doorgeven",
          omschrijving: `${relatie.vestiging.naam} · Geef je beschikbaarheid door voor de resterende weken van het seizoen.`,
          actie: "BESCHIKBAARHEID_RESTEREND_SEIZOEN",
          aangemaaktOp: new Date(),
          gegevens: {
            href: "/app/beschikbaarheid",
            vestigingId: relatie.vestigingId,
            weken: ontbrekend.map((w) => `${w.jaar}-W${w.weeknummer}`),
          },
        });
      }
    }
  }

  return NextResponse.json(taken);
}
