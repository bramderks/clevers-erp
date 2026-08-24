import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { medewerkerService } from "@/lib/services/medewerker.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type Section =
  | "algemeen"
  | "contract"
  | "vestigingen"
  | "verloning";

type Aanhef =
  | "DHR"
  | "MEVR"
  | "ANDERS"
  | "GEEN_OPGAVE";

type ContractType =
  | "OPROEP"
  | "VAST";

function maakDatum(
  waarde: unknown,
  verplicht: true,
  veldnaam?: string,
): Date;

function maakDatum(
  waarde: unknown,
  verplicht?: false,
  veldnaam?: string,
): Date | null;

function maakDatum(
  waarde: unknown,
  verplicht = false,
  veldnaam = "Datum",
) {
  if (
    waarde === null ||
    waarde === undefined ||
    waarde === ""
  ) {
    if (verplicht) {
      throw new Error(
        `${veldnaam} is verplicht.`,
      );
    }

    return null;
  }

  const datum = new Date(
    String(waarde),
  );

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
    throw new Error(
      `${veldnaam} is ongeldig.`,
    );
  }

  return datum;
}

function maakNummer(
  waarde: unknown,
  veldnaam: string,
): number | null {
  if (
    waarde === null ||
    waarde === undefined ||
    waarde === ""
  ) {
    return null;
  }

  const nummer = Number(
    waarde,
  );

  if (
    !Number.isFinite(
      nummer,
    )
  ) {
    throw new Error(
      `${veldnaam} moet een geldig getal zijn.`,
    );
  }

  if (nummer < 0) {
    throw new Error(
      `${veldnaam} mag niet negatief zijn.`,
    );
  }

  return nummer;
}

function controleerAanhef(
  waarde: unknown,
): Aanhef {
  if (
    waarde !== "DHR" &&
    waarde !== "MEVR" &&
    waarde !== "ANDERS" &&
    waarde !== "GEEN_OPGAVE"
  ) {
    throw new Error(
      "De gekozen aanhef is ongeldig.",
    );
  }

  return waarde;
}

function controleerContractType(
  waarde: unknown,
): ContractType | null {
  if (
    waarde === null ||
    waarde === undefined ||
    waarde === ""
  ) {
    return null;
  }

  if (
    waarde !== "OPROEP" &&
    waarde !== "VAST"
  ) {
    throw new Error(
      "Het gekozen contracttype is ongeldig.",
    );
  }

  return waarde;
}

function controleerTekst(
  waarde: unknown,
  veldnaam: string,
  verplicht: true,
): string;

function controleerTekst(
  waarde: unknown,
  veldnaam: string,
  verplicht?: false,
): string | null;

function controleerTekst(
  waarde: unknown,
  veldnaam: string,
  verplicht = false,
) {
  if (
    waarde === null ||
    waarde === undefined
  ) {
    if (verplicht) {
      throw new Error(
        `${veldnaam} is verplicht.`,
      );
    }

    return null;
  }

  if (
    typeof waarde !== "string"
  ) {
    throw new Error(
      `${veldnaam} heeft een ongeldige waarde.`,
    );
  }

  const tekst =
    waarde.trim();

  if (
    !tekst &&
    verplicht
  ) {
    throw new Error(
      `${veldnaam} is verplicht.`,
    );
  }

  return tekst || null;
}

function controleerEmail(
  waarde: unknown,
): string {
  if (
    typeof waarde !== "string"
  ) {
    throw new Error(
      "E-mailadres is verplicht.",
    );
  }

  const email =
    waarde
      .trim()
      .toLowerCase();

  if (!email) {
    throw new Error(
      "E-mailadres is verplicht.",
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  ) {
    throw new Error(
      "Het e-mailadres is ongeldig.",
    );
  }

  return email;
}

function controleerTelefoon(
  waarde: unknown,
): string {
  if (
    typeof waarde !== "string"
  ) {
    throw new Error(
      "Telefoonnummer is verplicht.",
    );
  }

  const telefoon =
    waarde.trim();

  if (!telefoon) {
    throw new Error(
      "Telefoonnummer is verplicht.",
    );
  }

  return telefoon;
}

function controleerObject(
  waarde: unknown,
  foutmelding: string,
): Record<string, unknown> {
  if (
    waarde === null ||
    typeof waarde !== "object" ||
    Array.isArray(waarde)
  ) {
    throw new Error(
      foutmelding,
    );
  }

  return waarde as Record<
    string,
    unknown
  >;
}

function controleerStringArray(
  waarde: unknown,
  veldnaam: string,
): string[] {
  if (
    !Array.isArray(waarde)
  ) {
    throw new Error(
      `${veldnaam} heeft een ongeldig formaat.`,
    );
  }

  const waarden =
    waarde.map(
      (item) => {
        if (
          typeof item !==
            "string" ||
          !item.trim()
        ) {
          throw new Error(
            `${veldnaam} bevat een ongeldige waarde.`,
          );
        }

        return item.trim();
      },
    );

  return Array.from(
    new Set(waarden),
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } =
      await params;

    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          error:
            "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    if (!gebruiker.actief) {
      return NextResponse.json(
        {
          error:
            "Je account is niet actief.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ======================================================
     * MEDEWERKER
     * ======================================================
     */

    const medewerker =
      await prisma.medewerker.findUnique(
        {
          where: {
            id,
          },

          select: {
            id: true,

            vestigingen: {
              select: {
                vestiging: {
                  select: {
                    id: true,
                    organisatieId: true,
                    actief: true,
                  },
                },
              },
            },
          },
        },
      );

    if (!medewerker) {
      return NextResponse.json(
        {
          error:
            "Medewerker niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * ======================================================
     * ORGANISATIES VAN MEDEWERKER
     * ======================================================
     */

    const organisatieIds =
      Array.from(
        new Set(
          medewerker.vestigingen
            .filter(
              (relatie) =>
                relatie.vestiging.actief,
            )
            .map(
              (relatie) =>
                relatie.vestiging
                  .organisatieId,
            ),
        ),
      );

    if (
      organisatieIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Deze medewerker is niet aan een actieve organisatie gekoppeld.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ======================================================
     * EIGENAAR CONTROLEREN
     * ======================================================
     *
     * De Eigenaar is organisatiebreed.
     * Er wordt dus niet naar een specifieke vestiging gekeken.
     */

    const isEigenaar =
      gebruiker.organisaties.some(
        (relatie) =>
          relatie.actief &&
          relatie.organisatie.actief &&
          relatie.rol.naam
            .trim()
            .toLowerCase() ===
            "eigenaar" &&
          organisatieIds.includes(
            relatie.organisatieId,
          ),
      );

    if (!isEigenaar) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toestemming om deze medewerker te wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ======================================================
     * REQUEST
     * ======================================================
     */

    const body =
      await request.json();

    const bodyObject =
      controleerObject(
        body,
        "De meegestuurde gegevens hebben een ongeldig formaat.",
      );

    const sectionValue =
      bodyObject.section;

    if (
      sectionValue !== "algemeen" &&
      sectionValue !== "contract" &&
      sectionValue !== "vestigingen" &&
      sectionValue !== "verloning"
    ) {
      return NextResponse.json(
        {
          error:
            "De gekozen bewerksectie is ongeldig.",
        },
        {
          status: 400,
        },
      );
    }

    const section:
      Section =
        sectionValue;

    const data =
      controleerObject(
        bodyObject.data,
        "De bewerkgegevens hebben een ongeldig formaat.",
      );

    /*
     * ======================================================
     * ALGEMEEN
     * ======================================================
     */

    switch (section) {
      case "algemeen": {
        const updateData = {
          personeelsnummer:
            controleerTekst(
              data.personeelsnummer,
              "Personeelsnummer",
            ),

          aanhef:
            controleerAanhef(
              data.aanhef,
            ),

          voornaam:
            controleerTekst(
              data.voornaam,
              "Voornaam",
              true,
            ),

          tussenvoegsel:
            controleerTekst(
              data.tussenvoegsel,
              "Tussenvoegsel",
            ),

          achternaam:
            controleerTekst(
              data.achternaam,
              "Achternaam",
              true,
            ),

          roepnaam:
            controleerTekst(
              data.roepnaam,
              "Roepnaam",
            ),

          geboortedatum:
            maakDatum(
              data.geboortedatum,
              true,
              "Geboortedatum",
            ),

          email:
            controleerEmail(
              data.email,
            ),

          telefoon:
            controleerTelefoon(
              data.telefoon,
            ),
        };

        const resultaat =
          await medewerkerService.update(
            id,
            updateData,
          );

        return NextResponse.json({
          id: resultaat.id,
          section,
          melding:
            "De wijzigingen zijn succesvol opgeslagen.",
        });
      }

      /*
       * ======================================================
       * CONTRACT
       * ======================================================
       */

      case "contract": {
        const datumInDienst =
          maakDatum(
            data.datumInDienst,
            false,
            "Datum in dienst",
          );

        const datumUitDienst =
          maakDatum(
            data.datumUitDienst,
            false,
            "Datum uit dienst",
          );

        if (
          datumInDienst &&
          datumUitDienst &&
          datumUitDienst <
            datumInDienst
        ) {
          throw new Error(
            "Datum uit dienst kan niet vóór datum in dienst liggen.",
          );
        }

        const updateData = {
          contractType:
            controleerContractType(
              data.contractType,
            ),

          contractUren:
            maakNummer(
              data.contractUren,
              "Contracturen",
            ),

          datumInDienst,

          datumUitDienst,
        };

        const resultaat =
          await medewerkerService.update(
            id,
            updateData,
          );

        return NextResponse.json({
          id: resultaat.id,
          section,
          melding:
            "De wijzigingen zijn succesvol opgeslagen.",
        });
      }

      /*
       * ======================================================
       * VESTIGINGEN
       * ======================================================
       */

      case "vestigingen": {
        const vestigingIds =
          controleerStringArray(
            data.vestigingIds,
            "Vestigingen",
          );

        const hoofdvestigingId =
          controleerTekst(
            data.hoofdvestigingId,
            "Hoofdvestiging",
            true,
          );

        if (
          vestigingIds.length === 0
        ) {
          throw new Error(
            "Een medewerker moet aan minimaal één vestiging gekoppeld zijn.",
          );
        }

        if (
          !vestigingIds.includes(
            hoofdvestigingId,
          )
        ) {
          throw new Error(
            "De hoofdvestiging moet ook aan de medewerker gekoppeld zijn.",
          );
        }

        const vestigingen =
          await prisma.vestiging.findMany(
            {
              where: {
                id: {
                  in: vestigingIds,
                },

                actief: true,

                organisatieId: {
                  in: organisatieIds,
                },
              },

              select: {
                id: true,
              },
            },
          );

        if (
          vestigingen.length !==
          vestigingIds.length
        ) {
          throw new Error(
            "Een of meer geselecteerde vestigingen bestaan niet of zijn niet actief.",
          );
        }

        const resultaat =
          await medewerkerService.setVestigingen(
            id,
            vestigingIds,
            hoofdvestigingId,
          );

        return NextResponse.json({
          id,
          section,
          vestigingen:
            resultaat,
          melding:
            "De vestigingen zijn succesvol opgeslagen.",
        });
      }

      /*
       * ======================================================
       * VERLONING
       * ======================================================
       */

      case "verloning": {
        const updateData = {
          uurloon:
            maakNummer(
              data.uurloon,
              "Uurloon",
            ),
        };

        const resultaat =
          await medewerkerService.update(
            id,
            updateData,
          );

        return NextResponse.json({
          id: resultaat.id,
          section,
          melding:
            "De wijzigingen zijn succesvol opgeslagen.",
        });
      }

      default: {
        const _section:
          never = section;

        return NextResponse.json(
          {
            error:
              `Onbekende bewerksectie: ${String(
                _section,
              )}`,
          },
          {
            status: 400,
          },
        );
      }
    }
  } catch (error) {
    console.error(
      "Medewerker bijwerken mislukt:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "De medewerkergegevens konden niet worden opgeslagen.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      },
    );
  }
}