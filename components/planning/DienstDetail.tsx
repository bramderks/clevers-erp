"use client";

import { useState } from "react";

import BezettingForm from "@/components/planning/BezettingForm";
import BezettingOverzicht from "@/components/planning/BezettingOverzicht";
import type { Dienst } from "@/types/planning";

type DienstDetailProps = {
  dienst: Dienst;
  vestigingId: string;
  bewerkbaar?: boolean;
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

export default function DienstDetail({
  dienst,
  vestigingId,
  bewerkbaar = true,
  onGewijzigd,
}: DienstDetailProps) {
  const [toonFormulier, setToonFormulier] =
    useState(false);

  const [verwijderen, setVerwijderen] =
    useState(false);

  const [laden, setLaden] =
    useState(false);

  const [fout, setFout] =
    useState<string | null>(null);

  async function verwijderDienst() {
    try {
      setLaden(true);
      setFout(null);

      const response = await fetch(
        `/api/planning/diensten/${dienst.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De dienst kon niet worden verwijderd.",
        );
      }

      onGewijzigd?.();
    } catch (error) {
      console.error(
        "Fout bij verwijderen dienst:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De dienst kon niet worden verwijderd.",
      );
    } finally {
      setLaden(false);
    }
  }

  return (
    <article className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold capitalize text-gray-900">
            {formatteerDatum(dienst.datum)}
          </h3>

          <p className="mt-1 text-sm text-gray-600">
            {formatteerTijd(dienst.begintijd)} -{" "}
            {formatteerTijd(dienst.eindtijd)}
          </p>

          {dienst.opmerkingen && (
            <p className="mt-3 text-sm text-gray-600">
              {dienst.opmerkingen}
            </p>
          )}
        </div>

        <div className="text-sm text-gray-500">
          {dienst.bezetting.length}{" "}
          {dienst.bezetting.length === 1
            ? "medewerker"
            : "medewerkers"}
        </div>
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

      <div className="mt-5 border-t pt-5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-gray-900">
            Bezetting
          </h4>

          {bewerkbaar && (
            <button
              type="button"
              onClick={() =>
                setToonFormulier(
                  (huidig) => !huidig,
                )
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              {toonFormulier
                ? "Annuleren"
                : "Medewerker inplannen"}
            </button>
          )}
        </div>

        <div className="mt-3">
          <BezettingOverzicht
            bezetting={dienst.bezetting}
          />
        </div>

        {toonFormulier && bewerkbaar && (
          <div className="mt-4">
            <BezettingForm
              dienstId={dienst.id}
              vestigingId={vestigingId}
              onAangemaakt={() => {
                setToonFormulier(false);
                onGewijzigd?.();
              }}
            />
          </div>
        )}
      </div>

      {bewerkbaar && (
        <div className="mt-4 flex justify-end border-t pt-3">
          {!verwijderen ? (
            <button
              type="button"
              onClick={() => {
                setFout(null);
                setVerwijderen(true);
              }}
              className="text-xs text-gray-400 transition hover:text-red-600"
            >
              Verwijderen
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">
                Dienst verwijderen?
              </span>

              <button
                type="button"
                onClick={() =>
                  setVerwijderen(false)
                }
                disabled={laden}
                className="rounded-md border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Nee
              </button>

              <button
                type="button"
                onClick={verwijderDienst}
                disabled={laden}
                className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
              >
                {laden
                  ? "..."
                  : "Ja, verwijderen"}
              </button>
            </div>
          )}
        </div>
      )}

      {fout && (
        <p className="mt-2 text-right text-xs text-red-600">
          {fout}
        </p>
      )}
    </article>
  );
}