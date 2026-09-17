import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import PlanningPagina from "@/components/planning/PlanningPagina";

type Vestiging = {
  id: string;
  naam: string;
};

export default async function PlanningPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) redirect("/login");

  const organisaties = gebruiker.organisaties.filter(
    (relatie) => relatie.actief && relatie.organisatie.actief,
  );

  const isMedewerker = gebruiker.medewerker?.id != null;
  const isEigenaar = organisaties.some(
    (relatie) => relatie.rol.naam.trim().toLowerCase() === "eigenaar",
  );
  const isTeamleider = organisaties.some(
    (relatie) => relatie.rol.naam.trim().toLowerCase() === "teamleider",
  );

  const organisatieIds = Array.from(
    new Set(organisaties.map((relatie) => relatie.organisatieId)),
  );

  let vestigingen: Vestiging[] = [];

  if (isEigenaar) {
    vestigingen = await prisma.vestiging.findMany({
      where: { organisatieId: { in: organisatieIds }, actief: true },
      select: { id: true, naam: true },
      orderBy: { naam: "asc" },
    });
  } else if (isMedewerker) {
    const medewerker = await prisma.medewerker.findUnique({
      where: { id: gebruiker.medewerker!.id },
      select: {
        actief: true,
        vestigingen: {
          where: { vestiging: { actief: true } },
          select: {
            vestiging: {
              select: { id: true, naam: true, organisatieId: true, actief: true },
            },
          },
        },
      },
    });

    if (medewerker?.actief) {
      vestigingen = medewerker.vestigingen
        .filter((relatie) => organisatieIds.includes(relatie.vestiging.organisatieId))
        .map((relatie) => ({ id: relatie.vestiging.id, naam: relatie.vestiging.naam }));
    }
  } else if (isTeamleider) {
    vestigingen = gebruiker.vestigingToegang
      .filter(
        (toegang) =>
          toegang.actief &&
          toegang.vestiging.actief &&
          organisatieIds.includes(toegang.vestiging.organisatieId),
      )
      .map((toegang) => ({ id: toegang.vestiging.id, naam: toegang.vestiging.naam }));
  } else {
    vestigingen = gebruiker.vestigingToegang
      .filter(
        (toegang) =>
          toegang.actief &&
          toegang.vestiging.actief &&
          organisatieIds.includes(toegang.vestiging.organisatieId),
      )
      .map((toegang) => ({ id: toegang.vestiging.id, naam: toegang.vestiging.naam }));
  }

  const uniekeVestigingen = Array.from(
    new Map(vestigingen.map((vestiging) => [vestiging.id, vestiging])).values(),
  ).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));

  if (organisaties.length === 0 && isMedewerker) {
    const medewerker = await prisma.medewerker.findUnique({
      where: { id: gebruiker.medewerker!.id },
      select: {
        actief: true,
        vestigingen: {
          where: { vestiging: { actief: true } },
          select: { vestiging: { select: { id: true, naam: true } } },
        },
      },
    });

    if (medewerker?.actief) {
      const medewerkerVestigingen = medewerker.vestigingen.map((relatie) => ({
        id: relatie.vestiging.id,
        naam: relatie.vestiging.naam,
      }));

      if (medewerkerVestigingen.length > 0) {
        return (
          <PlanningPagina
            vestigingen={medewerkerVestigingen}
            isEigenaar={false}
            isTeamleider={false}
            isMedewerker
            huidigeMedewerkerId={gebruiker.medewerker!.id}
          />
        );
      }
    }
  }

  if (uniekeVestigingen.length === 0) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Planning</h1>
          <p className="mt-1 text-sm text-slate-600">Beheer de personeelsplanning per vestiging.</p>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Je hebt momenteel geen toegang tot een actieve vestiging.</p>
        </div>
      </main>
    );
  }

  return (
    <PlanningPagina
      vestigingen={uniekeVestigingen}
      isEigenaar={isEigenaar}
      isTeamleider={isTeamleider}
      isMedewerker={isMedewerker}
      huidigeMedewerkerId={gebruiker.medewerker?.id ?? null}
    />
  );
}
