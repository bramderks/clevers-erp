import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { berekenGewerkteUren } from "@/lib/verloning/pauze";

function formatDatum(datum: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(datum);
}

function tijdWaarde(datum: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(datum);
}

function combineerDatumEnTijd(
  datum: Date,
  tijd: string,
) {
  const [uren, minuten] = tijd.split(":").map(Number);

  const resultaat = new Date(datum);
  resultaat.setHours(
    uren,
    minuten,
    0,
    0,
  );

  return resultaat;
}

async function rondDienstAf(
  formData: FormData,
) {
  "use server";

  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    throw new Error("Je bent niet ingelogd.");
  }

  const bezettingId = String(
    formData.get("bezettingId") ?? "",
  );

  const begintijd = String(
    formData.get("begintijd") ?? "",
  );

  const eindtijd = String(
    formData.get("eindtijd") ?? "",
  );

  const opmerking = String(
    formData.get("opmerking") ?? "",
  ).trim();

  if (
    !bezettingId ||
    !begintijd ||
    !eindtijd
  ) {
    throw new Error(
      "Vul een begin- en eindtijd in.",
    );
  }

  const bezetting =
    await prisma.dienstBezetting.findUnique({
      where: {
        id: bezettingId,
      },
      include: {
        dienst: {
          include: {
            week: {
              include: {
                vestiging: {
                  select: {
                    id: true,
                    organisatieId: true,
                  },
                },
              },
            },
          },
        },
        urenregistratie: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

  if (
    !bezetting ||
    !bezetting.medewerkerId
  ) {
    throw new Error(
      "Deze dienstbezetting bestaat niet of heeft geen medewerker.",
    );
  }

  const organisatieId =
    bezetting.dienst.week.vestiging
      .organisatieId;

  if (
    !(await isEigenaar(
      organisatieId,
    ))
  ) {
    throw new Error(
      "Alleen de eigenaar mag een dagelijkse planning afronden.",
    );
  }

  if (
    bezetting.urenregistratie?.status ===
    "DEFINITIEF"
  ) {
    throw new Error(
      "Deze uren zijn al definitief en kunnen niet meer via de dagelijkse afronding worden gewijzigd.",
    );
  }

  const werkelijkeBegintijd =
    combineerDatumEnTijd(
      bezetting.dienst.datum,
      begintijd,
    );

  const werkelijkeEindtijd =
    combineerDatumEnTijd(
      bezetting.dienst.datum,
      eindtijd,
    );

  if (
    werkelijkeEindtijd <=
    werkelijkeBegintijd
  ) {
    throw new Error(
      "De eindtijd moet na de begintijd liggen.",
    );
  }

  const berekening =
    berekenGewerkteUren(
      werkelijkeBegintijd,
      werkelijkeEindtijd,
    );

  await prisma.$transaction([
    prisma.urenRegistratie.upsert({
      where: {
        dienstBezettingId:
          bezetting.id,
      },
      create: {
        dienstBezettingId:
          bezetting.id,
        medewerkerId:
          bezetting.medewerkerId,
        vestigingId:
          bezetting.dienst.week
            .vestigingId,
        datum:
          bezetting.dienst.datum,
        werkelijkeBegintijd,
        werkelijkeEindtijd,
        pauzeMinuten:
          berekening.pauzeMinuten,
        gewerkteUren:
          berekening.gewerkteUren,
        status: "TE_CONTROLEREN",
        opmerking:
          opmerking || null,
      },
      update: {
        werkelijkeBegintijd,
        werkelijkeEindtijd,
        pauzeMinuten:
          berekening.pauzeMinuten,
        gewerkteUren:
          berekening.gewerkteUren,
        status: "TE_CONTROLEREN",
        gecontroleerdDoorId: null,
        gecontroleerdOp: null,
        opmerking:
          opmerking || null,
      },
    }),

    prisma.dienstBezetting.update({
      where: {
        id: bezetting.id,
      },
      data: {
        status: "GEWERKT",
      },
    }),
  ]);

  revalidatePath("/app/afronden");
  revalidatePath("/app");
  revalidatePath("/uren");
}

export default async function AppAfrondenPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/afronden");
  }

  const eigenaarOrganisatieIds =
    gebruiker.organisaties
      .filter(
        (relatie) =>
          relatie.actief &&
          relatie.organisatie.actief &&
          relatie.rol.naam
            .trim()
            .toLowerCase() ===
            "eigenaar",
      )
      .map(
        (relatie) =>
          relatie.organisatieId,
      );

  if (
    eigenaarOrganisatieIds.length === 0
  ) {
    redirect("/app");
  }

  const vandaag = new Date();
  const morgen = new Date(
    vandaag.getFullYear(),
    vandaag.getMonth(),
    vandaag.getDate() + 1,
  );
  const vandaagBegin = new Date(
    vandaag.getFullYear(),
    vandaag.getMonth(),
    vandaag.getDate(),
  );

  const bezettingen =
    await prisma.dienstBezetting.findMany({
      where: {
        medewerkerId: {
          not: null,
        },
        dienst: {
          datum: {
            gte: vandaagBegin,
            lt: morgen,
          },
          week: {
            vestiging: {
              organisatieId: {
                in: eigenaarOrganisatieIds,
              },
            },
          },
        },
      },
      include: {
        medewerker: {
          select: {
            voornaam: true,
            tussenvoegsel: true,
            achternaam: true,
          },
        },
        dienst: {
          include: {
            week: {
              include: {
                vestiging: {
                  select: {
                    naam: true,
                  },
                },
              },
            },
          },
        },
        urenregistratie: {
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        dienst: {
          begintijd: "asc",
        },
      },
    });

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Clevers · Eigenaar
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              Dag afronden
            </h1>
          </div>

          <Link
            href="/app"
            className="text-sm font-semibold text-slate-700"
          >
            Terug
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-bold capitalize text-slate-900">
            {formatDatum(vandaag)}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Vul de werkelijk gewerkte begin- en eindtijd in. Pas na afronding wordt de dienst als gewerkt geregistreerd en komen de uren beschikbaar voor controle en verloning.
          </p>
        </section>

        {bezettingen.length === 0 ? (
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">
              Geen geplande medewerkers voor vandaag
            </p>
          </section>
        ) : (
          bezettingen.map((bezetting) => {
            const naam = [
              bezetting.medewerker?.voornaam,
              bezetting.medewerker?.tussenvoegsel,
              bezetting.medewerker?.achternaam,
            ]
              .filter(Boolean)
              .join(" ");

            const definitief =
              bezetting.urenregistratie?.status ===
              "DEFINITIEF";

            return (
              <form
                key={bezetting.id}
                action={rondDienstAf}
                className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              >
                <input
                  type="hidden"
                  name="bezettingId"
                  value={bezetting.id}
                />

                <div>
                  <h2 className="font-bold text-slate-900">
                    {naam}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {bezetting.dienst.week.vestiging.naam}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-slate-700">
                    Begin
                    <input
                      type="time"
                      name="begintijd"
                      defaultValue={tijdWaarde(
                        bezetting.dienst.begintijd,
                      )}
                      disabled={definitief}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900"
                    />
                  </label>

                  <label className="text-sm font-medium text-slate-700">
                    Eind
                    <input
                      type="time"
                      name="eindtijd"
                      defaultValue={tijdWaarde(
                        bezetting.dienst.eindtijd,
                      )}
                      disabled={definitief}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900"
                    />
                  </label>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Opmerking
                  <textarea
                    name="opmerking"
                    disabled={definitief}
                    placeholder="Eventuele afwijking of opmerking"
                    className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900"
                  />
                </label>

                {definitief ? (
                  <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    Deze uren zijn al definitief.
                  </p>
                ) : (
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
                  >
                    Dienst afronden
                  </button>
                )}
              </form>
            );
          })
        )}
      </div>
    </main>
  );
}
