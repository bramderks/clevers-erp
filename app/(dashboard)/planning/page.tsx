import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import PlanningPagina from "@/components/planning/PlanningPagina";

export default async function PlanningPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login");
  }

  const organisaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief,
    );

  if (organisaties.length === 0) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Planning
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Beheer de personeelsplanning per vestiging.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Je hebt momenteel geen actieve
            organisatiekoppeling.
          </p>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * ROLLEN
   * ============================================================
   */

  const isEigenaar =
    organisaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "eigenaar",
    );

  const isTeamleider =
    organisaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "teamleider",
    );

  const isMedewerker =
    gebruiker.medewerker?.id != null;

  /*
   * ============================================================
   * VESTIGINGEN
   * ============================================================
   *
   * Eigenaar:
   * - alle actieve vestigingen binnen de organisatie
   *
   * Teamleider / andere systeemgebruiker:
   * - alleen vestigingen via vestigingToegang
   *
   * Medewerker:
   * - vestigingen waaraan het medewerkerrecord gekoppeld is
   *
   * Een medewerker hoeft dus niet óók een aparte
   * vestigingToegang-relatie te hebben.
   */

  let vestigingen: Array<{
    id: string;
    naam: string;
  }> = [];

  if (isEigenaar) {
    const organisatieIds =
      organisaties.map(
        (relatie) =>
          relatie.organisatieId,
      );

    const gevondenVestigingen =
      await prisma.vestiging.findMany({
        where: {
          organisatieId: {
            in: organisatieIds,
          },
          actief: true,
        },
        select: {
          id: true,
          naam: true,
        },
        orderBy: {
          naam: "asc",
        },
      });

    vestigingen = gevondenVestigingen;
  } else if (isMedewerker) {
    const medewerker =
      await prisma.medewerker.findUnique({
        where: {
          id: gebruiker.medewerker!.id,
        },
        select: {
          id: true,
          actief: true,
          vestigingen: {
            where: {
              vestiging: {
                actief: true,
              },
            },
            select: {
              vestiging: {
                select: {
                  id: true,
                  naam: true,
                  organisatieId: true,
                  actief: true,
                },
              },
            },
          },
        },
      });

    if (medewerker?.actief) {
      vestigingen =
        medewerker.vestigingen
          .filter((relatie) =>
            organisaties.some(
              (organisatie) =>
                organisatie.organisatieId ===
                relatie.vestiging.organisatieId,
            ),
          )
          .map((relatie) => ({
            id: relatie.vestiging.id,
            naam: relatie.vestiging.naam,
          }));
    }
  } else if (isTeamleider) {
    vestigingen =
      gebruiker.vestigingToegang
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
  } else {
    /*
     * Overige gebruikers met bijvoorbeeld alleen
     * planning.view krijgen uitsluitend hun expliciete
     * vestigingToegang.
     */

    vestigingen =
      gebruiker.vestigingToegang
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
  }

  /*
   * ============================================================
   * DUBBELE VESTIGINGEN VERWIJDEREN
   * ============================================================
   */

  const uniekeVestigingen =
    Array.from(
      new Map(
        vestigingen.map(
          (vestiging) => [
            vestiging.id,
            vestiging,
          ],
        ),
      ).values(),
    ).sort((a, b) =>
      a.naam.localeCompare(
        b.naam,
        "nl",
      ),
    );

  /*
   * ============================================================
   * GEEN TOEGANG TOT VESTIGING
   * ============================================================
   */

  if (uniekeVestigingen.length === 0) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Planning
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Beheer de personeelsplanning per
            vestiging.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-slate-600">
            Je hebt momenteel geen toegang tot
            een actieve vestiging.
          </p>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * PLANNING
   * ============================================================
   */

  return (
    <PlanningPagina
  vestigingen={uniekeVestigingen}
  isEigenaar={isEigenaar}
  isTeamleider={isTeamleider}
  isMedewerker={isMedewerker}
/>
  );
}