import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import PlanningPagina from "@/components/planning/PlanningPagina";

export default async function PlanningPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login");
  }

  const organisaties = gebruiker.organisaties.filter(
    (relatie) =>
      relatie.actief &&
      relatie.organisatie.actief,
  );

  const isEigenaar = organisaties.some(
    (relatie) =>
      relatie.rol.naam.toLowerCase() === "eigenaar",
  );

  const vestigingen = isEigenaar
    ? (
        await Promise.all(
          organisaties.map((relatie) =>
            prisma.vestiging.findMany({
              where: {
                organisatieId: relatie.organisatieId,
                actief: true,
              },
              select: {
                id: true,
                naam: true,
              },
              orderBy: {
                naam: "asc",
              },
            }),
          ),
        )
      ).flat()
    : gebruiker.vestigingToegang
        .filter(
          (toegang) =>
            toegang.actief &&
            toegang.vestiging.actief &&
            organisaties.some(
              (relatie) =>
                relatie.organisatieId ===
                toegang.vestiging.organisatieId,
            ),
        )
        .map((toegang) => ({
          id: toegang.vestiging.id,
          naam: toegang.vestiging.naam,
        }));

  const uniekeVestigingen = Array.from(
    new Map(
      vestigingen.map((vestiging) => [
        vestiging.id,
        vestiging,
      ]),
    ).values(),
  );

  if (uniekeVestigingen.length === 0) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Planning
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Beheer de personeelsplanning per vestiging.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-600">
            Je hebt momenteel geen toegang tot een actieve
            vestiging.
          </p>
        </div>
      </main>
    );
  }

  return (
    <PlanningPagina
      vestigingen={uniekeVestigingen}
    />
  );
}