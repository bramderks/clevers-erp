"use client";

import type { Dienst } from "@/types/planning";

type DienstOverzichtProps = {
  diensten: Dienst[];
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

function naamMedewerker(
  medewerker: Dienst["bezetting"][number]["medewerker"],
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

function statusLabel(
  status: Dienst["bezetting"][number]["status"],
) {
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

export default function DienstOverzicht({
  diensten,
}: DienstOverzichtProps) {
  if (diensten.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-gray-600">
          Er zijn nog geen diensten voor deze week.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {diensten.map((dienst) => (
        <article
          key={dienst.id}
          className="rounded-xl border bg-white p-5"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h3 className="font-semibold capitalize text-gray-900">
                {formatteerDatum(dienst.datum)}
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                {formatteerTijd(dienst.begintijd)} -{" "}
                {formatteerTijd(dienst.eindtijd)}
              </p>
            </div>

            <span className="text-sm text-gray-500">
              {dienst.bezetting.length}{" "}
              {dienst.bezetting.length === 1
                ? "medewerker"
                : "medewerkers"}
            </span>
          </div>

          {dienst.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              {dienst.tags.map((dienstTag) => (
                <span
                  key={dienstTag.id}
                  className="rounded-full border bg-gray-50 px-3 py-1 text-xs text-gray-700"
                >
                  {dienstTag.tag.naam}
                  {dienstTag.aantal > 1 &&
                    ` (${dienstTag.aantal})`}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900">
              Bezetting
            </h4>

            {dienst.bezetting.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                Nog geen bezetting.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {dienst.bezetting.map((bezetting) => (
                  <div
                    key={bezetting.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <span className="text-sm text-gray-800">
                      {naamMedewerker(
                        bezetting.medewerker,
                      )}
                    </span>

                    <span className="text-xs text-gray-500">
                      {statusLabel(
                        bezetting.status,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}