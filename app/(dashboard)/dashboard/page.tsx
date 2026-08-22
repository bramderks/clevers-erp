import { prisma } from "@/lib/prisma";

import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

import { permissions } from "@/lib/permissions";
import { vereisPermission } from "@/lib/requirePermission";

type DashboardTaak = {
  id: string;
  titel: string;
  omschrijving: string;
  aantal?: number;
  href: string;
  variant: "urgent" | "warning" | "info";
};

function beginVanMaand(datum: Date) {
  return new Date(
    datum.getFullYear(),
    datum.getMonth(),
    1,
  );
}

function beginVanVorigeMaand(datum: Date) {
  return new Date(
    datum.getFullYear(),
    datum.getMonth() - 1,
    1,
  );
}

export default async function DashboardPage() {
  await vereisPermission(
    permissions.dashboard.view,
  );

  const vandaag = new Date();

  const beginVorigeMaand =
    beginVanVorigeMaand(vandaag);

  const beginDezeMaand =
    beginVanMaand(vandaag);

  const vorigeMaand =
    beginVorigeMaand;

  const vorigeMaandJaar =
    vorigeMaand.getFullYear();

  const vorigeMaandNummer =
    vorigeMaand.getMonth() + 1;

  const [
    medewerkers,
    openDienstplekken,
    openRuilverzoeken,
    teControlerenUren,
    verloningsPeriode,
  ] = await Promise.all([
    prisma.medewerker.count({
      where: {
        actief: true,
      },
    }),

    prisma.dienstBezetting.count({
      where: {
        status: "OPEN",
      },
    }),

    prisma.ruilverzoek.count({
      where: {
        status: "WACHT_OP_EIGENAAR",
      },
    }),

    prisma.urenRegistratie.count({
      where: {
        status: "TE_CONTROLEREN",
      },
    }),

    prisma.verloningsPeriode.findUnique({
      where: {
        jaar_maand: {
          jaar: vorigeMaandJaar,
          maand: vorigeMaandNummer,
        },
      },
      select: {
        id: true,
        status: true,
        jaar: true,
        maand: true,
      },
    }),
  ]);

  const taken: DashboardTaak[] = [];

  /*
   * ============================================================
   * DIENSTEN
   * ============================================================
   */

  if (openDienstplekken > 0) {
    taken.push({
      id: "diensten-open",
      titel: "Diensten nog te vullen",
      omschrijving:
        "Er zijn nog open dienstplekken in de planning.",
      aantal: openDienstplekken,
      href: "/planning",
      variant: "urgent",
    });
  }

  /*
   * ============================================================
   * RUILVERZOEKEN
   * ============================================================
   */

  if (openRuilverzoeken > 0) {
    taken.push({
      id: "ruilverzoeken",
      titel: "Ruilverzoeken beoordelen",
      omschrijving:
        "Ruilverzoeken wachten op goedkeuring van de eigenaar.",
      aantal: openRuilverzoeken,
      href: "/planning",
      variant: "warning",
    });
  }

  /*
   * ============================================================
   * UREN
   * ============================================================
   */

  if (teControlerenUren > 0) {
    taken.push({
      id: "uren-controleren",
      titel: "Uren goedkeuren",
      omschrijving:
        "Er zijn urenregistraties die nog gecontroleerd moeten worden.",
      aantal: teControlerenUren,
      href: "/planning",
      variant: "warning",
    });
  }

  /*
   * ============================================================
   * VERLONING
   * ============================================================
   *
   * De melding verschijnt uitsluitend wanneer de
   * verloningsgenerator de vorige maand daadwerkelijk
   * heeft aangemaakt en de periode de status KLAAR heeft.
   *
   * We kijken dus niet meer rechtstreeks naar
   * UrenRegistratie.
   */

  if (
    verloningsPeriode?.status ===
    "KLAAR"
  ) {
    taken.push({
      id: "verloning",
      titel: "Verloning staat klaar",
      omschrijving:
        "De verloning van de vorige maand is gegenereerd en kan worden gecontroleerd.",
      href: `/verloning/${verloningsPeriode.id}`,
      variant: "info",
    });
  }

  return (
    <main className="space-y-8">
      <PageHeader title="Dashboard" />

      <section>
        <Card
          title="Openstaande taken"
          description="Acties die nog aandacht nodig hebben"
        >
          {taken.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
              <div className="text-center">
                <p className="font-medium text-slate-900">
                  Geen openstaande taken
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Alles is bijgewerkt.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {taken.map((taak) => (
                <a
                  key={taak.id}
                  href={taak.href}
                  className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={[
                        "h-3 w-3 shrink-0 rounded-full",
                        taak.variant ===
                          "urgent" &&
                          "bg-red-500",
                        taak.variant ===
                          "warning" &&
                          "bg-amber-400",
                        taak.variant ===
                          "info" &&
                          "bg-blue-500",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />

                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 transition-colors group-hover:text-slate-700">
                        {taak.titel}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {taak.omschrijving}
                      </p>
                    </div>
                  </div>

                  {typeof taak.aantal ===
                    "number" && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                      {taak.aantal}
                    </span>
                  )}

                  <span className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </a>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Medewerkers"
          description="Actieve medewerkers binnen Clevers ERP"
        >
          <p className="text-4xl font-bold text-slate-900">
            {medewerkers}
          </p>
        </Card>
      </section>
    </main>
  );
}