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
 * Centrale bedrijfslogica voor het definitief verwerken
 * van een verloningsperiode.
 * ============================================================
 */

export async function verwerkVerloning(
  periodeId: string,
): Promise<VerwerkVerloningResultaat> {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    throw new Error(
      "Je bent niet ingelogd.",
    );
  }

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

  const isEigenaar =
    organisaties.some(
      (relatie) =>
        relatie.rol.naam
          .trim()
          .toLowerCase() ===
        "eigenaar",
    );

  if (!isEigenaar) {
    throw new Error(
      "Alleen de eigenaar kan een verloningsperiode verwerken.",
    );
  }

  const organisatieIds =
    organisaties.map(
      (relatie) =>
        relatie.organisatieId,
    );

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
          controleDeadline: true,
          gecontroleerdDoorId: true,
          gecontroleerdOp: true,

          regels: {
            select: {
              id: true,
              medewerkerId: true,

              vestiging: {
                select: {
                  organisatieId: true,
                },
              },
            },
          },

          controles: {
            select: {
              id: true,
              status: true,
              medewerkerId: true,
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

  if (
    periode.regels.length === 0
  ) {
    throw new Error(
      "Deze verloningsperiode bevat geen regels en kan niet worden verwerkt.",
    );
  }

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

  if (!periode.controleDeadline) {
    throw new Error(
      "Deze verloningsperiode heeft geen controledeadline en kan daarom niet veilig worden verwerkt.",
    );
  }

  const nu = new Date();

  if (nu <= periode.controleDeadline) {
    throw new Error(
      "De controleperiode is nog niet verlopen. De verloning kan pas vanaf de 4e dag worden verwerkt.",
    );
  }

  if (
    !periode.gecontroleerdDoorId ||
    !periode.gecontroleerdOp
  ) {
    throw new Error(
      "De eigenaar heeft deze volledige verloningsperiode nog niet gecontroleerd.",
    );
  }

  /*
   * ------------------------------------------------------------
   * VERWACHTE MEDEWERKERS
   * ------------------------------------------------------------
   *
   * Meerdere regels kunnen bij dezelfde medewerker horen wanneer
   * deze in meerdere vestigingen heeft gewerkt. De controle geldt
   * per unieke medewerker en niet per regel.
   * ------------------------------------------------------------
   */

  const verwachteMedewerkerIds =
    new Set(
      periode.regels.map(
        (regel) =>
          regel.medewerkerId,
      ),
    );

  const controlePerMedewerker =
    new Map(
      periode.controles.map(
        (controle) => [
          controle.medewerkerId,
          controle.status,
        ],
      ),
    );

  if (
    controlePerMedewerker.size !==
    verwachteMedewerkerIds.size
  ) {
    throw new Error(
      "Niet voor iedere medewerker in deze verloningsperiode is precies één controle-record aanwezig.",
    );
  }

  for (
    const medewerkerId of verwachteMedewerkerIds
  ) {
    const status =
      controlePerMedewerker.get(
        medewerkerId,
      );

    if (
      status !== "AKKOORD" &&
      status !==
        "AUTOMATISCH_AKKOORD"
    ) {
      throw new Error(
        "Niet alle medewerkercontroles zijn afgerond.",
      );
    }
  }

  const openControles =
    periode.controles.filter(
      (controle) =>
        controle.status ===
        "OPEN",
    );

  /*
   * Een OPEN controle kan formeel niet meer voorkomen nadat de
   * deadline is verstreken zonder dat deze automatisch akkoord
   * is gezet. Toch vangen we dit defensief af, zodat een periode
   * nooit wordt verwerkt op basis van een onvolledige controle.
   */
  if (openControles.length > 0) {
    await prisma.verloningsControle.updateMany(
      {
        where: {
          verloningsPeriodeId:
            periode.id,
          status: "OPEN",
        },

        data: {
          status: "AUTOMATISCH_AKKOORD",
          automatischAkkoordOp:
            nu,
        },
      },
    );

    const resterendeOpenControles =
      await prisma.verloningsControle.count(
        {
          where: {
            verloningsPeriodeId:
              periode.id,
            status: "OPEN",
          },
        },
      );

    if (resterendeOpenControles > 0) {
      throw new Error(
        "Niet alle open medewerkercontroles konden automatisch worden afgerond.",
      );
    }
  }

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
