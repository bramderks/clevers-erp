"use client";

import { FormEvent, useState } from "react";

type PlanningFormProps = {
  vestigingId: string;
  onAangemaakt?: () => void;
};

export default function PlanningForm({
  vestigingId,
  onAangemaakt,
}: PlanningFormProps) {
  const huidigeDatum = new Date();

  const [jaar, setJaar] = useState(String(huidigeDatum.getFullYear()));
  const [weeknummer, setWeeknummer] = useState("");
  const [beschikbaarheidDeadline, setBeschikbaarheidDeadline] =
    useState("");
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFout(null);

    const jaarNummer = Number(jaar);
    const weekNummer = Number(weeknummer);

    if (!Number.isInteger(jaarNummer)) {
      setFout("Vul een geldig jaar in.");
      return;
    }

    if (
      !Number.isInteger(weekNummer) ||
      weekNummer < 1 ||
      weekNummer > 53
    ) {
      setFout("Weeknummer moet tussen 1 en 53 liggen.");
      return;
    }

    try {
      setLaden(true);

      const response = await fetch("/api/planning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vestigingId,
          jaar: jaarNummer,
          weeknummer: weekNummer,
          status: "OPEN",
          beschikbaarheidDeadline: beschikbaarheidDeadline
            ? new Date(beschikbaarheidDeadline).toISOString()
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ?? "De planningweek kon niet worden aangemaakt.",
        );
      }

      setWeeknummer("");
      setBeschikbaarheidDeadline("");

      onAangemaakt?.();
    } catch (error) {
      console.error("Fout bij aanmaken planningweek:", error);

      setFout(
        error instanceof Error
          ? error.message
          : "De planningweek kon niet worden aangemaakt.",
      );
    } finally {
      setLaden(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border bg-white p-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Planningweek toevoegen
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Maak een nieuwe planningweek aan voor de geselecteerde vestiging.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="planning-jaar"
            className="block text-sm font-medium text-gray-900"
          >
            Jaar
          </label>

          <input
            id="planning-jaar"
            type="number"
            min={2020}
            max={2100}
            value={jaar}
            onChange={(event) => setJaar(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            required
          />
        </div>

        <div>
          <label
            htmlFor="planning-week"
            className="block text-sm font-medium text-gray-900"
          >
            Weeknummer
          </label>

          <input
            id="planning-week"
            type="number"
            min={1}
            max={53}
            value={weeknummer}
            onChange={(event) => setWeeknummer(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            required
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="beschikbaarheid-deadline"
          className="block text-sm font-medium text-gray-900"
        >
          Deadline beschikbaarheid
        </label>

        <input
          id="beschikbaarheid-deadline"
          type="datetime-local"
          value={beschikbaarheidDeadline}
          onChange={(event) =>
            setBeschikbaarheidDeadline(event.target.value)
          }
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />

        <p className="mt-1 text-xs text-gray-500">
          Na deze deadline kan alleen een eigenaar de beschikbaarheid
          aanpassen.
        </p>
      </div>

      {fout && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{fout}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={laden}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {laden ? "Aanmaken..." : "Planningweek aanmaken"}
      </button>
    </form>
  );
}