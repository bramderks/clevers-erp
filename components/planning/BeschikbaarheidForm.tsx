"use client";

import { FormEvent, useState } from "react";

import type { BeschikbaarheidStatus } from "@/types/planning";

type BeschikbaarheidFormProps = {
  weekId: string;
  medewerkerId: string;
  onAangemaakt?: () => void;
};

export default function BeschikbaarheidForm({
  weekId,
  medewerkerId,
  onAangemaakt,
}: BeschikbaarheidFormProps) {
  const [datum, setDatum] = useState("");
  const [begintijd, setBegintijd] =
    useState("");
  const [eindtijd, setEindtijd] =
    useState("");

  const [status, setStatus] =
    useState<BeschikbaarheidStatus>(
      "BESCHIKBAAR",
    );

  const [opmerking, setOpmerking] =
    useState("");

  const [laden, setLaden] =
    useState(false);

  const [fout, setFout] =
    useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFout(null);

    if (!weekId || !medewerkerId) {
      setFout(
        "Planningweek en medewerker zijn verplicht.",
      );
      return;
    }

    if (
      !datum ||
      !begintijd ||
      !eindtijd
    ) {
      setFout(
        "Datum, begintijd en eindtijd zijn verplicht.",
      );
      return;
    }

    const datumWaarde = new Date(
      `${datum}T00:00`,
    );

    const start = new Date(
      `${datum}T${begintijd}`,
    );

    const einde = new Date(
      `${datum}T${eindtijd}`,
    );

    if (
      Number.isNaN(
        datumWaarde.getTime(),
      ) ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(einde.getTime())
    ) {
      setFout(
        "Vul een geldige datum en tijd in.",
      );
      return;
    }

    if (einde <= start) {
      setFout(
        "Eindtijd moet na de begintijd liggen.",
      );
      return;
    }

    try {
      setLaden(true);

      const response = await fetch(
        "/api/planning/beschikbaarheid",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            weekId,
            medewerkerId,
            datum:
              datumWaarde.toISOString(),
            begintijd:
              start.toISOString(),
            eindtijd:
              einde.toISOString(),
            status,
            opmerking:
              opmerking.trim() || null,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De beschikbaarheid kon niet worden aangemaakt.",
        );
      }

      setDatum("");
      setBegintijd("");
      setEindtijd("");
      setStatus("BESCHIKBAAR");
      setOpmerking("");

      onAangemaakt?.();
    } catch (error) {
      console.error(
        "Fout bij aanmaken beschikbaarheid:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De beschikbaarheid kon niet worden aangemaakt.",
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
          Beschikbaarheid toevoegen
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Geef je eigen beschikbaarheid
          voor deze week op.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="beschikbaarheid-datum"
            className="block text-sm font-medium text-gray-900"
          >
            Datum
          </label>

          <input
            id="beschikbaarheid-datum"
            type="date"
            value={datum}
            onChange={(event) =>
              setDatum(
                event.target.value,
              )
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            required
          />
        </div>

        <div>
          <label
            htmlFor="beschikbaarheid-begintijd"
            className="block text-sm font-medium text-gray-900"
          >
            Begintijd
          </label>

          <input
            id="beschikbaarheid-begintijd"
            type="time"
            value={begintijd}
            onChange={(event) =>
              setBegintijd(
                event.target.value,
              )
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            required
          />
        </div>

        <div>
          <label
            htmlFor="beschikbaarheid-eindtijd"
            className="block text-sm font-medium text-gray-900"
          >
            Eindtijd
          </label>

          <input
            id="beschikbaarheid-eindtijd"
            type="time"
            value={eindtijd}
            onChange={(event) =>
              setEindtijd(
                event.target.value,
              )
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            required
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="beschikbaarheid-status"
          className="block text-sm font-medium text-gray-900"
        >
          Status
        </label>

        <select
          id="beschikbaarheid-status"
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value as BeschikbaarheidStatus,
            )
          }
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900"
        >
          <option value="BESCHIKBAAR">
            Beschikbaar
          </option>

          <option value="VOORKEUR">
            Voorkeur
          </option>

          <option value="NIET_BESCHIKBAAR">
            Niet beschikbaar
          </option>
        </select>
      </div>

      <div>
        <label
          htmlFor="beschikbaarheid-opmerking"
          className="block text-sm font-medium text-gray-900"
        >
          Opmerking
        </label>

        <textarea
          id="beschikbaarheid-opmerking"
          value={opmerking}
          onChange={(event) =>
            setOpmerking(
              event.target.value,
            )
          }
          rows={3}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
      </div>

      {fout && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">
            {fout}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={laden}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {laden
          ? "Opslaan..."
          : "Beschikbaarheid opslaan"}
      </button>
    </form>
  );
}