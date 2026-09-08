import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import BeschikbaarheidPaginaClient from "@/components/planning/BeschikbaarheidPaginaClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BeschikbaarheidPage({
  params,
}: PageProps) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    redirect("/login");
  }

  const { id } = await params;

  const medewerker =
    await prisma.medewerker.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        actief: true,
        voornaam: true,
        tussenvoegsel: true,
        achternaam: true,

        vestigingen: {
          where: {
            vestiging: {
              actief: true,
            },
          },
          select: {
            vestigingId: true,

            vestiging: {
              select: {
                id: true,
                naam: true,
                organisatieId: true,
                actief: true,
              },
            },
          },
          orderBy: {
            vestiging: {
              naam: "asc",
            },
          },
        },
      },
    });

  if (!medewerker) {
    redirect("/medewerkers");
  }

  if (!medewerker.actief) {
    redirect(
      `/medewerkers/${medewerker.id}`,
    );
  }

  const naam = [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");

  const actieveRelaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief,
    );

  const eigenMedewerker =
    gebruiker.medewerker?.id ===
    medewerker.id;

  const beheerderOrganisatieIds =
    actieveRelaties
      .filter((relatie) => {
        const rol =
          relatie.rol.naam.toLowerCase();

        return (
          rol === "eigenaar" ||
          rol === "teamleider"
        );
      })
      .map(
        (relatie) =>
          relatie.organisatieId,
      );

  const heeftBeheerToegang =
    medewerker.vestigingen.some(
      (relatie) =>
        beheerderOrganisatieIds.includes(
          relatie.vestiging
            .organisatieId,
        ),
    );

  if (
    !eigenMedewerker &&
    !heeftBeheerToegang
  ) {
    redirect("/dashboard");
  }

  const vestigingen =
    medewerker.vestigingen
      .filter((relatie) => {
        if (eigenMedewerker) {
          return true;
        }

        return beheerderOrganisatieIds.includes(
          relatie.vestiging
            .organisatieId,
        );
      })
      .map((relatie) => ({
        id: relatie.vestiging.id,
        naam: relatie.vestiging.naam,
      }));

  if (vestigingen.length === 0) {
    redirect(
      `/medewerkers/${medewerker.id}`,
    );
  }

  const isEigenaar =
    actieveRelaties.some(
      (relatie) =>
        relatie.rol.naam.trim().toLowerCase() === "eigenaar" &&
        medewerker.vestigingen.some(
          (vestigingRelatie) =>
            vestigingRelatie.vestiging.organisatieId === relatie.organisatieId,
        ),
    );

  const isBeheerder =
    !eigenMedewerker &&
    isEigenaar;

  return (
    <BeschikbaarheidPaginaClient
      medewerkerId={medewerker.id}
      medewerkerNaam={naam}
      vestigingen={vestigingen}
      isBeheerder={isBeheerder}
      isEigenMedewerker={eigenMedewerker}
    />
  );
}