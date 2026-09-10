"use client";

import { useMemo, useState } from "react";

import Badge from "@/components/ui/Badge";

type Beschikbaarheid = {
  id: string;
  datum: string | Date;
  begintijd: string | Date;
  eindtijd: string | Date;
  status: string;
  opmerking: string | null;
};

type BeschikbaarheidWeekProps = {
  jaar: number;
  weeknummer: number;
  beschikbaarheden: Beschikbaarheid[];
};

type Dag = {
  datum: Date;
  datumKey: string;
  naam: string;
};

function maakDatumKey(datum: Date) {
  const jaar = datum.getFullYear();
  const maand = String(
    datum.getMonth() + 1,
  ).padStart(2, "0");
  const dag = String(
    datum.getDate(),
  ).padStart(2, "0");

  return `${jaar}-${maand}-${dag}`;
}

function maakWeekDagen(
  jaar: number,
  weeknummer: number,
): Dag[] {
  const vierdeJanuari = new Date(
    jaar,
    0,
    4,
  );

  const dagVanWeek =
    vierdeJanuari.getDay() || 7;

  const maandag = new Date(
    vierdeJanuari,
  );

  maandag.setDate(
    vierdeJanuari.getDate() -
      dagVanWeek +
      1 +
      (weeknummer - 1) * 7,
  );

  return Array.from(
    { length: 7 },
    (_, index) => {
      const datum = new Date(
        maandag,
      );

      datum.setDate(
        maandag.getDate() + index,
      );

      return {
        datum,
        datumKey: maakDatumKey(datum),
        naam: datum.toLocaleDateString(
          "nl-NL",
          {
            weekday: "long",
          },
        ),
      };
    },
  );
}

function formatTijd(
  value: string | Date,
) {
  const datum =
    value instanceof Date
      ? value
      : new Date(value);

  return datum.toLocaleTimeString(
    "nl-NL",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

function statusNaam(
  status: string,
) {
  switch (status) {
    case "BESCHIKBAAR":
      return "Beschikbaar";

    case "VOORKEUR":
      return "Voorkeur";

    case "NIET_BESCHIKBAAR":
      return "Niet beschikbaar";

    default:
      return status;
  }
}

function statusVariant(
  status: string,
) {
  switch (status) {
    case "BESCHIKBAAR":
      return "success" as const;

    case "VOORKEUR":
      return "warning" as const;

    case "NIET_BESCHIKBAAR":
      return "danger" as const;

    default:
      return "default" as const;
  }
}

export default function BeschikbaarheidWeek({
  jaar,
  weeknummer,
  beschikbaarheden,
}: BeschikbaarheidWeekProps) {
  const [selectedDate, setSelectedDate] =
    useState<string | null>(null);

  const dagen = useMemo(
    () =>
      maakWeekDagen(
        jaar,
        weeknummer,
      ),
    [jaar, weeknummer],
  );

  const beschikbaarheidPerDag =
    useMemo(() => {
      const resultaat =
        new Map<
          string,
          Beschikbaarheid[]
        >();

      for (const beschikbaarheid of beschikbaarheden) {
        const datum = new Date(
          beschikbaarheid.datum,
        );

        const key =
          maakDatumKey(datum);

        const bestaande =
          resultaat.get(key) ?? [];

        bestaande.push(
          beschikbaarheid,
        );

        resultaat.set(
          key,
          bestaande,
        );
      }

      return resultaat;
    }, [beschikbaarheden]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Week {weeknummer}
          </h3>

          <p className="text-sm text-slate-500">
            {jaar}
          </p>
        </div>

        <div className="text-sm text-slate-500">
          Weekoverzicht beschikbaarheid
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        {dagen.map((dag) => {
          const items =
            beschikbaarheidPerDag.get(
              dag.datumKey,
            ) ?? [];

          const geselecteerd =
            selectedDate ===
            dag.datumKey;

          return (
            <button
              key={dag.datumKey}
              type="button"
              onClick={() =>
                setSelectedDate(
                  geselecteerd
                    ? null
                    : dag.datumKey,
                )
              }
              className={[
                "min-h-48 rounded-2xl border p-4 text-left transition",
                geselecteerd
                  ? "border-cyan-500 bg-cyan-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              ].join(" ")}
            >
              <div className="mb-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {dag.naam}
                </p>

                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {dag.datum.toLocaleDateString(
                    "nl-NL",
                    {
                      day: "numeric",
                      month: "short",
                    },
                  )}
                </p>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Geen beschikbaarheid
                </p>
              ) : (
                <div className="space-y-3">
                  {items.map(
                    (item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <p className="text-sm font-medium text-slate-700">
                          {formatTijd(
                            item.begintijd,
                          )}{" "}
                          -{" "}
                          {formatTijd(
                            item.eindtijd,
                          )}
                        </p>

                        <div className="mt-2">
                          <Badge
                            variant={statusVariant(
                              item.status,
                            )}
                          >
                            {statusNaam(
                              item.status,
                            )}
                          </Badge>
                        </div>

                        {item.opmerking && (
                          <p className="mt-2 text-xs text-slate-500">
                            {item.opmerking}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="success">
          Beschikbaar
        </Badge>

        <Badge variant="warning">
          Voorkeur
        </Badge>

        <Badge variant="danger">
          Niet beschikbaar
        </Badge>
      </div>
    </div>
  );
}