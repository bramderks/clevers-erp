import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import GenereerVerloningForm from "./GenereerVerloningForm";

function formatUren(uren: number) {
  return uren
    .toFixed(2)
    .replace(".", ",");
}

export default async function VerloningPage() {
  /*
   * ============================================================
   * GEBRUIKER
   * ============================================================
   */

  const gebruiker =
    await getCurrentUser();

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
    redirect("/dashboard");
  }

  /*
   * ============================================================
   * EIGENAAR CONTROLEREN
   * ============================================================
   */

  const isEigenaar =
    organisaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "eigenaar",
    );

  if (!isEigenaar) {
    redirect("/dashboard");
  }

  /*
   * ============================================================
   * ORGANISATIE-IDS
   * ============================================================
   *
   * Een eigenaar mag uitsluitend verloningsperiodes
   * zien waarvoor regels bestaan binnen zijn actieve
   * organisaties.
   * ============================================================
   */

  const organisatieIds =
    organisaties.map(
      (relatie) =>
        relatie.organisatieId,
    );

  /*
   * ============================================================
   * VERLONINGSPERIODES OPHALEN
   * ============================================================
   */

  const periodes =
    await prisma.verloningsPeriode.findMany({
      where: {
        regels: {
          some: {
            vestiging: {
              organisatieId: {
                in: organisatieIds,
              },
            },
          },
        },
      },

      orderBy: [
        {
          jaar: "desc",
        },
        {
          maand: "desc",
        },
      ],

      include: {
        regels: {
          where: {
            vestiging: {
              organisatieId: {
                in: organisatieIds,
              },
            },
          },

          select: {
            medewerkerId: true,
            gewerkteDagen: true,
            gewerkteUren: true,
          },
        },
      },
    });

  /*
   * ============================================================
   * STANDAARD GENERATIEPERIODE
   * ============================================================
   *
   * Standaard wordt de vorige maand geselecteerd.
   * Dit sluit aan op de automatische cron-flow.
   * ============================================================
   */

  const vandaag = new Date();

  const vorigeMaand =
    new Date(
      vandaag.getFullYear(),
      vandaag.getMonth() - 1,
      1,
    );

  const standaardJaar =
    vorigeMaand.getFullYear();

  const standaardMaand =
    vorigeMaand.getMonth() + 1;

  /*
   * ============================================================
   * FORMATTERS
   * ============================================================
   */

  const maandFormatter =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        month: "long",
      },
    );

  const datumFormatter =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    );

  /*
   * ============================================================
   * TOTALEN BEREKENEN
   * ============================================================
   */

  const periodesMetTotalen =
    periodes.map((periode) => {
      const medewerkerIds =
        new Set(
          periode.regels.map(
            (regel) =>
              regel.medewerkerId,
          ),
        );

      const gewerkteDagen =
        periode.regels.reduce(
          (totaal, regel) =>
            totaal +
            regel.gewerkteDagen,
          0,
        );

      const gewerkteUren =
        periode.regels.reduce(
          (totaal, regel) =>
            totaal +
            Number(
              regel.gewerkteUren,
            ),
          0,
        );

      return {
        id: periode.id,
        jaar: periode.jaar,
        maand: periode.maand,
        status: periode.status,

        gegenereerdOp:
          periode.gegenereerdOp,

        periodeStart:
          periode.periodeStart,

        aantalMedewerkers:
          medewerkerIds.size,

        gewerkteDagen,

        gewerkteUren,
      };
    });

  return (
    <main className="space-y-8">
      {/* ========================================================
       * HEADER
       * ======================================================== */}

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Verloning
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Automatisch en handmatig aangemaakte
          maandoverzichten van gewerkte uren.
        </p>
      </div>

      {/* ========================================================
       * HANDMATIG GENEREREN
       * ======================================================== */}

      <GenereerVerloningForm
        standaardJaar={
          standaardJaar
        }
        standaardMaand={
          standaardMaand
        }
      />

      {/* ========================================================
       * BESTAANDE PERIODES
       * ======================================================== */}

      <section>
        {periodesMetTotalen.length ===
        0 ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <p className="font-medium text-slate-900">
              Nog geen verloningsperiodes
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Het eerste overzicht verschijnt
              automatisch zodra een volledige
              maand definitief is geregistreerd
              of handmatig wordt gegenereerd.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-6 py-5">
              <h2 className="font-semibold text-slate-900">
                Maandoverzichten
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Iedere periode bevat het overzicht
                van definitief geregistreerde uren
                per medewerker en vestiging.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {periodesMetTotalen.map(
                (periode) => {
                  const maandNaam =
                    maandFormatter.format(
                      new Date(
                        periode.jaar,
                        periode.maand - 1,
                        1,
                      ),
                    );

                  const status =
                    periode.status ===
                    "KLAAR"
                      ? {
                          tekst: "Klaar",
                          klasse:
                            "bg-blue-50 text-blue-700",
                        }
                      : periode.status ===
                          "VERWERKT"
                        ? {
                            tekst:
                              "Verwerkt",
                            klasse:
                              "bg-emerald-50 text-emerald-700",
                          }
                        : {
                            tekst:
                              "Aangemaakt",
                            klasse:
                              "bg-slate-100 text-slate-700",
                          };

                  const datum =
                    periode.gegenereerdOp ??
                    periode.periodeStart;

                  return (
                    <a
                      key={periode.id}
                      href={`/verloning/${periode.id}`}
                      className="group block px-6 py-5 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 lg:min-w-[220px]">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-base font-semibold capitalize text-slate-900">
                              {maandNaam}{" "}
                              {periode.jaar}
                            </h3>

                            <span
                              className={[
                                "rounded-full px-3 py-1 text-xs font-medium",
                                status.klasse,
                              ].join(
                                " ",
                              )}
                            >
                              {status.tekst}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            Gegenereerd op{" "}
                            {datumFormatter.format(
                              new Date(
                                datum,
                              ),
                            )}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-6 lg:min-w-[440px]">
                          <div>
                            <p className="text-xs text-slate-500">
                              Medewerkers
                            </p>

                            <p className="mt-1 font-semibold text-slate-900">
                              {
                                periode.aantalMedewerkers
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Gewerkte dagen
                            </p>

                            <p className="mt-1 font-semibold text-slate-900">
                              {
                                periode.gewerkteDagen
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Gewerkte uren
                            </p>

                            <p className="mt-1 font-semibold text-slate-900">
                              {formatUren(
                                periode.gewerkteUren,
                              )}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 text-xl text-slate-400 transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                    </a>
                  );
                },
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}