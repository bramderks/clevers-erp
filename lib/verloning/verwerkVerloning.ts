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
 *
 * Verwerking mag uitsluitend:
 *
 * - door de Eigenaar;
 * - met actieve toegang tot de betrokken organisaties;
 * - wanneer de periode bestaat;
 * - wanneer de periode status KLAAR heeft;
 * - wanneer de controledeadline is verstreken;
 * - wanneer de eigenaar de volledige periode heeft gecontroleerd.
 *
 * Medewerkers die vóór de deadline niet zelf akkoord geven,
 * worden door de applicatie als AUTOMATISCH_AKKOORD behandeld
 * zodra de deadline is verstreken.
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

  const uniekeMedewerkerIds =
    new Set(
      periode.regels.map(
        (regel) =>
          regel.id,
      ),
    );

  /*
   * Eén controle-record hoort bij iedere medewerker die in
   * de periode voorkomt. Als een oud of handmatig gemanipuleerd
   * record ontbreekt, mag de periode niet definitief worden.
   */

  const verwachteControleAantal =
    new Set(
      periode.regels.map(
        (regel) =>
          regel.id,
      ),
    ).size;

  const feitelijkeMedewerkerIds =
    new Set(
      periode.controles.map(
        (controle) =>
          controle.medewerkerId,
      ),
    );

  const ontbrekendeControles =
    verwachteControleAantal !==
    feitelijkeMedewerkerIds.size;

  if (ontbrekendeControles) {
    throw new Error(
      "Niet voor iedere medewerker in deze verloningsperiode is een controle-record aanwezig.",
    );
  }

  /*
   * Na de deadline wordt een nog OPEN controle automatisch
   * akkoord gezet. Dit gebeurt direct vóór definitieve
   * verwerking en blijft volledig zichtbaar in de administratie.
   */

  const openControles =
    periode.controles.filter(
      (controle) =>
        controle.status ===
        "OPEN",
    );

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
  }

  /*
   * Alle controles opnieuw ophalen zodat de definitieve
   * statuscontrole gebaseerd is op de daadwerkelijk opgeslagen
   * database-statussen.
   */

  const controlesNaAutomatischAkkoord =
    await prisma.verloningsControle.findMany(
      {
        where: {
          verloningsPeriodeId:
            periode.id,
        },

        select: {
          medewerkerId: true,
          status: true,
        },
      },
    );

  const medewerkerIds =
    new Set(
      periode.regels.map(
        (regel) =>
          regel.id,
      ),
    );

  const controlesNietAkkoord =
    controlesNaAutomatischAkkoord.some(
      (controle) =>
        controle.status !==
          "AKKOORD" &&
        controle.status !==
          "AUTOMATISCH_AKKOORD",
    );

  if (controlesNietAkkoord) {
    throw new Error(
      "Niet alle medewerkercontroles zijn afgerond.",
    );
  }

  /*
   * Definitief verwerken.
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
