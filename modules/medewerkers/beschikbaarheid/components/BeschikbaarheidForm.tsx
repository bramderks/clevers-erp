"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type BeschikbaarheidStatus = "BESCHIKBAAR" | "NIET_BESCHIKBAAR" | "VOORKEUR";

type BeschikbaarheidFormProps = {
  medewerkerId: string;
  weekId: string;
};

const MIN_TIJD = "09:00";
const MAX_TIJD = "23:00";

export default function BeschikbaarheidForm({
  medewerkerId,
  weekId,
}: BeschikbaarheidFormProps) {
  const router = useRouter();

  const [datum, setDatum] = useState("");
  const [begintijd, setBegintijd] = useState("");
  const [eindtijd, setEindtijd] = useState("");
  const [totSluit, setTotSluit] = useState(false);

  const [status, setStatus] = useState<BeschikbaarheidStatus>("BESCHIKBAAR");
  const [opmerking, setOpmerking] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function wijzigDatum(value: string) {
    setDatum(value);
    setError("");
    setSuccess("");
  }

  function wijzigBegintijd(value: string) {
    setBegintijd(value);
    setError("");
    setSuccess("");
  }

  function wijzigEindtijd(value: string) {
    setEindtijd(value);
    setError("");
    setSuccess("");
  }

  function wijzigStatus(value: string) {
    if (
      value !== "BESCHIKBAAR" &&
      value !== "NIET_BESCHIKBAAR" &&
      value !== "VOORKEUR"
    ) {
      return;
    }

    setStatus(value);
    setError("");
    setSuccess("");
  }

  function wijzigOpmerking(value: string) {
    setOpmerking(value);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!datum) {
        throw new Error("Selecteer een datum.");
      }

      if (!begintijd) {
        throw new Error("Vul een begintijd in.");
      }

      if (!totSluit && !eindtijd) {
        throw new Error("Vul een eindtijd in of kies 'Tot sluit'.");
      }

      if (begintijd < MIN_TIJD || begintijd > MAX_TIJD) {
        throw new Error("De begintijd moet tussen 09:00 en 23:00 liggen.");
      }

      if (!totSluit) {
        if (eindtijd < MIN_TIJD || eindtijd > MAX_TIJD) {
          throw new Error("De eindtijd moet tussen 09:00 en 23:00 liggen.");
        }

        if (begintijd >= eindtijd) {
          throw new Error("De begintijd moet vóór de eindtijd liggen.");
        }
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
            eindtijd: totSluit ? null : `${datum}T${eindtijd}:00`,
            status,
            opmerking: opmerking.trim() || null,
            totSluit,
          }),
        }
      );

      const resultaat = await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat.error ?? "Beschikbaarheid opslaan is mislukt."
        );
      }

      setDatum("");
      setBegintijd("");
      setEindtijd("");
      setTotSluit(false);
      setStatus("BESCHIKBAAR");
      setOpmerking("");

      setSuccess("Beschikbaarheid succesvol opgeslagen.");

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Beschikbaarheid opslaan is mislukt."
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-medium text-slate-800">Beschikbare tijden</p>
        <p className="mt-1 text-sm text-slate-500">
          Beschikbaarheid kan worden opgegeven tussen 09:00 en 23:00.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Input
          label="Datum"
          name="datum"
          type="date"
          value={datum}
          onChange={(event) => wijzigDatum(event.target.value)}
          required
        />

        <Input
          label="Van"
          name="begintijd"
          type="time"
          min={MIN_TIJD}
          max={MAX_TIJD}
          value={begintijd}
          onChange={(event) => wijzigBegintijd(event.target.value)}
          required
        />

        <Input
          label="Tot"
          name="eindtijd"
          type="time"
          min={MIN_TIJD}
          max={MAX_TIJD}
          value={eindtijd}
          onChange={(event) => wijzigEindtijd(event.target.value)}
          required={!totSluit}
          disabled={totSluit}
          hint={totSluit ? "Je blijft tot sluit." : undefined}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="totSluit"
          type="checkbox"
          checked={totSluit}
          onChange={(e) => setTotSluit(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
        />
        <label htmlFor="totSluit" className="text-sm text-slate-700">
          Tot sluit
        </label>
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
          onChange={(event) => wijzigStatus(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
        >
          <option value="BESCHIKBAAR">Beschikbaar</option>
          <option value="VOORKEUR">Voorkeur</option>
          <option value="NIET_BESCHIKBAAR">Niet beschikbaar</option>
        </select>
      </div>

      <Input
        label="Opmerking"
        name="opmerking"
        value={opmerking}
        onChange={(event) => wijzigOpmerking(event.target.value)}
        hint="Optioneel, bijvoorbeeld een voorkeur of toelichting."
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Opslaan..." : "Beschikbaarheid toevoegen"}
        </Button>
      </div>
    </Form>
  );
}
