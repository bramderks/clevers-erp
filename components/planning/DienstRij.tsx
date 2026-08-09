"use client";

import type { Dienst } from "@/types/planning";

type DienstRijProps = {
  dienst: Dienst;
  onGewijzigd?: () => void;
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

function medewerkerNaam(
  medewerker: NonNullable<
    Dienst["bezetting"][number]["medewerker"]
  >,
) {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

function statusLabel(status: Dienst["bezetting"][number]["status"]) {
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

export default function DienstRij({
  dienst,
}: DienstRijProps) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-medium capitalize text-gray-900">
            {formatteerDatum(dienst.datum)}
          </p>

          <p className="mt-1 text-sm text-gray-600">
            {formatteerTijd(dienst.begintijd)} -{" "}
            {formatteerTijd(dienst.eindtijd)}
          </p>

          {dienst.opmerkingen && (
            <p className="mt-2 text-sm text-gray-500">
              {dienst.opmerkingen}
            </p>
          )}
        </div>

        {dienst.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dienst.tags.map((dienstTag) => (
              <span
                key={dienstTag.id}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-700"
              >
                {dienstTag.tag.naam} · {dienstTag.aantal}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">
            Bezetting
          </h3>

          <span className="text-xs text-gray-500">
            {dienst.bezetting.length}{" "}
            {dienst.bezetting.length === 1
              ? "plek"
              : "plekken"}
          </span>
        </div>

        {dienst.bezetting.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nog geen bezetting.
          </p>
        ) : (
          <div className="space-y-2">
            {dienst.bezetting.map((bezetting) => (
              <div
                key={bezetting.id}
                className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2"
              >
                <span className="text-sm text-gray-800">
                  {bezetting.medewerker
                    ? medewerkerNaam(bezetting.medewerker)
                    : "Open plek"}
                </span>

                <span className="text-xs text-gray-500">
                  {statusLabel(bezetting.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}