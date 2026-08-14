"use client";

import { useState } from "react";

import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type BeschikbaarheidStatus =
  | "BESCHIKBAAR"
  | "NIET_BESCHIKBAAR"
  | "VOORKEUR";

type BeschikbaarheidFormProps = {
  medewerkerId: string;
  weekId: string;
};

const TIJDEN = Array.from(
  { length: 29 },
  (_, index) => {
    const totaalMinuten =
      9 * 60 + index * 30;

    const uren = Math.floor(
      totaalMinuten / 60,
    );

    const minuten =
      totaalMinuten % 60;

    return `${String(uren).padStart(
      2,
      "0",
    )}:${String(minuten).padStart(
      2,
      "0",
    )}`;
  },
);

export default function BeschikbaarheidForm({
  medewerkerId,
  weekId,
}: BeschikbaarheidFormProps) {
  const [datum, setDatum] =
    useState("");

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

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!datum) {
        throw new Error(
          "Selecteer een datum.",
        );
      }

      if (
        !begintijd ||
        !eindtijd
      ) {
        throw new Error(
          "Selecteer een begin- en eindtijd.",
        );
      }

      if (
        begintijd < "09:00" ||
        begintijd > "23:00" ||
        eindtijd < "09:00" ||
        eindtijd > "23:00"
      ) {
        throw new Error(
          "Beschikbaarheid kan alleen tussen 09:00 en 23:00 worden opgegeven.",
        );
      }

      if (begintijd >= eindtijd) {
        throw new Error(
          "De begintijd moet vóór de eindtijd liggen.",
        );
      }

      const response =
        await fetch(
          `/api/medewerkers/${medewerkerId}/beschikbaarheid`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              weekId,
              datum: `${datum}T00:00:00`,
              begintijd: `${datum}T${begintijd}:00`,
              eindtijd: `${datum}T${eindtijd}:00`,
              status,
              opmerking:
                opmerking.trim() ||
                null,
            }),
          },
        );

      const resultaat =
        await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat.error ??
            "Beschikbaarheid opslaan is mislukt.",
        );
      }

      setDatum("");
      setBegintijd("");
      setEindtijd("");
      setStatus("BESCHIKBAAR");
      setOpmerking("");

      setSuccess(
        "Beschikbaarheid succesvol opgeslagen.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Beschikbaarheid opslaan is mislukt.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Input
          label="Datum"
          name="datum"
          type="date"
          value={datum}
          onChange={(event) =>
            setDatum(
              event.target.value,
            )
          }
          required
        />

        <div>
          <label
            htmlFor="begintijd"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Beschikbaar vanaf
          </label>

          <select
            id="begintijd"
            name="begintijd"
            value={begintijd}
            onChange={(event) =>
              setBegintijd(
                event.target.value,
              )
            }
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          >
            <option value="">
              Kies tijd
            </option>

            {TIJDEN.map((tijd) => (
              <option
                key={tijd}
                value={tijd}
              >
                {tijd}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="eindtijd"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Beschikbaar tot
          </label>

          <select
            id="eindtijd"
            name="eindtijd"
            value={eindtijd}
            onChange={(event) =>
              setEindtijd(
                event.target.value,
              )
            }
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          >
            <option value="">
              Kies tijd
            </option>

            {TIJDEN.map((tijd) => (
              <option
                key={tijd}
                value={tijd}
                disabled={
                  begintijd !== "" &&
                  tijd <= begintijd
                }
              >
                {tijd}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3">
        <p className="text-sm font-semibold text-cyan-900">
          Beschikbaarheidsvenster
        </p>

        <p className="mt-1 text-sm text-cyan-800">
          Geef aan wanneer je beschikbaar
          bent. Je kunt tijden kiezen vanaf
          09:00 tot maximaal 23:00, steeds in
          stappen van 30 minuten.
        </p>
      </div>

      <div>
        <label
          htmlFor="status"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Beschikbaarheid
        </label>

        <select
          id="status"
          name="status"
          value={status}
          onChange={(event) =>
            setStatus(
              event.target
                .value as BeschikbaarheidStatus,
            )
          }
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
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

      <Input
        label="Opmerking"
        name="opmerking"
        value={opmerking}
        onChange={(event) =>
          setOpmerking(
            event.target.value,
          )
        }
        hint="Optioneel, bijvoorbeeld een voorkeur of toelichting."
      />

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving}
        >
          {saving
            ? "Opslaan..."
            : "Beschikbaarheid toevoegen"}
        </Button>
      </div>
    </Form>
  );
}