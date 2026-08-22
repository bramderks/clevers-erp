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

  if (!gebruiker) {
    redirect("/login");
  }

  /*
   * ============================================================
   * ACTIEVE ORGANISATIES
   * ============================================================
   */

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
            Beheer de personeelsplanning per
            vestiging.
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
   *
   * Eigenaar is organisatiebreed.
   *
   * Een gebruiker kan naast een systeemrol ook aan
   * een medewerker gekoppeld zijn. Daarom bepalen we
   * eerst de beheerdersrollen en pas daarna of het om
   * een medewerker gaat.
   */

  const isEigenaar = organisaties.some(
    (relatie) =>
      relatie.rol.naam.toLowerCase() ===
      "eigenaar",
  );

  const isTeamleider = organisaties.some(
    (relatie) =>
      relatie.rol.naam.toLowerCase() ===
      "teamleider",
  );

  const isMedewerker =
    gebruiker.medewerker?.id != null;

  /*
   * ============================================================
   * ORGANISATIE-ID'S
   * ============================================================
   */

  const organisatieIds = Array.from(
    new Set(
      organisaties.map(
        (relatie) =>
          relatie.organisatieId,
      ),
    ),
  );

  /*
   * ============================================================
   * VESTIGINGEN
   * ============================================================
   *
   * Eigenaar:
   *   alle actieve vestigingen binnen de
   *   toegankelijke organisaties.
   *
   * Teamleider:
   *   alleen actieve vestigingen via
   *   vestigingToegang.
   *
   * Medewerker:
   *   alleen actieve vestigingen waaraan
   *   het medewerkerrecord gekoppeld is.
   *
   * Overige gebruikers:
   *   alleen expliciete vestigingToegang.
   */

  let vestigingen: Vestiging[] = [];

  if (isEigenaar) {
    vestigingen =
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
  } else if (isTeamleider) {
    vestigingen =
      gebruiker.vestigingToegang
        .filter(
          (toegang) =>
            toegang.actief &&
            toegang.vestiging.actief &&
            organisatieIds.includes(
              toegang.vestiging
                .organisatieId,
            ),
        )
        .map((toegang) => ({
          id: toegang.vestiging.id,
          naam: toegang.vestiging.naam,
        }));
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
            organisatieIds.includes(
              relatie.vestiging
                .organisatieId,
            ),
          )
          .map((relatie) => ({
            id: relatie.vestiging.id,
            naam: relatie.vestiging.naam,
          }));
    }
  } else {
    vestigingen =
      gebruiker.vestigingToegang
        .filter(
          (toegang) =>
            toegang.actief &&
            toegang.vestiging.actief &&
            organisatieIds.includes(
              toegang.vestiging
                .organisatieId,
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

        <div className="rounded-xl border bg-white p-6 shadow-sm">
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
   *
   * PlanningPagina bepaalt op basis van de
   * meegegeven rol of de gebruiker:
   *
   * - de volledige planning beheert;
   * - planning per vestiging beheert;
   * - of alleen de eigen planning ziet.
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