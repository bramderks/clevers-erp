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

type BeschikbaarheidFormProps = {
  medewerkerId: string;
  weekId: string;
};

export default function BeschikbaarheidForm({
  medewerkerId,
  weekId,
}: BeschikbaarheidFormProps) {
  const router = useRouter();

  const [datum, setDatum] = useState("");
  const [begintijd, setBegintijd] = useState("");
  const [eindtijd, setEindtijd] = useState("");

  const [status, setStatus] =
    useState<BeschikbaarheidStatus>(
      "BESCHIKBAAR",
    );

  const [opmerking, setOpmerking] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
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
        `/api/medewerkers/${medewerkerId}/beschikbaarheid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            weekId,
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

      router.refresh();
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
            setDatum(event.target.value)
          }
          required
        />

        <Input
          label="Van"
          name="begintijd"
          type="time"
          value={begintijd}
          onChange={(event) =>
            setBegintijd(event.target.value)
          }
          required
        />

        <Input
          label="Tot"
          name="eindtijd"
          type="time"
          value={eindtijd}
          onChange={(event) =>
            setEindtijd(event.target.value)
          }
          required
        />
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
          setOpmerking(event.target.value)
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