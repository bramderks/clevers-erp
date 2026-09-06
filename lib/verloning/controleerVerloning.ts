import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ControleerVerloningResultaat = {
  periodeId: string;
  jaar: number;
  maand: number;
  gecontroleerdDoorId: string;
  gecontroleerdOp: Date;
};

export async function controleerVerloning(
  periodeId: string,
): Promise<ControleerVerloningResultaat> {
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
      "Alleen de eigenaar kan een verloningsperiode controleren.",
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
          controleStart: true,
          controleDeadline: true,
          gecontroleerdDoorId: true,
          gecontroleerdOp: true,

          regels: {
            select: {
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

  if (periode.status === "VERWERKT") {
    throw new Error(
      "Deze verloningsperiode is al verwerkt en kan niet opnieuw worden gecontroleerd.",
    );
  }

  if (periode.status !== "KLAAR") {
    throw new Error(
      "Alleen een verloningsperiode met status Klaar kan worden gecontroleerd.",
    );
  }

  if (periode.regels.length === 0) {
    throw new Error(
      "Deze verloningsperiode bevat geen regels en kan niet worden gecontroleerd.",
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

  if (!periode.controleStart) {
    throw new Error(
      "Deze verloningsperiode heeft geen controleperiode.",
    );
  }

  if (!periode.controleDeadline) {
    throw new Error(
      "Deze verloningsperiode heeft geen controledeadline.",
    );
  }

  const nu = new Date();

  if (nu < periode.controleStart) {
    throw new Error(
      "De controleperiode voor deze verloningsperiode is nog niet gestart.",
    );
  }

  if (nu > periode.controleDeadline) {
    throw new Error(
      "De controleperiode voor deze verloningsperiode is verlopen.",
    );
  }

  const gecontroleerdePeriode =
    await prisma.verloningsPeriode.update(
      {
        where: {
          id: periode.id,
        },

        data: {
          gecontroleerdDoorId:
            gebruiker.id,
          gecontroleerdOp: nu,
        },

        select: {
          id: true,
          jaar: true,
          maand: true,
          gecontroleerdDoorId: true,
          gecontroleerdOp: true,
        },
      },
    );

  if (
    !gecontroleerdePeriode.gecontroleerdDoorId ||
    !gecontroleerdePeriode.gecontroleerdOp
  ) {
    throw new Error(
      "De eigenaarcontrole kon niet worden opgeslagen.",
    );
  }

  return {
    periodeId:
      gecontroleerdePeriode.id,
    jaar:
      gecontroleerdePeriode.jaar,
    maand:
      gecontroleerdePeriode.maand,
    gecontroleerdDoorId:
      gecontroleerdePeriode.gecontroleerdDoorId,
    gecontroleerdOp:
      gecontroleerdePeriode.gecontroleerdOp,
  };
}
