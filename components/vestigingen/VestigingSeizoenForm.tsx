"use client";

import { useState } from "react";

type VestigingSeizoenFormProps = {
  vestigingId: string;
  seizoenStart: string | null;
  seizoenEinde: string | null;
};

function datumVoorInput(
  waarde: string | null,
) {
  if (!waarde) {
    return "";
  }

  const datum = new Date(waarde);

  if (Number.isNaN(datum.getTime())) {
    return "";
  }

  return datum.toISOString().slice(0, 10);
}

export default function VestigingSeizoenForm({
  vestigingId,
  seizoenStart,
  seizoenEinde,
}: VestigingSeizoenFormProps) {
  const [start, setStart] = useState(
    datumVoorInput(seizoenStart),
  );

  const [einde, setEinde] = useState(
    datumVoorInput(seizoenEinde),
  );

  const [laden, setLaden] =
    useState(false);

  const [fout, setFout] =
    useState<string | null>(null);

  const [succes, setSucces] =
    useState(false);

  async function opslaan() {
    setFout(null);
    setSucces(false);

    if (
      start &&
      einde &&
      start > einde
    ) {
      setFout(
        "Seizoenstart moet vóór de seizoeneinde liggen.",
      );
      return;
    }

    try {
      setLaden(true);

      const response = await fetch(
        `/api/vestigingen/${encodeURIComponent(
          vestigingId,
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            seizoenStart:
              start || null,
            seizoenEinde:
              einde || null,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Het seizoen kon niet worden opgeslagen.",
        );
      }

      setSucces(true);
    } catch (error) {
      console.error(
        "Fout bij opslaan seizoen:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "Het seizoen kon niet worden opgeslagen.",
      );
    } finally {
      setLaden(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`seizoen-start-${vestigingId}`}
            className="mb-1 block text-xs font-medium text-gray-700"
          >
            Start
          </label>

          <input
            id={`seizoen-start-${vestigingId}`}
            type="date"
            value={start}
            onChange={(event) => {
              setStart(
                event.target.value,
              );
              setSucces(false);
              setFout(null);
            }}
            disabled={laden}
            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-gray-900 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor={`seizoen-einde-${vestigingId}`}
            className="mb-1 block text-xs font-medium text-gray-700"
          >
            Einde
          </label>

          <input
            id={`seizoen-einde-${vestigingId}`}
            type="date"
            value={einde}
            onChange={(event) => {
              setEinde(
                event.target.value,
              );
              setSucces(false);
              setFout(null);
            }}
            disabled={laden}
            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-gray-900 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={opslaan}
          disabled={laden}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {laden
            ? "Opslaan..."
            : "Seizoen opslaan"}
        </button>

        {succes && (
          <span className="text-xs text-green-600">
            Opgeslagen
          </span>
        )}
      </div>

      {fout && (
        <p className="text-xs text-red-600">
          {fout}
        </p>
      )}
    </div>
  );
}