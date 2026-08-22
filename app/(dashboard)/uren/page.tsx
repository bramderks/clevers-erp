import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      "Alleen de eigenaar kan uren controleren.",
    );
  }

  return {
    gebruiker,
    organisaties,
  };
}

async function keurUrenGoed(
  urenRegistratieId: string,
) {
  "use server";

  const {
    gebruiker,
    organisaties,
  } = await controleerEigenaar();

  const organisatieIds =
    organisaties.map(
      (relatie) =>
        relatie.organisatieId,
    );

  const registratie =
    await prisma.urenRegistratie.findUnique(
      {
        where: {
          id: urenRegistratieId,
        },
        select: {
          id: true,
          status: true,
          vestiging: {
            select: {
              organisatieId: true,
            },
          },
        },
      },
    );

  if (!registratie) {
    throw new Error(
      "De urenregistratie bestaat niet.",
    );
  }

  if (
    !organisatieIds.includes(
      registratie.vestiging.organisatieId,
    )
  ) {
    throw new Error(
      "Je hebt geen toegang tot deze urenregistratie.",
    );
  }

  if (
    registratie.status !==
    "TE_CONTROLEREN"
  ) {
    throw new Error(
      "Deze urenregistratie hoeft niet meer te worden gecontroleerd.",
    );
  }

  await prisma.urenRegistratie.update({
    where: {
      id: registratie.id,
    },
    data: {
      status: "DEFINITIEF",
      gecontroleerdDoorId:
        gebruiker.id,
      gecontroleerdOp: new Date(),
    },
  });

  revalidatePath("/uren");
  revalidatePath("/dashboard");
}

async function keurUrenAf(
  formData: FormData,
) {
  "use server";

  const {
    gebruiker,
    organisaties,
  } = await controleerEigenaar();

  const urenRegistratieId =
    String(
      formData.get(
        "urenRegistratieId",
      ) ?? "",
    );

  const reden =
    String(
      formData.get("reden") ?? "",
    ).trim();

  if (!urenRegistratieId) {
    throw new Error(
      "De urenregistratie ontbreekt.",
    );
  }

  if (!reden) {
    throw new Error(
      "Geef bij afkeuren altijd een reden op.",
    );
  }

  const organisatieIds =
    organisaties.map(
      (relatie) =>
        relatie.organisatieId,
    );

  const registratie =
    await prisma.urenRegistratie.findUnique(
      {
        where: {
          id: urenRegistratieId,
        },
        select: {
          id: true,
          status: true,
          vestiging: {
            select: {
              organisatieId: true,
            },
          },
        },
      },
    );

  if (!registratie) {
    throw new Error(
      "De urenregistratie bestaat niet.",
    );
  }

  if (
    !organisatieIds.includes(
      registratie.vestiging.organisatieId,
    )
  ) {
    throw new Error(
      "Je hebt geen toegang tot deze urenregistratie.",
    );
  }

  if (
    registratie.status !==
    "TE_CONTROLEREN"
  ) {
    throw new Error(
      "Deze urenregistratie hoeft niet meer te worden gecontroleerd.",
    );
  }

  await prisma.urenRegistratie.update({
    where: {
      id: registratie.id,
    },
    data: {
      status: "AFGEKEURD",
      gecontroleerdDoorId:
        gebruiker.id,
      gecontroleerdOp: new Date(),
      opmerking: reden,
    },
  });

  revalidatePath("/uren");
  revalidatePath("/dashboard");
}

function formatDatum(
  datum: Date,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(datum);
}

function formatTijd(
  datum: Date,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
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

export default async function UrenPage() {
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

  const organisatieIds =
    organisaties.map(
      (relatie) =>
        relatie.organisatieId,
    );

  const registraties =
    await prisma.urenRegistratie.findMany(
      {
        where: {
          status: "TE_CONTROLEREN",
          vestiging: {
            organisatieId: {
              in: organisatieIds,
            },
          },
        },
        select: {
          id: true,
          datum: true,
          werkelijkeBegintijd: true,
          werkelijkeEindtijd: true,
          pauzeMinuten: true,
          gewerkteUren: true,
          taak: true,
          opmerking: true,
          medewerker: {
            select: {
              id: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
              personeelsnummer: true,
            },
          },
          vestiging: {
            select: {
              id: true,
              naam: true,
            },
          },
        },
        orderBy: [
          {
            datum: "asc",
          },
          {
            medewerker: {
              achternaam: "asc",
            },
          },
          {
            medewerker: {
              voornaam: "asc",
            },
          },
        ],
      },
    );

  const aantalTeControleren =
    registraties.length;

  const medewerkers =
    new Set(
      registraties.map(
        (registratie) =>
          registratie.medewerker.id,
      ),
    ).size;

  const totaalUren =
    registraties.reduce(
      (totaal, registratie) =>
        totaal +
        Number(
          registratie.gewerkteUren,
        ),
      0,
    );

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Uren controleren
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Controleer de gewerkte uren voordat
          deze definitief worden opgenomen in de
          verloning.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Nog te controleren
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {aantalTeControleren}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Medewerkers
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {medewerkers}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Uren ter controle
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {totaalUren
              .toFixed(2)
              .replace(".", ",")}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-6 py-5">
          <h2 className="font-semibold text-slate-900">
            Openstaande uren
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Alleen uren die nog gecontroleerd
            moeten worden worden hier getoond.
          </p>
        </div>

        {registraties.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              ✓
            </div>

            <p className="mt-4 font-medium text-slate-900">
              Alle uren zijn gecontroleerd
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Er staan momenteel geen uren meer
              open voor controle.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {registraties.map(
              (registratie) => (
                <div
                  key={registratie.id}
                  className="px-6 py-5"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-semibold text-slate-900">
                          {formatNaam(
                            registratie.medewerker,
                          )}
                        </h3>

                        {registratie.medewerker
                          .personeelsnummer && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {
                              registratie
                                .medewerker
                                .personeelsnummer
                            }
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span>
                          {
                            registratie
                              .vestiging
                              .naam
                          }
                        </span>

                        <span>
                          {formatDatum(
                            new Date(
                              registratie.datum,
                            ),
                          )}
                        </span>

                        {registratie.taak && (
                          <span>
                            {
                              registratie.taak
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-5 text-sm xl:min-w-[430px]">
                      <div>
                        <p className="text-xs text-slate-500">
                          Gewerkt
                        </p>

                        <p className="mt-1 font-semibold text-slate-900">
                          {formatTijd(
                            new Date(
                              registratie.werkelijkeBegintijd,
                            ),
                          )}{" "}
                          -{" "}
                          {formatTijd(
                            new Date(
                              registratie.werkelijkeEindtijd,
                            ),
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Pauze
                        </p>

                        <p className="mt-1 font-semibold text-slate-900">
                          {
                            registratie.pauzeMinuten
                          }{" "}
                          min.
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Uren
                        </p>

                        <p className="mt-1 font-semibold text-slate-900">
                          {Number(
                            registratie.gewerkteUren,
                          )
                            .toFixed(2)
                            .replace(
                              ".",
                              ",",
                            )}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col">
                      <form
                        action={async () => {
                          "use server";

                          await keurUrenGoed(
                            registratie.id,
                          );
                        }}
                      >
                        <button
                          type="submit"
                          className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Goedkeuren
                        </button>
                      </form>

                      <details className="group">
                        <summary className="cursor-pointer list-none rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-center text-sm font-semibold text-red-700 transition hover:bg-red-100">
                          Afkeuren
                        </summary>

                        <form
                          action={
                            keurUrenAf
                          }
                          className="mt-3 w-full rounded-lg border border-red-100 bg-red-50 p-3"
                        >
                          <input
                            type="hidden"
                            name="urenRegistratieId"
                            value={
                              registratie.id
                            }
                          />

                          <label
                            htmlFor={`reden-${registratie.id}`}
                            className="text-xs font-medium text-red-800"
                          >
                            Reden van afkeuren
                          </label>

                          <textarea
                            id={`reden-${registratie.id}`}
                            name="reden"
                            required
                            rows={3}
                            placeholder="Bijvoorbeeld: eindtijd klopt niet."
                            className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-red-500 placeholder:text-slate-400 focus:ring-2"
                          />

                          <button
                            type="submit"
                            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                          >
                            Uren afkeuren
                          </button>
                        </form>
                      </details>
                    </div>
                  </div>

                  {registratie.opmerking && (
                    <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-xs font-medium text-slate-500">
                        Opmerking
                      </p>

                      <p className="mt-1 text-sm text-slate-700">
                        {
                          registratie.opmerking
                        }
                      </p>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  );
}