"use client";

import type { PlanningWeek } from "@/types/planning";

type PlanningWeekOverzichtProps = {
  week: PlanningWeek;
  onWijzigWeek?: () => void;
  onWijzigDienst?: (dienstId: string) => void;
  onVerwijderDienst?: (dienstId: string) => void;
};

function formatteerDatum(datum: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(datum));
}

function formatteerTijd(datum: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(datum));
}

function statusLabel(status: PlanningWeek["status"]) {
  switch (status) {
    case "OPEN":
      return "Open";
    case "IN_PLANNING":
      return "In planning";
    case "GEPUBLICEERD":
      return "Gepubliceerd";
    case "AFGESLOTEN":
      return "Afgesloten";
    default:
      return status;
  }
}

function statusBezettingLabel(status: string) {
  switch (status) {
    case "OPEN":
      return "Open";
    case "GEPLAND":
      return "Gepland";
    case "BEVESTIGD":
      return "Bevestigd";
    case "AFGEZEGD":
      return "Afgezegd";
    case "GEWERKT":
      return "Gewerkt";
    default:
      return status;
  }
}

function naamMedewerker(
  medewerker: {
    voornaam: string;
    tussenvoegsel: string | null;
    achternaam: string;
  } | null,
) {
  if (!medewerker) {
    return "Open plek";
  }

  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function PlanningWeekOverzicht({
  week,
  onWijzigWeek,
  onWijzigDienst,
  onVerwijderDienst,
}: PlanningWeekOverzichtProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Week {week.weeknummer} {week.jaar}
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Status: {statusLabel(week.status)}
            </p>

            {week.beschikbaarheidDeadline && (
              <p className="mt-1 text-xs text-gray-500">
                Deadline beschikbaarheid:{" "}
                {formatteerDatum(
                  week.beschikbaarheidDeadline,
                )}{" "}
                om{" "}
                {formatteerTijd(
                  week.beschikbaarheidDeadline,
                )}
              </p>
            )}
          </div>

          {onWijzigWeek && (
            <button
              type="button"
              onClick={onWijzigWeek}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Week wijzigen
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Diensten
            </h3>

            <p className="mt-1 text-sm text-gray-600">
              {week.diensten.length}{" "}
              {week.diensten.length === 1
                ? "dienst"
                : "diensten"}
            </p>
          </div>
        </div>

        {week.diensten.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed p-6">
            <p className="text-sm text-gray-500">
              Er zijn nog geen diensten aangemaakt
              voor deze week.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {week.diensten.map((dienst) => (
              <div
                key={dienst.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <h4 className="font-medium capitalize text-gray-900">
                      {formatteerDatum(dienst.datum)}
                    </h4>

                    <p className="mt-1 text-sm text-gray-600">
                      {formatteerTijd(
                        dienst.begintijd,
                      )}{" "}
                      -{" "}
                      {formatteerTijd(
                        dienst.eindtijd,
                      )}
                    </p>

                    {dienst.opmerkingen && (
                      <p className="mt-2 text-sm text-gray-500">
                        {dienst.opmerkingen}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {onWijzigDienst && (
                      <button
                        type="button"
                        onClick={() =>
                          onWijzigDienst(dienst.id)
                        }
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Wijzigen
                      </button>
                    )}

                    {onVerwijderDienst && (
                      <button
                        type="button"
                        onClick={() =>
                          onVerwijderDienst(dienst.id)
                        }
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Verwijderen
                      </button>
                    )}
                  </div>
                </div>

                {dienst.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                    {dienst.tags.map((dienstTag) => (
                      <span
                        key={dienstTag.id}
                        className="rounded-full border bg-gray-50 px-3 py-1 text-xs text-gray-700"
                      >
                        {dienstTag.tag.naam}
                        {dienstTag.aantal > 1 &&
                          ` × ${dienstTag.aantal}`}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-semibold text-gray-900">
                      Bezetting
                    </h5>

                    <span className="text-xs text-gray-500">
                      {dienst.bezetting.length}{" "}
                      {dienst.bezetting.length === 1
                        ? "medewerker"
                        : "medewerkers"}
                    </span>
                  </div>

                  {dienst.bezetting.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">
                      Er zijn nog geen medewerkers
                      ingepland.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {dienst.bezetting.map(
                        (bezetting) => (
                          <div
                            key={bezetting.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                          >
                            <span className="text-sm text-gray-800">
                              {naamMedewerker(
                                bezetting.medewerker,
                              )}
                            </span>

                            <span className="text-xs text-gray-500">
                              {statusBezettingLabel(
                                bezetting.status,
                              )}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Beschikbaarheden
          </h3>

          <p className="mt-1 text-sm text-gray-600">
            {week.beschikbaarheden.length}{" "}
            {week.beschikbaarheden.length === 1
              ? "beschikbaarheid"
              : "beschikbaarheden"}
          </p>
        </div>

        {week.beschikbaarheden.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed p-6">
            <p className="text-sm text-gray-500">
              Er zijn nog geen beschikbaarheden
              opgegeven.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {week.beschikbaarheden.map(
              (beschikbaarheid) => (
                <div
                  key={beschikbaarheid.id}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatteerDatum(
                          beschikbaarheid.datum,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {formatteerTijd(
                          beschikbaarheid.begintijd,
                        )}{" "}
                        -{" "}
                        {formatteerTijd(
                          beschikbaarheid.eindtijd,
                        )}
                      </p>
                    </div>

                    <span className="rounded-full border px-3 py-1 text-xs text-gray-700">
                      {beschikbaarheid.status}
                    </span>
                  </div>

                  {beschikbaarheid.opmerking && (
                    <p className="mt-2 text-xs text-gray-500">
                      {beschikbaarheid.opmerking}
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}