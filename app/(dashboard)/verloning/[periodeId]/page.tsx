import Link from "next/link";
import {
  revalidatePath,
} from "next/cache";
import {
  redirect,
} from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import VerwerkVerloningButton from "./VerwerkVerloningButton";

function formatUren(
  uren: number,
) {
  return uren
    .toFixed(2)
    .replace(".", ",");
}

function formatDatum(
  datum: Date,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(datum);
}

function formatNaam(
  medewerker: {
    voornaam: string;
    tussenvoegsel: string | null;
    achternaam: string;
  },
) {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

function statusGegevens(
  status: string,
) {
  switch (status) {
    case "KLAAR":
      return {
        tekst: "Klaar",
        klasse:
          "bg-blue-50 text-blue-700",
      };

    case "VERWERKT":
      return {
        tekst: "Verwerkt",
        klasse:
          "bg-emerald-50 text-emerald-700",
      };

    default:
      return {
        tekst: "Aangemaakt",
        klasse:
          "bg-slate-100 text-slate-700",
      };
  }
}

async function controleerEigenaar() {
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

  const isEigenaar =
    organisaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "eigenaar",
    );

  if (!isEigenaar) {
    throw new Error(
      "Alleen de eigenaar kan een verloningsperiode verwerken.",
    );
  }

  return {
    gebruiker,
    organisaties,
  };
}

type VerloningDetailPageProps = {
  params: Promise<{
    periodeId: string;
  }>;
};

export default async function VerloningDetailPage({
  params,
}: VerloningDetailPageProps) {
  const { periodeId } =
    await params;

  const gebruiker =
    await getCurrentUser();

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

  const periode =
    await prisma.verloningsPeriode.findUnique(
      {
        where: {
          id: periodeId,
        },

        include: {
          regels: {
            include: {
              medewerker: {
                select: {
                  id: true,
                  voornaam: true,
                  tussenvoegsel: true,
                  achternaam: true,
                  personeelsnummer: true,
                  actief: true,
                },
              },

              vestiging: {
                select: {
                  id: true,
                  naam: true,
                  organisatieId: true,
                },
              },
            },

            orderBy: [
              {
                medewerkerNaam: "asc",
              },
              {
                vestiging: {
                  naam: "asc",
                },
              },
            ],
          },
        },
      },
    );

  if (!periode) {
    redirect("/verloning");
  }

  const organisatieIds =
    organisaties.map(
      (relatie) =>
        relatie.organisatieId,
    );

  const heeftToegang =
    periode.regels.every(
      (regel) =>
        organisatieIds.includes(
          regel.vestiging.organisatieId,
        ),
    );

  if (!heeftToegang) {
    redirect("/verloning");
  }

  async function verwerkVerloning() {
    "use server";

    const {
      gebruiker: huidigeGebruiker,
      organisaties: huidigeOrganisaties,
    } = await controleerEigenaar();

    const huidigeOrganisatieIds =
      huidigeOrganisaties.map(
        (relatie) =>
          relatie.organisatieId,
      );

    const huidigePeriode =
      await prisma.verloningsPeriode.findUnique(
        {
          where: {
            id: periodeId,
          },

          select: {
            id: true,
            status: true,

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

    if (!huidigePeriode) {
      throw new Error(
        "De verloningsperiode bestaat niet.",
      );
    }

    const heeftToegangTotPeriode =
      huidigePeriode.regels.every(
        (regel) =>
          huidigeOrganisatieIds.includes(
            regel.vestiging.organisatieId,
          ),
      );

    if (!heeftToegangTotPeriode) {
      throw new Error(
        "Je hebt geen toegang tot deze verloningsperiode.",
      );
    }

    if (
      huidigePeriode.status ===
      "VERWERKT"
    ) {
      throw new Error(
        "Deze verloningsperiode is al verwerkt.",
      );
    }

    if (
      huidigePeriode.status !==
      "KLAAR"
    ) {
      throw new Error(
        "Alleen een verloningsperiode met status KLAAR kan worden verwerkt.",
      );
    }

    await prisma.verloningsPeriode.update(
      {
        where: {
          id: huidigePeriode.id,
        },

        data: {
          status: "VERWERKT",

          gecontroleerdDoorId:
            huidigeGebruiker.id,

          gecontroleerdOp:
            new Date(),
        },
      },
    );

    revalidatePath("/verloning");

    revalidatePath(
      `/verloning/${periodeId}`,
    );

    revalidatePath("/dashboard");
  }

  const maandFormatter =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        month: "long",
        year: "numeric",
      },
    );

  const periodeNaam =
    maandFormatter.format(
      new Date(
        periode.jaar,
        periode.maand - 1,
        1,
      ),
    );

  const status =
    statusGegevens(
      periode.status,
    );

  const totaalMedewerkers =
    new Set(
      periode.regels.map(
        (regel) =>
          regel.medewerkerId,
      ),
    ).size;

  const totaalRegels =
    periode.regels.length;

  const totaalDagen =
    periode.regels.reduce(
      (totaal, regel) =>
        totaal +
        regel.gewerkteDagen,
      0,
    );

  const totaalUren =
    periode.regels.reduce(
      (totaal, regel) =>
        totaal +
        Number(
          regel.gewerkteUren,
        ),
      0,
    );

  return (
    <main className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/verloning"
            className="inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            ← Terug naar verloning
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold capitalize text-slate-900">
              {periodeNaam}
            </h1>

            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-medium",
                status.klasse,
              ].join(" ")}
            >
              {status.tekst}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            Overzicht van de definitief
            geregistreerde gewerkte uren
            voor deze verloningsperiode.
          </p>
        </div>

        <div className="rounded-xl border bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">
            Periode
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatDatum(
              new Date(
                periode.periodeStart,
              ),
            )}{" "}
            t/m{" "}
            {formatDatum(
              new Date(
                periode.periodeEinde,
              ),
            )}
          </p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Medewerkers
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {totaalMedewerkers}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Verloningsregels
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {totaalRegels}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Gewerkte dagen
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {totaalDagen}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Gewerkte uren
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {formatUren(
              totaalUren,
            )}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Medewerkers
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Overzicht van alle medewerkers
              en vestigingen binnen deze
              verloningsperiode.
            </p>
          </div>

          <span className="text-sm text-slate-500">
            {totaalRegels}{" "}
            {totaalRegels === 1
              ? "regel"
              : "regels"}
          </span>
        </div>

        {periode.regels.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-medium text-slate-900">
              Geen verloningsregels
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Voor deze periode zijn nog geen
              medewerkers opgenomen.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {periode.regels.map(
              (regel) => (
                <div
                  key={regel.id}
                  className="px-6 py-5"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-semibold text-slate-900">
                          {regel.medewerkerNaam ||
                            formatNaam(
                              regel.medewerker,
                            )}
                        </h3>

                        {regel.medewerker
                          .personeelsnummer && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {
                              regel.medewerker
                                .personeelsnummer
                            }
                          </span>
                        )}

                        {!regel.medewerker
                          .actief && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            Niet actief
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {
                          regel.vestiging
                            .naam
                        }
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 text-sm sm:min-w-[280px]">
                      <div>
                        <p className="text-xs text-slate-500">
                          Gewerkte dagen
                        </p>

                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {
                            regel.gewerkteDagen
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Gewerkte uren
                        </p>

                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatUren(
                            Number(
                              regel.gewerkteUren,
                            ),
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        <div className="border-t bg-slate-50 px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Totaal verloningsperiode
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Totaal van alle definitief
                geregistreerde uren.
              </p>
            </div>

            <div className="flex gap-8 text-right">
              <div>
                <p className="text-xs text-slate-500">
                  Dagen
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {totaalDagen}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Uren
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {formatUren(
                    totaalUren,
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">
          Verwerking
        </h2>

        {periode.status ===
        "VERWERKT" ? (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-4">
            <p className="font-medium text-emerald-800">
              Deze verloningsperiode is verwerkt.
            </p>

            {periode.gecontroleerdOp && (
              <p className="mt-1 text-sm text-emerald-700">
                Verwerkt op{" "}
                {formatDatum(
                  new Date(
                    periode.gecontroleerdOp,
                  ),
                )}
              </p>
            )}
          </div>
        ) : periode.status ===
          "KLAAR" ? (
          <div className="mt-4">
            <div className="rounded-lg bg-blue-50 px-4 py-4">
              <p className="font-medium text-blue-800">
                Deze verloningsperiode is klaar
                voor verwerking.
              </p>

              <p className="mt-1 text-sm text-blue-700">
                Controleer het overzicht voordat
                de periode definitief wordt
                verwerkt.
              </p>
            </div>

            <VerwerkVerloningButton
              verwerkAction={
                verwerkVerloning
              }
            />
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-4">
            <p className="font-medium text-slate-800">
              Deze periode wordt nog opgebouwd.
            </p>

            <p className="mt-1 text-sm text-slate-600">
              Zodra alle gegevens volledig zijn,
              kan de periode worden verwerkt.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}