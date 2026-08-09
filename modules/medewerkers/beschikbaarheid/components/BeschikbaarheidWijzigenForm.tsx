"use client";

import { useRouter } from "next/navigation";
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

function datumWaarde(
  value: Date | string,
) {
  const datum =
    value instanceof Date
      ? value
      : new Date(value);

  const jaar =
    datum.getFullYear();

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
) {
  const datum =
    value instanceof Date
      ? value
      : new Date(value);

  const uren = String(
    datum.getHours(),
  ).padStart(2, "0");

  const minuten = String(
    datum.getMinutes(),
  ).padStart(2, "0");

  return `${uren}:${minuten}`;
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
  const router = useRouter();

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
    useState<BeschikbaarheidStatus>(
      oorspronkelijkeStatus as BeschikbaarheidStatus,
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

      if (!begintijd || !eindtijd) {
        throw new Error(
          "Vul een begin- en eindtijd in.",
        );
      }

      if (begintijd >= eindtijd) {
        throw new Error(
          "De begintijd moet vóór de eindtijd liggen.",
        );
      }

      const response = await fetch(
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
              opmerking.trim() || null,
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

      router.refresh();
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

        <Input
          label="Van"
          name="begintijd"
          type="time"
          value={begintijd}
          onChange={(event) =>
            setBegintijd(
              event.target.value,
            )
          }
          required
        />

        <Input
          label="Tot"
          name="eindtijd"
          type="time"
          value={eindtijd}
          onChange={(event) =>
            setEindtijd(
              event.target.value,
            )
          }
          required
        />
      </div>

      <div>
        <label
          htmlFor={`status-${beschikbaarheidId}`}
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Beschikbaarheid
        </label>

        <select
          id={`status-${beschikbaarheidId}`}
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