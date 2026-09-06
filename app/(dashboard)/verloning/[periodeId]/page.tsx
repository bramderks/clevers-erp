import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { controleerVerloning } from "@/lib/verloning/controleerVerloning";
import { verwerkVerloning } from "@/lib/verloning/verwerkVerloning";

import VerwerkVerloningButton from "./VerwerkVerloningButton";

type VerloningDetailPageProps = {
  params: Promise<{
    periodeId: string;
  }>;
};

function formatUren(uren: number) {
  return uren
    .toFixed(2)
    .replace(".", ",");
}

function formatDatum(datum: Date) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(datum);
}

function formatDatumTijd(datum: Date) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

function statusGegevens(status: string) {
  switch (status) {
    case "KLAAR":
      return {
        tekst: "Klaar",
        klasse: "bg-blue-50 text-blue-700",
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

export default async function VerloningDetailPage({
  params,
}: VerloningDetailPageProps) {
  const { periodeId } = await params;

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

  const isEigenaar = organisaties.some(
    (relatie) =>
      relatie.rol.naam
        .trim()
        .toLowerCase() ===
      "eigenaar",
  );

  if (!isEigenaar) {
    redirect("/dashboard");
  }

  const organisatieIds = organisaties.map(
    (relatie) => relatie.organisatieId,
  );

  const periode =
    await prisma.verloningsPeriode.findUnique({
      where: {
        id: periodeId,
      },

      include: {
        regels: {
          where: {
            vestiging: {
              organisatieId: {
                in: organisatieIds,
              },
            },
          },

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

        controles: {
          orderBy: {
            medewerkerId: "asc",
          },

          select: {
            id: true,
            medewerkerId: true,
            status: true,
            gecontroleerdOp: true,
            automatischAkkoordOp: true,
          },
        },
      },
    });

  if (!periode || periode.regels.length === 0) {
    redirect("/verloning");
  }

  const periodeNaam =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        month: "long",
        year: "numeric",
      },
    ).format(
      new Date(
        periode.jaar,
        periode.maand - 1,
        1,
      ),
    );

  const status = statusGegevens(
    periode.status,
  );

  const totaalMedewerkers =
    new Set(
      periode.regels.map(
        (regel) => regel.medewerkerId,
      ),
    ).size;

  const totaalRegels = periode.regels.length;

  const totaalDagen =
    periode.regels.reduce(
      (totaal, regel) =>
        totaal + regel.gewerkteDagen,
      0,
    );

  const totaalUren =
    periode.regels.reduce(
      (totaal, regel) =>
        totaal + Number(regel.gewerkteUren),
      0,
    );

  const controlePerMedewerker =
    new Map(
      periode.controles.map((controle) => [
        controle.medewerkerId,
        controle,
      ]),
    );

  const nu = new Date();

  const controleGestart =
    periode.controleStart !== null &&
    nu >= periode.controleStart;

  const controleVerlopen =
    periode.controleDeadline !== null &&
    nu > periode.controleDeadline;

  const eigenaarGecontroleerd =
    periode.gecontroleerdDoorId !== null &&
    periode.gecontroleerdOp !== null;

  const controleAantal = periode.controles.length;

  const akkoordAantal =
    periode.controles.filter(
      (controle) =>
        controle.status === "AKKOORD" ||
        controle.status ===
          "AUTOMATISCH_AKKOORD",
    ).length;

  const openAantal =
    periode.controles.filter(
      (controle) =>
        controle.status === "OPEN",
    ).length;

  async function controleerPeriode() {
    "use server";

    await controleerVerloning(
      periodeId,
    );

    revalidatePath(
      `/verloning/${periodeId}`,
    );
    revalidatePath("/verloning");
    revalidatePath("/dashboard");
  }

  async function verwerkPeriode() {
    "use server";

    await verwerkVerloning(
      periodeId,
    );

    revalidatePath(
      `/verloning/${periodeId}`,
    );
    revalidatePath("/verloning");
    revalidatePath("/dashboard");
  }

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
            geregistreerde gewerkte uren voor
            deze verloningsperiode.
          </p>
        </div>

        <div className="rounded-xl border bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">
            Periode
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatDatum(
              new Date(periode.periodeStart),
            )}{" "}
            t/m{" "}
            {formatDatum(
              new Date(periode.periodeEinde),
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
            {formatUren(totaalUren)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Controleperiode
            </h2>

            {periode.controleStart &&
              periode.controleDeadline ? (
              <p className="mt-1 text-sm text-slate-500">
                {formatDatumTijd(
                  new Date(
                    periode.controleStart,
                  ),
                )}{" "}
                t/m{" "}
                {formatDatumTijd(
                  new Date(
                    periode.controleDeadline,
                  ),
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-red-600">
                Voor deze periode is geen
                controleperiode ingesteld.
              </p>
            )}
          </div>

          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              {akkoordAantal}
            </span>{" "}
            van {controleAantal} akkoord
            {openAantal > 0 && (
              <span className="ml-2 text-amber-700">
                · {openAantal} open
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Controle gestart
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {controleGestart
                ? "Ja"
                : "Nog niet"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Deadline
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {controleVerlopen
                ? "Verlopen"
                : "Open"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Eigenaarcontrole
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {eigenaarGecontroleerd
                ? "Gecontroleerd"
                : "Nog niet gecontroleerd"}
            </p>
          </div>
        </div>

        {periode.status === "KLAAR" &&
          !controleVerlopen &&
          !eigenaarGecontroleerd && (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="font-medium text-blue-900">
              Controle door eigenaar
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Controleer de volledige
              verloningsperiode tijdens het
              controlevenster. Daarna wordt de
              periode pas definitief verwerkt.
            </p>

            <form
              action={controleerPeriode}
              className="mt-4"
            >
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Verloning controleren
              </button>
            </form>
          </div>
        )}

        {eigenaarGecontroleerd && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-medium text-emerald-900">
              Volledige verloningsperiode
              gecontroleerd.
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Gecontroleerd op{" "}
              {formatDatumTijd(
                new Date(
                  periode.gecontroleerdOp!,
                ),
              )}
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Medewerkers
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Overzicht van alle medewerkers en
              vestigingen binnen deze
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

        <div className="divide-y divide-slate-100">
          {periode.regels.map((regel) => {
            const controle =
              controlePerMedewerker.get(
                regel.medewerkerId,
              );

            const controleStatus =
              controle?.status ??
              "OPEN";

            const controleTekst =
              controleStatus === "AKKOORD"
                ? "Akkoord"
                : controleStatus ===
                    "AUTOMATISCH_AKKOORD"
                  ? "Automatisch akkoord"
                  : "Open – controleren";

            const controleKlasse =
              controleStatus === "AKKOORD"
                ? "bg-emerald-50 text-emerald-700"
                : controleStatus ===
                    "AUTOMATISCH_AKKOORD"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-amber-50 text-amber-700";

            return (
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

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${controleKlasse}`}
                      >
                        {controleTekst}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      {regel.vestiging.naam}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-8 text-sm sm:min-w-[280px]">
                    <div>
                      <p className="text-xs text-slate-500">
                        Gewerkte dagen
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {regel.gewerkteDagen}
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

                {controle &&
                  controleStatus ===
                    "AKKOORD" &&
                  controle.gecontroleerdOp && (
                  <p className="mt-3 text-xs text-emerald-700">
                    Medewerker akkoord op{" "}
                    {formatDatumTijd(
                      new Date(
                        controle.gecontroleerdOp,
                      ),
                    )}
                  </p>
                )}

                {controle &&
                  controleStatus ===
                    "AUTOMATISCH_AKKOORD" &&
                  controle.automatischAkkoordOp && (
                  <p className="mt-3 text-xs text-blue-700">
                    Automatisch akkoord op{" "}
                    {formatDatumTijd(
                      new Date(
                        controle.automatischAkkoordOp,
                      ),
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>

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
                  {formatUren(totaalUren)}
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

        {periode.status === "VERWERKT" ? (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-4">
            <p className="font-medium text-emerald-800">
              Deze verloningsperiode is verwerkt.
            </p>

            {periode.gecontroleerdOp && (
              <p className="mt-1 text-sm text-emerald-700">
                Verwerkt op{" "}
                {formatDatumTijd(
                  new Date(
                    periode.gecontroleerdOp,
                  ),
                )}
              </p>
            )}
          </div>
        ) : periode.status === "KLAAR" ? (
          <div className="mt-4">
            {controleVerlopen &&
            eigenaarGecontroleerd ? (
              <>
                <div className="rounded-lg bg-blue-50 px-4 py-4">
                  <p className="font-medium text-blue-800">
                    De controleperiode is verlopen.
                  </p>
                  <p className="mt-1 text-sm text-blue-700">
                    De verloning kan nu definitief
                    worden verwerkt.
                  </p>
                </div>

                <VerwerkVerloningButton
                  verwerkAction={
                    verwerkPeriode
                  }
                />
              </>
            ) : (
              <div className="rounded-lg bg-slate-50 px-4 py-4">
                <p className="font-medium text-slate-800">
                  Deze periode kan nog niet
                  definitief worden verwerkt.
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Eerst moet de controleperiode
                  verlopen en de eigenaar moet de
                  volledige periode hebben
                  gecontroleerd.
                </p>
              </div>
            )}
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
