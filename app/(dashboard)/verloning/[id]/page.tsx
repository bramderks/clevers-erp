import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type VerloningDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatUren(uren: number) {
  return uren
    .toFixed(2)
    .replace(".", ",");
}

function volledigeNaam(
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

export default async function VerloningDetailPage({
  params,
}: VerloningDetailPageProps) {
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

  const { id } = await params;

  const organisatieIds =
    organisaties.map(
      (relatie) =>
        relatie.organisatieId,
    );

  const periode =
    await prisma.verloningsPeriode.findUnique(
      {
        where: {
          id,
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
          },
        },
      },
    );

  if (!periode) {
    notFound();
  }

  const regels = periode.regels.filter(
    (regel) =>
      organisatieIds.includes(
        regel.vestiging.organisatieId,
      ),
  );

  const maandNaam =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        month: "long",
      },
    ).format(
      new Date(
        periode.jaar,
        periode.maand - 1,
        1,
      ),
    );

  const vestigingen = Array.from(
    new Map(
      regels.map((regel) => [
        regel.vestiging.id,
        regel.vestiging,
      ]),
    ).values(),
  ).sort((a, b) =>
    a.naam.localeCompare(
      b.naam,
      "nl",
    ),
  );

  const totaalMedewerkers =
    new Set(
      regels.map(
        (regel) =>
          regel.medewerkerId,
      ),
    ).size;

  const totaalDagen =
    regels.reduce(
      (totaal, regel) =>
        totaal +
        regel.gewerkteDagen,
      0,
    );

  const totaalUren =
    regels.reduce(
      (totaal, regel) =>
        totaal +
        Number(
          regel.gewerkteUren,
        ),
      0,
    );

  const status =
    periode.status === "KLAAR"
      ? {
          tekst: "Klaar",
          klasse:
            "bg-blue-50 text-blue-700",
        }
      : periode.status ===
          "VERWERKT"
        ? {
            tekst: "Verwerkt",
            klasse:
              "bg-emerald-50 text-emerald-700",
          }
        : {
            tekst: "Aangemaakt",
            klasse:
              "bg-slate-100 text-slate-700",
          };

  return (
    <main className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <a
            href="/verloning"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            ← Terug naar verloning
          </a>

          <h1 className="mt-3 text-2xl font-semibold capitalize text-slate-900">
            {maandNaam} {periode.jaar}
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Overzicht van gewerkte dagen en uren
            per medewerker en vestiging.
          </p>
        </div>

        <span
          className={[
            "w-fit rounded-full px-3 py-1.5 text-xs font-medium",
            status.klasse,
          ].join(" ")}
        >
          {status.tekst}
        </span>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
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

      <section className="space-y-6">
        {vestigingen.map((vestiging) => {
          const vestigingRegels =
            regels
              .filter(
                (regel) =>
                  regel.vestigingId ===
                  vestiging.id,
              )
              .sort((a, b) => {
                const achternaam =
                  a.medewerker.achternaam.localeCompare(
                    b.medewerker.achternaam,
                    "nl",
                  );

                if (achternaam !== 0) {
                  return achternaam;
                }

                return a.medewerker.voornaam.localeCompare(
                  b.medewerker.voornaam,
                  "nl",
                );
              });

          const medewerkers =
            new Set(
              vestigingRegels.map(
                (regel) =>
                  regel.medewerkerId,
              ),
            ).size;

          const dagen =
            vestigingRegels.reduce(
              (totaal, regel) =>
                totaal +
                regel.gewerkteDagen,
              0,
            );

          const uren =
            vestigingRegels.reduce(
              (totaal, regel) =>
                totaal +
                Number(
                  regel.gewerkteUren,
                ),
              0,
            );

          return (
            <section
              key={vestiging.id}
              className="overflow-hidden rounded-xl border bg-white shadow-sm"
            >
              <div className="border-b bg-slate-50 px-6 py-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {vestiging.naam}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {medewerkers}{" "}
                      {medewerkers === 1
                        ? "medewerker"
                        : "medewerkers"}
                    </p>
                  </div>

                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-slate-500">
                        Dagen
                      </span>

                      <strong className="ml-2 text-slate-900">
                        {dagen}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-500">
                        Uren
                      </span>

                      <strong className="ml-2 text-slate-900">
                        {formatUren(uren)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-6 py-4">
                        Medewerker
                      </th>

                      <th className="px-6 py-4">
                        Personeelsnummer
                      </th>

                      <th className="px-6 py-4 text-right">
                        Gewerkte dagen
                      </th>

                      <th className="px-6 py-4 text-right">
                        Gewerkte uren
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {vestigingRegels.map(
                      (regel) => (
                        <tr
                          key={regel.id}
                          className="text-sm"
                        >
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {volledigeNaam(
                              regel.medewerker,
                            )}
                          </td>

                          <td className="px-6 py-4 text-slate-500">
                            {regel.medewerker
                              .personeelsnummer ||
                              "—"}
                          </td>

                          <td className="px-6 py-4 text-right text-slate-700">
                            {
                              regel.gewerkteDagen
                            }
                          </td>

                          <td className="px-6 py-4 text-right font-semibold text-slate-900">
                            {formatUren(
                              Number(
                                regel.gewerkteUren,
                              ),
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>

                  <tfoot>
                    <tr className="border-t bg-slate-50 text-sm font-semibold">
                      <td
                        colSpan={2}
                        className="px-6 py-4 text-slate-900"
                      >
                        Totaal{" "}
                        {vestiging.naam}
                      </td>

                      <td className="px-6 py-4 text-right text-slate-900">
                        {dagen}
                      </td>

                      <td className="px-6 py-4 text-right text-slate-900">
                        {formatUren(uren)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          );
        })}
      </section>

      {regels.length === 0 && (
        <section className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-slate-900">
            Geen uren geregistreerd
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Voor deze verloningsperiode zijn geen
            definitieve uren gevonden.
          </p>
        </section>
      )}
    </main>
  );
}