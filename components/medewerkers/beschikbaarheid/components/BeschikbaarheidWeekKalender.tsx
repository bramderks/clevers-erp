"use client";

import { useEffect, useMemo, useState } from "react";

type DagNaam =
  | "maandag"
  | "dinsdag"
  | "woensdag"
  | "donderdag"
  | "vrijdag"
  | "zaterdag"
  | "zondag";

type BeschikbaarheidDag = {
  datum: string;
  dagNaam: DagNaam;
  beschikbaar: boolean;
  van: string;
  tot: string;
};

type BeschikbaarheidWeek = {
  id: string;
  jaar: number;
  weeknummer: number;
  startdatum: string;
  einddatum: string;
};

type Props = {
  medewerkerId: string;
  vestigingId: string;
  week: BeschikbaarheidWeek;
  isBeheerder: boolean;
};

const DAGEN: DagNaam[] = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];

const DAG_LABELS: Record<DagNaam, string> = {
  maandag: "Ma",
  dinsdag: "Di",
  woensdag: "Wo",
  donderdag: "Do",
  vrijdag: "Vr",
  zaterdag: "Za",
  zondag: "Zo",
};

const DAG_VOLLEDIG: Record<DagNaam, string> = {
  maandag: "Maandag",
  dinsdag: "Dinsdag",
  woensdag: "Woensdag",
  donderdag: "Donderdag",
  vrijdag: "Vrijdag",
  zaterdag: "Zaterdag",
  zondag: "Zondag",
};

function maakTijden() {
  const tijden: string[] = [];

  for (let uur = 9; uur <= 23; uur++) {
    for (let minuut = 0; minuut < 60; minuut += 15) {
      if (uur === 23 && minuut > 0) {
        continue;
      }

      tijden.push(
        `${String(uur).padStart(2, "0")}:${String(
          minuut,
        ).padStart(2, "0")}`,
      );
    }
  }

  return tijden;
}

const TIJDEN = maakTijden();

function formatteerDatum(datum: string) {
  const waarde = new Date(datum);

  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
  }).format(waarde);
}

function maakLegeWeek(startdatum: string) {
  const start = new Date(startdatum);

  return DAGEN.map((dagNaam, index) => {
    const datum = new Date(start);
    datum.setDate(start.getDate() + index);

    return {
      datum: datum.toISOString(),
      dagNaam,
      beschikbaar: false,
      van: "09:00",
      tot: "23:00",
    };
  });
}

export default function BeschikbaarheidWeekKalender({
  medewerkerId,
  vestigingId,
  week,
}: Props) {
  const [dagen, setDagen] = useState<
    BeschikbaarheidDag[]
  >(() => maakLegeWeek(week.startdatum));

  const [loading, setLoading] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [error, setError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let actief = true;

    async function laadBeschikbaarheid() {
      setLoading(true);
      setError(null);
      setOpgeslagen(false);

      try {
        const response = await fetch(
          `/api/medewerkers/${encodeURIComponent(
            medewerkerId,
          )}/beschikbaarheid?weekId=${encodeURIComponent(
            week.id,
          )}&vestigingId=${encodeURIComponent(
            vestigingId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const resultaat = await response.json();

        if (!response.ok) {
          throw new Error(
            resultaat?.error ??
              resultaat?.fout ??
              "Beschikbaarheid kon niet worden geladen.",
          );
        }

        const legeWeek = maakLegeWeek(week.startdatum);

        const bestaande =
          Array.isArray(
            resultaat?.beschikbaarheden,
          )
            ? resultaat.beschikbaarheden
            : [];

        for (const registratie of bestaande) {
          const datum = new Date(
            registratie.datum,
          )
            .toISOString()
            .slice(0, 10);

          const dag = legeWeek.find(
            (item) =>
              new Date(item.datum)
                .toISOString()
                .slice(0, 10) === datum,
          );

          if (!dag) {
            continue;
          }

          dag.beschikbaar =
            registratie.beschikbaar === true;

          if (registratie.van) {
            dag.van = registratie.van;
          }

          if (registratie.tot) {
            dag.tot = registratie.tot;
          }
        }

        if (actief) {
          setDagen(legeWeek);
        }
      } catch (fout) {
        if (actief) {
          setError(
            fout instanceof Error
              ? fout.message
              : "Beschikbaarheid kon niet worden geladen.",
          );
        }
      } finally {
        if (actief) {
          setLoading(false);
        }
      }
    }

    void laadBeschikbaarheid();

    return () => {
      actief = false;
    };
  }, [
    medewerkerId,
    vestigingId,
    week.id,
    week.startdatum,
  ]);

  const weekDatums = useMemo(
    () =>
      dagen.map((dag) => ({
        ...dag,
        datumTekst: formatteerDatum(
          dag.datum,
        ),
      })),
    [dagen],
  );

  function wijzigDag(
    index: number,
    wijziging: Partial<BeschikbaarheidDag>,
  ) {
    setOpgeslagen(false);

    setDagen((huidig) =>
      huidig.map((dag, dagIndex) =>
        dagIndex === index
          ? {
              ...dag,
              ...wijziging,
            }
          : dag,
      ),
    );
  }

  async function slaOp() {
    setOpslaan(true);
    setError(null);
    setOpgeslagen(false);

    try {
      const response = await fetch(
        `/api/medewerkers/${encodeURIComponent(
          medewerkerId,
        )}/beschikbaarheid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            weekId: week.id,
            vestigingId,
            beschikbaarheden: dagen.map(
              (dag) => ({
                datum: dag.datum,
                beschikbaar: dag.beschikbaar,
                van: dag.beschikbaar
                  ? dag.van
                  : null,
                tot: dag.beschikbaar
                  ? dag.tot
                  : null,
              }),
            ),
          }),
        },
      );

      const resultaat =
        await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat?.error ??
            resultaat?.fout ??
            "Beschikbaarheid kon niet worden opgeslagen.",
        );
      }

      setOpgeslagen(true);
    } catch (fout) {
      setError(
        fout instanceof Error
          ? fout.message
          : "Beschikbaarheid kon niet worden opgeslagen.",
      );
    } finally {
      setOpslaan(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">
          Beschikbaarheid laden...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* WEEK HEADER */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Beschikbaarheid
          </p>

          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            Week {week.weeknummer} ·{" "}
            {week.jaar}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {formatteerDatum(
              week.startdatum,
            )}{" "}
            t/m{" "}
            {formatteerDatum(
              week.einddatum,
            )}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Klik op een dag om de
          beschikbaarheid in te stellen.
        </div>
      </div>

      {/* WEEK KALENDER */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[1050px] grid-cols-7 gap-3">
          {weekDatums.map((dag, index) => {
            const actief = dag.beschikbaar;

            return (
              <div
                key={dag.datum}
                className={[
                  "rounded-2xl border bg-white transition",
                  actief
                    ? "border-green-300 shadow-sm"
                    : "border-slate-200",
                ].join(" ")}
              >
                {/* DAG HEADER */}
                <button
                  type="button"
                  onClick={() =>
                    wijzigDag(index, {
                      beschikbaar: !actief,
                    })
                  }
                  className="w-full border-b border-slate-200 p-4 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {DAG_LABELS[
                          dag.dagNaam
                        ]}
                      </p>

                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {DAG_VOLLEDIG[
                          dag.dagNaam
                        ]}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {dag.datumTekst}
                      </p>
                    </div>

                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        actief
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-500",
                      ].join(" ")}
                    >
                      {actief
                        ? "Beschikbaar"
                        : "Niet beschikbaar"}
                    </span>
                  </div>
                </button>

                {/* DAG INHOUD */}
                <div className="p-4">
                  {!actief ? (
                    <button
                      type="button"
                      onClick={() =>
                        wijzigDag(index, {
                          beschikbaar: true,
                        })
                      }
                      className="flex min-h-[180px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-center text-sm font-medium text-slate-500 transition hover:border-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      Klik om beschikbaarheid
                      <br />
                      in te stellen
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Beschikbaar vanaf
                        </label>

                        <select
                          value={dag.van}
                          onChange={(event) =>
                            wijzigDag(
                              index,
                              {
                                van: event.target
                                  .value,
                              },
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                        >
                          {TIJDEN.map(
                            (tijd) => (
                              <option
                                key={tijd}
                                value={tijd}
                              >
                                {tijd}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Beschikbaar tot
                        </label>

                        <select
                          value={dag.tot}
                          onChange={(event) =>
                            wijzigDag(
                              index,
                              {
                                tot: event.target
                                  .value,
                              },
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                        >
                          {TIJDEN.map(
                            (tijd) => (
                              <option
                                key={tijd}
                                value={tijd}
                              >
                                {tijd}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          wijzigDag(index, {
                            beschikbaar: false,
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        Niet beschikbaar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* UITLEG */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-700">
          Beschikbaarheid invullen
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Iedere dag staat standaard op
          Niet beschikbaar. Klik op een dag
          om deze beschikbaar te maken en
          geef vervolgens de beschikbare
          tijden op.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {opgeslagen && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Beschikbaarheid is opgeslagen.
        </div>
      )}

      {/* OPSLAAN */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={slaOp}
          disabled={opslaan}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {opslaan
            ? "Opslaan..."
            : "Beschikbaarheid opslaan"}
        </button>
      </div>
    </div>
  );
}