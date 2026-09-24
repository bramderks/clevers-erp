import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ChecklistItem = {
  key: string;
  label: string;
  klaar: boolean;
};

export async function GET() {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) {
    return NextResponse.json(
      { error: "Je moet ingelogd zijn." },
      { status: 401 },
    );
  }

  const taken: Array<{
    id: string;
    type: string;
    categorie: string;
    titel: string;
    omschrijving: string;
    actie: string;
    aangemaaktOp: Date;
    gegevens: {
      href?: string;
      medewerkerId?: string;
      checklist?: ChecklistItem[];
      diensten?: Array<{
        id: string;
        datum: Date;
        begintijd: Date;
        eindtijd: Date;
        vestigingNaam: string;
      }>;
    };
  }> = [];

  const eigenaarRelaties = gebruiker.organisaties.filter(
    (r) =>
      r.actief &&
      r.organisatie.actief &&
      ["eigenaar", "super admin"].includes(r.rol.naam.trim().toLowerCase()),
  );
  const organisatieIds = eigenaarRelaties.map((r) => r.organisatieId);

  if (organisatieIds.length) {
    const gebruikteUitnodigingen = await prisma.medewerkerUitnodiging.findMany({
      where: {
        organisatieId: { in: organisatieIds },
        gebruiktOp: { not: null },
      },
      select: { email: true, gebruiktOp: true },
    });

    const geregistreerdeEmails = new Set(
      gebruikteUitnodigingen.map((i) => i.email.trim().toLowerCase()),
    );

    const gebruikteEmails = Array.from(geregistreerdeEmails);

    /*
     * Een nieuw geactiveerd account is bewust nog INACTIEF.
     * De medewerker heeft op dat moment nog geen vestiging of rol
     * en kan daardoor niet via de normale vestigingsrelaties worden
     * gevonden. Koppel daarom de workflow expliciet aan de gebruikte
     * uitnodiging/e-mail van de organisatie.
     */
    const geregistreerdeMedewerkers =
      gebruikteEmails.length > 0
        ? await prisma.medewerker.findMany({
            where: {
              actief: false,
              email: {
                in: gebruikteEmails,
              },
              systeemGebruiker: {
                isNot: null,
              },
            },
            include: {
              systeemGebruiker: {
                select: {
                  email: true,
                },
              },
              status: true,
              vestigingen: {
                include: {
                  vestiging: true,
                },
              },
              rollen: {
                include: {
                  rol: true,
                },
              },
              tags: {
                include: {
                  tag: true,
                },
              },
            },
            orderBy: {
              aangemaaktOp: "asc",
            },
          })
        : [];

    for (const m of geregistreerdeMedewerkers) {
      const email =
        m.email.trim().toLowerCase();

      const uitnodiging =
        gebruikteUitnodigingen.find(
          (i) =>
            i.email.trim().toLowerCase() ===
            email,
        );

      const checklist: ChecklistItem[] = [
        {
          key: "rol",
          label: "Rol toegewezen",
          klaar: m.rollen.length > 0,
        },
        {
          key: "vestiging",
          label: "Vestiging gekoppeld",
          klaar: m.vestigingen.some(
            (v) => v.vestiging.actief,
          ),
        },
        {
          key: "contract",
          label: "Contracttype ingevuld",
          klaar: Boolean(m.contractType),
        },
        {
          key: "datumInDienst",
          label: "Datum in dienst ingevuld",
          klaar: Boolean(m.datumInDienst),
        },
        {
          key: "uurloon",
          label: "Uurloon ingevuld",
          klaar: m.uurloon !== null,
        },
        {
          key: "planningstags",
          label: "Planningstags toegewezen",
          klaar: m.tags.length > 0,
        },
      ];

      const rolOntbreekt =
        !checklist.find(
          (item) => item.key === "rol",
        )?.klaar;

      const dossierKlaar =
        checklist
          .filter(
            (item) => item.key !== "rol",
          )
          .every(
            (item) => item.klaar,
          );

      /*
       * Een zojuist geregistreerde medewerker moet altijd
       * minimaal als roltaak zichtbaar zijn zolang de medewerker
       * nog inactief is.
       */
      if (rolOntbreekt) {
        taken.push({
          id: `rol-${m.id}`,
          type: "MEDEWERKER_ROL_TOEWIJZEN",
          categorie: "Medewerkers",
          titel: "Rol aan medewerker toewijzen",
          omschrijving:
            `${m.voornaam} ${m.achternaam} · De medewerker heeft zich geregistreerd en wacht op toewijzing van een rol.`,
          actie: "MEDEWERKER_ROL_TOEWIJZEN",
          aangemaaktOp:
            uitnodiging?.gebruiktOp ??
            m.aangemaaktOp,
          gegevens: {
            href: `/medewerkers/${m.id}?tab=algemeen&edit=1`,
            medewerkerId: m.id,
            checklist,
          },
        });
      }

      if (!dossierKlaar) {
        const eersteOpenItem =
          checklist.find(
            (item) =>
              item.key !== "rol" &&
              !item.klaar,
          );

        taken.push({
          id: `dossier-${m.id}`,
          type: "MEDEWERKER_DOSSIER_INVULLEN",
          categorie: "Medewerkers",
          titel: "Medewerkerprofiel aanvullen",
          omschrijving:
            `${m.voornaam} ${m.achternaam} · ${eersteOpenItem?.label ?? "Profiel verder aanvullen"}.`,
          actie: "MEDEWERKER_DOSSIER_INVULLEN",
          aangemaaktOp:
            uitnodiging?.gebruiktOp ??
            m.aangemaaktOp,
          gegevens: {
            href: `/medewerkers/${m.id}?tab=algemeen`,
            medewerkerId: m.id,
            checklist,
          },
        });
      }
    }

    const actieveMedewerkers = await prisma.medewerker.findMany({
      where: {
        actief: true,
        OR: [
          {
            vestigingen: {
              some: {
                vestiging: {
                  organisatieId: { in: organisatieIds },
                  actief: true,
                },
              },
            },
          },
          ...(geregistreerdeEmails.size
            ? [{ email: { in: Array.from(geregistreerdeEmails) } }]
            : []),
        ],
      },
      include: {
        rollen: { include: { rol: true } },
        tags: { include: { tag: true } },
        vestigingen: { include: { vestiging: true } },
        systeemGebruiker: { select: { actief: true } },
      },
    });

    for (const m of actieveMedewerkers) {
      const checklist: ChecklistItem[] = [
        {
          key: "rol",
          label: "Rol toegewezen",
          klaar: m.rollen.length > 0,
        },
        {
          key: "vestiging",
          label: "Vestiging gekoppeld",
          klaar: m.vestigingen.some((v) => v.vestiging.actief),
        },
        {
          key: "contract",
          label: "Contracttype ingevuld",
          klaar: Boolean(m.contractType),
        },
        {
          key: "datumInDienst",
          label: "Datum in dienst ingevuld",
          klaar: Boolean(m.datumInDienst),
        },
        {
          key: "uurloon",
          label: "Uurloon ingevuld",
          klaar: m.uurloon !== null,
        },
        {
          key: "planningstags",
          label: "Planningstags toegewezen",
          klaar: m.tags.length > 0,
        },
      ];

      const rolOntbreekt = !checklist.find((item) => item.key === "rol")?.klaar;
      const dossierKlaar = checklist
        .filter((item) => item.key !== "rol")
        .every((item) => item.klaar);

      if (rolOntbreekt) {
        taken.push({
          id: `rol-${m.id}`,
          type: "MEDEWERKER_ROL_TOEWIJZEN",
          categorie: "Medewerkers",
          titel: "Rol aan medewerker toewijzen",
          omschrijving: `${m.voornaam} ${m.achternaam} · Rol is nog niet toegewezen.`,
          actie: "MEDEWERKER_ROL_TOEWIJZEN",
          aangemaaktOp: m.aangemaaktOp,
          gegevens: {
            href: `/medewerkers/${m.id}?tab=algemeen&edit=1`,
            medewerkerId: m.id,
            checklist,
          },
        });
      }

      if (!dossierKlaar) {
        const eersteOpenItem = checklist.find(
          (item) => item.key !== "rol" && !item.klaar,
        );
        taken.push({
          id: `dossier-${m.id}`,
          type: "MEDEWERKER_DOSSIER_INVULLEN",
          categorie: "Medewerkers",
          titel: "Medewerkerprofiel aanvullen",
          omschrijving: `${m.voornaam} ${m.achternaam} · ${eersteOpenItem?.label ?? "Profiel verder aanvullen"}.`,
          actie: "MEDEWERKER_DOSSIER_INVULLEN",
          aangemaaktOp: m.aangemaaktOp,
          gegevens: {
            href: `/medewerkers/${m.id}?tab=algemeen`,
            medewerkerId: m.id,
            checklist,
          },
        });
      }
    }

    const eigenaarMedewerkerId = gebruiker.medewerker?.id;

    if (eigenaarMedewerkerId) {
      const vandaag = new Date();
      const vandaagBegin = new Date(
        vandaag.getFullYear(),
        vandaag.getMonth(),
        vandaag.getDate(),
      );

      const diensten = await prisma.dienstBezetting.findMany({
        where: {
          medewerkerId: eigenaarMedewerkerId,
          status: { in: ["GEPLAND", "BEVESTIGD"] },
          dienst: {
            datum: { gte: vandaagBegin },
            week: {
              vestiging: {
                organisatieId: { in: organisatieIds },
                actief: true,
              },
            },
          },
        },
        select: {
          id: true,
          dienst: {
            select: {
              id: true,
              datum: true,
              begintijd: true,
              eindtijd: true,
              week: {
                select: {
                  vestiging: { select: { naam: true } },
                },
              },
            },
          },
        },
        orderBy: { dienst: { datum: "asc" } },
        take: 20,
      });

      if (diensten.length) {
        taken.push({
          id: "eigenaar-aankomende-diensten",
          type: "EIGENAAR_AANKOMENDE_DIENSTEN",
          categorie: "Planning",
          titel: "Mijn aankomende diensten",
          omschrijving: "Je eigen ingeplande diensten als eigenaar.",
          actie: "EIGENAAR_AANKOMENDE_DIENSTEN",
          aangemaaktOp: new Date(),
          gegevens: {
            medewerkerId: eigenaarMedewerkerId,
            diensten: diensten.map((bezetting) => ({
              id: bezetting.dienst.id,
              datum: bezetting.dienst.datum,
              begintijd: bezetting.dienst.begintijd,
              eindtijd: bezetting.dienst.eindtijd,
              vestigingNaam: bezetting.dienst.week.vestiging.naam,
            })),
          },
        });
      }
    }
  }

  return NextResponse.json(taken);
}
