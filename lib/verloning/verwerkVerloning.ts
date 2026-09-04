import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type VerwerkVerloningResultaat = {
  periodeId: string;
  jaar: number;
  maand: number;
  status: "VERWERKT";
};

/*
 * ============================================================
 * VERLONINGSPERIODE VERWERKEN
 * ============================================================
 *
 * Dit is de centrale bedrijfslogica voor het definitief
 * verwerken van een verloningsperiode.
 *
 * Zowel de dashboardomgeving als API-routes kunnen deze
 * functie gebruiken.
 *
 * Een verloningsperiode kan uitsluitend worden verwerkt:
 *
 * - door de Eigenaar;
 * - wanneer de gebruiker is ingelogd;
 * - wanneer de gebruiker toegang heeft tot de organisatie;
 * - wanneer de periode bestaat;
 * - wanneer de periode status KLAAR heeft;
 * - wanneer de periode regels bevat;
 * - wanneer alle regels binnen toegankelijke organisaties
 *   van de Eigenaar vallen.
 *
 * Een periode met status VERWERKT is definitief en kan nooit
 * opnieuw worden verwerkt.
 * ============================================================
 */

export async function verwerkVerloning(
  periodeId: string,
): Promise<VerwerkVerloningResultaat> {
  /*
   * ==========================================================
   * GEBRUIKER
   * ==========================================================
   */

  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    throw new Error(
      "Je bent niet ingelogd.",
    );
  }

  /*
   * ==========================================================
   * ACTIEVE ORGANISATIES
   * ==========================================================
   */

  const organisaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief,
    );

  if (organisaties.length === 0) {
    throw new Error(
      "Je hebt geen toegang tot een actieve organisatie.",
    );
  }

  /*
   * ==========================================================
   * EIGENAAR CONTROLEREN
   * ==========================================================
   *
   * Verloning is organisatiebreed en mag uitsluitend door
   * de Eigenaar definitief worden verwerkt.
   * ==========================================================
   */

  const isEigenaar =
    organisaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "eigenaar",
    );

  if (!isEigenaar) {
    throw new Error(
      "Alleen de eigenaar kan een verloningsperiode verwerken.",
    );
  }

  /*
   * ==========================================================
   * ORGANISATIE-ID'S
   * ==========================================================
   */

  const organisatieIds =
    organisaties.map(
      (relatie) =>
        relatie.organisatieId,
    );

  /*
   * ==========================================================
   * VERLONINGSPERIODE OPHALEN
   * ==========================================================
   */

  const periode =
    await prisma.verloningsPeriode.findUnique(
      {
        where: {
          id: periodeId,
        },

        select: {
          id: true,
          jaar: true,
          maand: true,
          status: true,

          regels: {
            select: {
              id: true,

              vestiging: {
                select: {
                  organisatieId: true,
                },
              },
            },
          },
        },
      },
    );

  if (!periode) {
    throw new Error(
      "De verloningsperiode bestaat niet.",
    );
  }

  /*
   * ==========================================================
   * STATUS CONTROLEREN
   * ==========================================================
   */

  if (
    periode.status ===
    "VERWERKT"
  ) {
    throw new Error(
      "Deze verloningsperiode is al verwerkt en kan niet opnieuw worden verwerkt.",
    );
  }

  if (
    periode.status !==
    "KLAAR"
  ) {
    throw new Error(
      "Alleen een verloningsperiode met status Klaar kan worden verwerkt.",
    );
  }

  /*
   * ==========================================================
   * REGELS CONTROLEREN
   * ==========================================================
   */

  if (
    periode.regels.length === 0
  ) {
    throw new Error(
      "Deze verloningsperiode bevat geen regels en kan niet worden verwerkt.",
    );
  }

  /*
   * ==========================================================
   * ORGANISATIETOEGANG CONTROLEREN
   * ==========================================================
   *
   * De volledige periode moet binnen organisaties vallen waar
   * de Eigenaar toegang toe heeft.
   *
   * Hierdoor kan een periode nooit gedeeltelijk worden
   * verwerkt.
   * ==========================================================
   */

  const heeftToegang =
    periode.regels.every(
      (regel) =>
        organisatieIds.includes(
          regel.vestiging.organisatieId,
        ),
    );

  if (!heeftToegang) {
    throw new Error(
      "Je hebt geen toegang tot deze volledige verloningsperiode.",
    );
  }

  /*
   * ==========================================================
   * DEFINITIEF VERWERKEN
   * ==========================================================
   */

  const verwerktePeriode =
    await prisma.verloningsPeriode.update(
      {
        where: {
          id: periode.id,
        },

        data: {
          status: "VERWERKT",
        },

        select: {
          id: true,
          jaar: true,
          maand: true,
          status: true,
        },
      },
    );

  /*
   * ==========================================================
   * RESULTAAT
   * ==========================================================
   */

  return {
    periodeId:
      verwerktePeriode.id,

    jaar:
      verwerktePeriode.jaar,

    maand:
      verwerktePeriode.maand,

    status: "VERWERKT",
  };
}