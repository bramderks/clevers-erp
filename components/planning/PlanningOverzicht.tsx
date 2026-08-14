"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import DienstDetail from "@/components/planning/DienstDetail";
import DienstForm from "@/components/planning/DienstForm";
import type {
  Dienst,
  PlanningWeek,
} from "@/types/planning";

type PlanningOverzichtProps = {
  weken: PlanningWeek[];
  vestigingId: string;
  isEigenaar?: boolean;
  isTeamleider?: boolean;
  isMedewerker?: boolean;
  kanVerwijderen?: boolean;
  onGewijzigd?: () => void;
};

type KalenderDag = {
  datum: Date;
  datumString: string;
  diensten: PlanningWeek["diensten"];
};

type Weergave = "week" | "maand";

const PLANNING_TAGS = [
  "Leidinggevende",
  "Coupes",
  "Handijs",
  "Bediening",
  "Vaatstraat",
] as const;

function maakDatumString(datum: Date) {
  const jaar = datum.getFullYear();
  const maand = String(
    datum.getMonth() + 1,
  ).padStart(2, "0");
  const dag = String(
    datum.getDate(),
  ).padStart(2, "0");

  return `${jaar}-${maand}-${dag}`;
}

function maakWeekStart(
  jaar: number,
  weeknummer: number,
) {
  const datum = new Date(
    Date.UTC(jaar, 0, 4),
  );

  const dagVanWeek =
    datum.getUTCDay() || 7;

  datum.setUTCDate(
    datum.getUTCDate() -
      dagVanWeek +
      1 +
      (weeknummer - 1) * 7,
  );

  return new Date(
    datum.getUTCFullYear(),
    datum.getUTCMonth(),
    datum.getUTCDate(),
  );
}

function maakWeekDagen(
  week: PlanningWeek,
): KalenderDag[] {
  const weekStart = maakWeekStart(
    week.jaar,
    week.weeknummer,
  );

  return Array.from(
    { length: 7 },
    (_, index) => {
      const datum = new Date(
        weekStart,
      );

      datum.setDate(
        weekStart.getDate() + index,
      );

      const datumString =
        maakDatumString(datum);

      const diensten =
        week.diensten
          .filter(
            (dienst) =>
              maakDatumString(
                new Date(
                  dienst.datum,
                ),
              ) === datumString,
          )
          .sort(
            (a, b) =>
              new Date(
                a.begintijd,
              ).getTime() -
              new Date(
                b.begintijd,
              ).getTime(),
          );

      return {
        datum,
        datumString,
        diensten,
      };
    },
  );
}

function dagNaam(datum: Date) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      weekday: "short",
    },
  ).format(datum);
}

function dagNummer(datum: Date) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "numeric",
      month: "short",
    },
  ).format(datum);
}

function formatteerWeekPeriode(
  week: PlanningWeek,
) {
  const start = maakWeekStart(
    week.jaar,
    week.weeknummer,
  );

  const einde = new Date(start);

  einde.setDate(
    einde.getDate() + 6,
  );

  const startTekst =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        day: "numeric",
        month: "long",
      },
    ).format(start);

  const eindeTekst =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    ).format(einde);

  return `${startTekst} - ${eindeTekst}`;
}

function maakMaandSleutel(
  datum: Date,
) {
  return `${datum.getFullYear()}-${String(
    datum.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function maakMaandStart(
  jaar: number,
  maand: number,
) {
  return new Date(
    jaar,
    maand,
    1,
  );
}

function maakMaandDagen(
  jaar: number,
  maand: number,
) {
  const eersteDag = new Date(
    jaar,
    maand,
    1,
  );

  const laatsteDag = new Date(
    jaar,
    maand + 1,
    0,
  );

  const eersteWeekdag =
    eersteDag.getDay() === 0
      ? 6
      : eersteDag.getDay() - 1;

  const aantalDagen =
    laatsteDag.getDate();

  const totaal =
    Math.ceil(
      (eersteWeekdag +
        aantalDagen) /
        7,
    ) * 7;

  return Array.from(
    { length: totaal },
    (_, index) =>
      new Date(
        jaar,
        maand,
        1 -
          eersteWeekdag +
          index,
      ),
  );
}

function formatteerMaand(
  jaar: number,
  maand: number,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      month: "long",
      year: "numeric",
    },
  ).format(
    new Date(
      jaar,
      maand,
      1,
    ),
  );
}

function vindWeekVanVandaag(
  weken: PlanningWeek[],
) {
  const vandaag =
    maakDatumString(
      new Date(),
    );

  return weken.find(
    (week) =>
      maakWeekDagen(week).some(
        (dag) =>
          dag.datumString ===
          vandaag,
      ),
  );
}

function haalTagNamen(
  dienst: Dienst,
) {
  return (dienst.tags ?? [])
    .map(
      (dienstTag) =>
        dienstTag.tag?.naam,
    )
    .filter(
      (
        naam,
      ): naam is string =>
        typeof naam === "string" &&
        naam.length > 0,
    );
}

function dienstHeeftTag(
  dienst: Dienst,
  tagNaam: string,
) {
  return haalTagNamen(dienst).some(
    (naam) =>
      naam.toLowerCase() ===
      tagNaam.toLowerCase(),
  );
}

function heeftBhv(
  diensten: PlanningWeek["diensten"],
) {
  return diensten.some(
    (dienst) =>
      dienstHeeftTag(
        dienst,
        "BHV",
      ),
  );
}

export default function PlanningOverzicht({
  weken,
  vestigingId,
  isEigenaar = false,
  isTeamleider = false,
  isMedewerker = false,
  kanVerwijderen = false,
  onGewijzigd,
}: PlanningOverzichtProps) {
  const router = useRouter();

  const kanDienstToevoegen =
    isEigenaar || isTeamleider;

  const kanDienstBewerken =
    isEigenaar || isTeamleider;

  const [
    geselecteerdeWeekId,
    setGeselecteerdeWeekId,
  ] = useState<string | null>(
    null,
  );

  const [
    toevoegDatum,
    setToevoegDatum,
  ] = useState<string | null>(
    null,
  );

  const [
    toevoegTag,
    setToevoegTag,
  ] = useState<string | null>(
    null,
  );

  const [
    weergave,
    setWeergave,
  ] = useState<Weergave>(
    "week",
  );

  const [
    geselecteerdeMaand,
    setGeselecteerdeMaand,
  ] = useState<Date | null>(
    null,
  );

  const [
    huidigeMedewerkerId,
    setHuidigeMedewerkerId,
  ] = useState<string | null>(
    null,
  );

  const dienstFormRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const gesorteerdeWeken =
    useMemo(() => {
      return [...weken].sort(
        (a, b) => {
          if (a.jaar !== b.jaar) {
            return a.jaar - b.jaar;
          }

          return (
            a.weeknummer -
            b.weeknummer
          );
        },
      );
    }, [weken]);

  useEffect(() => {
    if (
      gesorteerdeWeken.length ===
      0
    ) {
      setGeselecteerdeWeekId(
        null,
      );
      setToevoegDatum(null);
      setToevoegTag(null);
      setGeselecteerdeMaand(
        null,
      );
      return;
    }

    const weekVanVandaag =
      vindWeekVanVandaag(
        gesorteerdeWeken,
      );

    const week =
      weekVanVandaag ??
      gesorteerdeWeken[0];

    if (!week) {
      return;
    }

    setGeselecteerdeWeekId(
      week.id,
    );

    const start =
      maakWeekStart(
        week.jaar,
        week.weeknummer,
      );

    setGeselecteerdeMaand(
      maakMaandStart(
        start.getFullYear(),
        start.getMonth(),
      ),
    );
  }, [gesorteerdeWeken]);

  const geselecteerdeWeek =
    useMemo(() => {
      if (
        gesorteerdeWeken.length ===
        0
      ) {
        return null;
      }

      return (
        gesorteerdeWeken.find(
          (week) =>
            week.id ===
            geselecteerdeWeekId,
        ) ??
        gesorteerdeWeken[0] ??
        null
      );
    }, [
      gesorteerdeWeken,
      geselecteerdeWeekId,
    ]);

  useEffect(() => {
    if (!geselecteerdeWeek) {
      return;
    }

    const start =
      maakWeekStart(
        geselecteerdeWeek.jaar,
        geselecteerdeWeek.weeknummer,
      );

    setGeselecteerdeMaand(
      maakMaandStart(
        start.getFullYear(),
        start.getMonth(),
      ),
    );
  }, [geselecteerdeWeek]);

  useEffect(() => {
    if (!geselecteerdeWeek) {
      setHuidigeMedewerkerId(null);
      return;
    }

    const week = geselecteerdeWeek;
    let actief = true;

    async function laadHuidigeMedewerker() {
      try {
        const weekStart =
          maakWeekStart(
            week.jaar,
            week.weeknummer,
          );

        const datum =
          maakDatumString(
            weekStart,
          );

        const response =
          await fetch(
            `/api/planning/medewerkers?vestigingId=${encodeURIComponent(
              vestigingId,
            )}&datum=${encodeURIComponent(
              datum,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.fout ??
              "De huidige medewerker kon niet worden opgehaald.",
          );
        }

        if (actief) {
          setHuidigeMedewerkerId(
            data?.huidigeMedewerkerId ??
              null,
          );
        }
      } catch (error) {
        console.error(
          "Fout bij ophalen huidige medewerker:",
          error,
        );

        if (actief) {
          setHuidigeMedewerkerId(
            null,
          );
        }
      }
    }

    void laadHuidigeMedewerker();

    return () => {
      actief = false;
    };
  }, [
    geselecteerdeWeek,
    vestigingId,
  ]);

  const geselecteerdeIndex =
    geselecteerdeWeek
      ? gesorteerdeWeken.findIndex(
          (week) =>
            week.id ===
            geselecteerdeWeek.id,
        )
      : -1;

  const vorigeWeek =
    geselecteerdeIndex > 0
      ? gesorteerdeWeken[
          geselecteerdeIndex - 1
        ]
      : null;

  const volgendeWeek =
    geselecteerdeIndex >= 0 &&
    geselecteerdeIndex <
      gesorteerdeWeken.length - 1
      ? gesorteerdeWeken[
          geselecteerdeIndex + 1
        ]
      : null;

  const kalenderDagen =
    useMemo(() => {
      if (!geselecteerdeWeek) {
        return [];
      }

      return maakWeekDagen(
        geselecteerdeWeek,
      );
    }, [geselecteerdeWeek]);

  const maandDagen =
    useMemo(() => {
      if (!geselecteerdeMaand) {
        return [];
      }

      return maakMaandDagen(
        geselecteerdeMaand.getFullYear(),
        geselecteerdeMaand.getMonth(),
      );
    }, [geselecteerdeMaand]);

  const beschikbareMaanden =
    useMemo(() => {
      const maanden = new Map<
        string,
        Date
      >();

      for (const week of gesorteerdeWeken) {
        const start =
          maakWeekStart(
            week.jaar,
            week.weeknummer,
          );

        const sleutel =
          maakMaandSleutel(start);

        if (!maanden.has(sleutel)) {
          maanden.set(
            sleutel,
            maakMaandStart(
              start.getFullYear(),
              start.getMonth(),
            ),
          );
        }
      }

      return Array.from(
        maanden.values(),
      ).sort(
        (a, b) =>
          a.getTime() -
          b.getTime(),
      );
    }, [gesorteerdeWeken]);

  const maandIndex =
    geselecteerdeMaand
      ? beschikbareMaanden.findIndex(
          (maand) =>
            maakMaandSleutel(
              maand,
            ) ===
            maakMaandSleutel(
              geselecteerdeMaand,
            ),
        )
      : -1;

  const vorigeMaand =
    maandIndex > 0
      ? beschikbareMaanden[
          maandIndex - 1
        ]
      : null;

  const volgendeMaand =
    maandIndex >= 0 &&
    maandIndex <
      beschikbareMaanden.length - 1
      ? beschikbareMaanden[
          maandIndex + 1
        ]
      : null;

  useEffect(() => {
    if (!toevoegDatum) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        dienstFormRef.current?.scrollIntoView(
          {
            behavior: "smooth",
            block: "start",
          },
        );
      }, 50);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toevoegDatum]);

  function selecteerWeek(
    week: PlanningWeek,
  ) {
    setGeselecteerdeWeekId(
      week.id,
    );

    setToevoegDatum(null);
    setToevoegTag(null);

    const start =
      maakWeekStart(
        week.jaar,
        week.weeknummer,
      );

    setGeselecteerdeMaand(
      maakMaandStart(
        start.getFullYear(),
        start.getMonth(),
      ),
    );
  }

  function gaNaarVandaag() {
    const weekVanVandaag =
      vindWeekVanVandaag(
        gesorteerdeWeken,
      );

    if (weekVanVandaag) {
      selecteerWeek(
        weekVanVandaag,
      );

      setWeergave("week");
      return;
    }

    const vandaag = new Date();

    let dichtstbijzijnde:
      | PlanningWeek
      | null =
      gesorteerdeWeken[0] ??
      null;

    let kleinsteVerschil =
      Infinity;

    for (const week of gesorteerdeWeken) {
      const start =
        maakWeekStart(
          week.jaar,
          week.weeknummer,
        );

      const verschil =
        Math.abs(
          start.getTime() -
            vandaag.getTime(),
        );

      if (
        verschil <
        kleinsteVerschil
      ) {
        kleinsteVerschil =
          verschil;

        dichtstbijzijnde =
          week;
      }
    }

    if (dichtstbijzijnde) {
      selecteerWeek(
        dichtstbijzijnde,
      );

      setWeergave("week");
    }
  }

  function openDienstForm(
    datum: string,
  ) {
    if (!kanDienstToevoegen) {
      return;
    }

    setToevoegDatum(datum);
    setToevoegTag(null);
  }

  function sluitDienstForm() {
    setToevoegDatum(null);
    setToevoegTag(null);
  }

  function wijzigMaand(
    maand: Date,
  ) {
    setGeselecteerdeMaand(
      maand,
    );

    setToevoegDatum(null);
    setToevoegTag(null);
  }

  function openDienst(
    dienstId: string,
  ) {
    router.push(
      `/planning/dienst/${dienstId}`,
    );
  }

  if (weken.length === 0) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Planning
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Hier worden de planningweken
            weergegeven.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-600">
            Er zijn nog geen
            planningweken beschikbaar.
          </p>
        </div>
      </section>
    );
  }

  if (
    !geselecteerdeWeek ||
    !geselecteerdeMaand
  ) {
    return null;
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border bg-white">
        <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (
                  weergave === "week" &&
                  vorigeWeek
                ) {
                  selecteerWeek(
                    vorigeWeek,
                  );
                }

                if (
                  weergave === "maand" &&
                  vorigeMaand
                ) {
                  wijzigMaand(
                    vorigeMaand,
                  );
                }
              }}
              disabled={
                weergave === "week"
                  ? !vorigeWeek
                  : !vorigeMaand
              }
              className="rounded-lg border px-3 py-2 text-lg font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Vorige"
            >
              ←
            </button>

            <div className="min-w-[230px] text-center">
              {weergave === "week" ? (
                <>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Week{" "}
                    {
                      geselecteerdeWeek.weeknummer
                    }{" "}
                    {
                      geselecteerdeWeek.jaar
                    }
                  </h2>

                  <p className="mt-1 text-sm text-gray-600">
                    {formatteerWeekPeriode(
                      geselecteerdeWeek,
                    )}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold capitalize text-gray-900">
                    {formatteerMaand(
                      geselecteerdeMaand.getFullYear(),
                      geselecteerdeMaand.getMonth(),
                    )}
                  </h2>

                  <p className="mt-1 text-sm text-gray-600">
                    Maandoverzicht
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (
                  weergave === "week" &&
                  volgendeWeek
                ) {
                  selecteerWeek(
                    volgendeWeek,
                  );
                }

                if (
                  weergave === "maand" &&
                  volgendeMaand
                ) {
                  wijzigMaand(
                    volgendeMaand,
                  );
                }
              }}
              disabled={
                weergave === "week"
                  ? !volgendeWeek
                  : !volgendeMaand
              }
              className="rounded-lg border px-3 py-2 text-lg font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Volgende"
            >
              →
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={gaNaarVandaag}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Vandaag
            </button>

            <div className="flex rounded-lg border border-gray-300 p-1">
              <button
                type="button"
                onClick={() =>
                  setWeergave("week")
                }
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  weergave === "week"
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Week
              </button>

              <button
                type="button"
                onClick={() =>
                  setWeergave("maand")
                }
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  weergave === "maand"
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Maand
              </button>
            </div>
          </div>
        </div>

        {weergave === "week" ? (
          <>
            <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2">
              <p className="text-xs text-gray-500">
                {
                  geselecteerdeWeek
                    .diensten.length
                }{" "}
                {geselecteerdeWeek
                  .diensten.length ===
                1
                  ? "dienst"
                  : "diensten"}
              </p>

              <p className="text-xs font-medium text-gray-500">
                {geselecteerdeWeek.status}
              </p>
            </div>

            <div className="overflow-x-auto">
              <div className="grid min-w-[980px] grid-cols-7 divide-x">
                {kalenderDagen.map(
                  (dag) => {
                    const geselecteerd =
                      toevoegDatum ===
                      dag.datumString;

                    const bhv =
                      heeftBhv(
                        dag.diensten,
                      );

                    return (
                      <div
                        key={
                          dag.datumString
                        }
                        className="min-h-[500px] bg-white"
                      >
                        <div
                          className={`border-b px-3 py-3 ${
                            geselecteerd
                              ? "bg-gray-100"
                              : "bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold uppercase text-gray-500">
                                {dagNaam(
                                  dag.datum,
                                )}
                              </p>

                              <p className="mt-1 font-semibold text-gray-900">
                                {dagNummer(
                                  dag.datum,
                                )}
                              </p>
                            </div>

                            {kanDienstToevoegen && (
                              <button
                                type="button"
                                onClick={() =>
                                  openDienstForm(
                                    dag.datumString,
                                  )
                                }
                                className="shrink-0 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-green-700 hover:shadow"
                              >
                                + Dienst
                              </button>
                            )}
                          </div>

                          <div className="mt-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                bhv
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {bhv
                                ? "BHV ✓"
                                : "BHV ontbreekt"}
                            </span>
                          </div>
                        </div>

                        <div className="divide-y">
                          {PLANNING_TAGS.map(
                            (tagNaam) => {
                              const tagDiensten =
                                dag.diensten.filter(
                                  (
                                    dienst,
                                  ) =>
                                    dienstHeeftTag(
                                      dienst,
                                      tagNaam,
                                    ),
                                );

                              return (
                                <div
                                  key={
                                    tagNaam
                                  }
                                  className="p-3"
                                >
                                  <div className="mb-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">
                                      {
                                        tagNaam
                                      }
                                    </h3>
                                  </div>

                                  {tagDiensten.length ===
                                  0 ? (
                                    <p className="py-2 text-xs text-gray-400">
                                      Nog niet gepland
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {tagDiensten.map(
                                        (
                                          dienst,
                                        ) => (
                                          <DienstDetail
                                            key={
                                              dienst.id
                                            }
                                            dienst={
                                              dienst
                                            }
                                            vestigingId={
                                              vestigingId
                                            }
                                            bewerkbaar={
                                              kanDienstBewerken
                                            }
                                            kanVerwijderen={
                                              kanVerwijderen
                                            }
                                            huidigeMedewerkerId={
                                              huidigeMedewerkerId
                                            }
                                            onGewijzigd={
                                              onGewijzigd
                                            }
                                            onKlik={
                                              openDienst
                                            }
                                          />
                                        ),
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-7 border-b bg-gray-50">
                {[
                  "Ma",
                  "Di",
                  "Wo",
                  "Do",
                  "Vr",
                  "Za",
                  "Zo",
                ].map(
                  (dag) => (
                    <div
                      key={dag}
                      className="border-r p-3 text-center text-xs font-semibold uppercase text-gray-500 last:border-r-0"
                    >
                      {dag}
                    </div>
                  ),
                )}
              </div>

              <div className="grid grid-cols-7">
                {maandDagen.map(
                  (datum) => {
                    const datumString =
                      maakDatumString(
                        datum,
                      );

                    const isHuidigeMaand =
                      datum.getMonth() ===
                        geselecteerdeMaand.getMonth() &&
                      datum.getFullYear() ===
                        geselecteerdeMaand.getFullYear();

                    const week =
                      gesorteerdeWeken.find(
                        (week) =>
                          maakWeekDagen(
                            week,
                          ).some(
                            (dag) =>
                              dag.datumString ===
                              datumString,
                          ),
                      );

                    const diensten =
                      week?.diensten
                        .filter(
                          (dienst) =>
                            maakDatumString(
                              new Date(
                                dienst.datum,
                              ),
                            ) ===
                            datumString,
                        )
                        .sort(
                          (a, b) =>
                            new Date(
                              a.begintijd,
                            ).getTime() -
                            new Date(
                              b.begintijd,
                            ).getTime(),
                        ) ?? [];

                    const vandaag =
                      datumString ===
                      maakDatumString(
                        new Date(),
                      );

                    const status =
                      diensten.length ===
                      0
                        ? "probleem"
                        : "compleet";

                    return (
                      <div
                        key={
                          datumString
                        }
                        className={`min-h-[125px] border-b border-r p-2 ${
                          isHuidigeMaand
                            ? "bg-white"
                            : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-medium ${
                              vandaag
                                ? "rounded-full bg-gray-900 px-2 py-1 text-white"
                                : isHuidigeMaand
                                  ? "text-gray-900"
                                  : "text-gray-400"
                            }`}
                          >
                            {
                              datum.getDate()
                            }
                          </span>

                          {diensten.length >
                            0 && (
                            <span className="text-xs text-gray-400">
                              {
                                diensten.length
                              }
                            </span>
                          )}
                        </div>

                        <div className="mt-2">
                          <div
                            className={`h-8 w-full rounded-lg ${
                              status ===
                              "compleet"
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                            title={
                              status ===
                              "compleet"
                                ? "Planning gevuld"
                                : "Planning ontbreekt"
                            }
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {kanDienstToevoegen &&
        toevoegDatum && (
          <div
            ref={dienstFormRef}
            className="scroll-mt-6 rounded-xl border bg-white p-6"
          >
            <DienstForm
              weekId={
                geselecteerdeWeek.id
              }
              vestigingId={
                vestigingId
              }
              initialDatum={
                toevoegDatum
              }
              initialTagNaam={
                toevoegTag
              }
              onAangemaakt={() => {
                setToevoegDatum(null);
                setToevoegTag(null);
                onGewijzigd?.();
              }}
            />

            <button
              type="button"
              onClick={
                sluitDienstForm
              }
              className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Annuleren
            </button>
          </div>
        )}
    </section>
  );
}