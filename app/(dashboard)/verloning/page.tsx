import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function VerloningPage() {
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
    redirect("/dashboard");
  }

  const isEigenaar =
    organisaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "eigenaar",
    );

  if (!isEigenaar) {
    redirect("/dashboard");
  }

  const periodes =
    await prisma.verloningsPeriode.findMany({
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
          select: {
            medewerkerId: true,
            gewerkteDagen: true,
            gewerkteUren: true,
          },
        },
      },
    });

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
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Verloning
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Automatisch aangemaakte
          maandoverzichten van gewerkte uren.
        </p>
      </div>

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
              maand definitief is geregistreerd.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-6 py-5">
              <h2 className="font-semibold text-slate-900">
                Maandoverzichten
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Iedere maand wordt automatisch
                toegevoegd zodra alle uren definitief
                zijn.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {periodesMetTotalen.map(
                (periode) => {
                  const maandNaam =
                    maandFormatter.format(
                      new Date(
                        periode.jaar,
                        periode.maand -
                          1,
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
                              "bg-green-50 text-green-700",
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
                              {
                                status.tekst
                              }
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
                              {periode.gewerkteUren
                                .toFixed(
                                  2,
                                )
                                .replace(
                                  ".",
                                  ",",
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