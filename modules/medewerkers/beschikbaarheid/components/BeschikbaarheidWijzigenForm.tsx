"use client";

import { useState } from "react";

import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type BeschikbaarheidStatus =
  | "BESCHIKBAAR"
  | "NIET_BESCHIKBAAR"
  | "VOORKEUR";

type BeschikbaarheidWijzigenFormProps = {
  medewerkerId: string;
  beschikbaarheidId: string;
  datum: Date | string;
  begintijd: Date | string;
  eindtijd: Date | string;
  status: string;
  opmerking: string | null;
  onCancel: () => void;
  onSaved: () => void;
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

function datumWaarde(
  value: Date | string,
): string {
  const datum =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(datum.getTime())) {
    return "";
  }

  const jaar = datum.getFullYear();

  const maand = String(
    datum.getMonth() + 1,
  ).padStart(2, "0");

  const dag = String(
    datum.getDate(),
  ).padStart(2, "0");

  return `${jaar}-${maand}-${dag}`;
}

function tijdWaarde(
  value: Date | string,
): string {
  const datum =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(datum.getTime())) {
    return "";
  }

  const uren = String(
    datum.getHours(),
  ).padStart(2, "0");

  const minuten = String(
    datum.getMinutes(),
  ).padStart(2, "0");

  return `${uren}:${minuten}`;
}

function geldigeStatus(
  value: string,
): BeschikbaarheidStatus {
  if (value === "VOORKEUR") {
    return "VOORKEUR";
  }

  if (
    value === "NIET_BESCHIKBAAR"
  ) {
    return "NIET_BESCHIKBAAR";
  }

  return "BESCHIKBAAR";
}

export default function BeschikbaarheidWijzigenForm({
  medewerkerId,
  beschikbaarheidId,
  datum: oorspronkelijkeDatum,
  begintijd: oorspronkelijkeBegintijd,
  eindtijd: oorspronkelijkeEindtijd,
  status: oorspronkelijkeStatus,
  opmerking: oorspronkelijkeOpmerking,
  onCancel,
  onSaved,
}: BeschikbaarheidWijzigenFormProps) {
  const [datum, setDatum] =
    useState(
      datumWaarde(
        oorspronkelijkeDatum,
      ),
    );

  const [begintijd, setBegintijd] =
    useState(
      tijdWaarde(
        oorspronkelijkeBegintijd,
      ),
    );

  const [eindtijd, setEindtijd] =
    useState(
      tijdWaarde(
        oorspronkelijkeEindtijd,
      ),
    );

  const [status, setStatus] =
    useState(
      geldigeStatus(
        oorspronkelijkeStatus,
      ),
    );

  const [opmerking, setOpmerking] =
    useState(
      oorspronkelijkeOpmerking ?? "",
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");

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
          "Selecteer een begin- en eindtijd van je beschikbaarheid.",
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
          "De begintijd van je beschikbaarheid moet vóór de eindtijd liggen.",
        );
      }

      const response =
        await fetch(
          `/api/medewerkers/${medewerkerId}/beschikbaarheid/${beschikbaarheidId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
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
            "Beschikbaarheid wijzigen is mislukt.",
        );
      }

      onSaved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Beschikbaarheid wijzigen is mislukt.",
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

      <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3">
        <p className="text-sm font-semibold text-cyan-900">
          Jouw beschikbaarheid
        </p>

        <p className="mt-1 text-sm text-cyan-800">
          Geef aan binnen welk tijdvak je
          op deze datum beschikbaar bent
          om te werken. Dit is niet de
          begin- of eindtijd van een dienst.
        </p>

        <p className="mt-2 text-xs font-medium text-cyan-700">
          Beschikbaarheid kan worden
          opgegeven van 09:00 tot 23:00,
          in stappen van 30 minuten.
        </p>
      </div>

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
            htmlFor={`begintijd-${beschikbaarheidId}`}
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Beschikbaar vanaf
          </label>

          <select
            id={`begintijd-${beschikbaarheidId}`}
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
            htmlFor={`eindtijd-${beschikbaarheidId}`}
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Beschikbaar tot
          </label>

          <select
            id={`eindtijd-${beschikbaarheidId}`}
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

      <div>
        <label
          htmlFor={`status-${beschikbaarheidId}`}
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Type beschikbaarheid
        </label>

        <select
          id={`status-${beschikbaarheidId}`}
          name="status"
          value={status}
          onChange={(event) =>
            setStatus(
              geldigeStatus(
                event.target.value,
              ),
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

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          Annuleren
        </Button>

        <Button
          type="submit"
          disabled={saving}
        >
          {saving
            ? "Opslaan..."
            : "Wijzigingen opslaan"}
        </Button>
      </div>
    </Form>
  );
}