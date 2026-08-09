"use client";

import { useState } from "react";

import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type Medewerker = {
  id: string;

  personeelsnummer: string | null;

  aanhef: "DHR" | "MEVR" | "ANDERS" | "GEEN_OPGAVE";

  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;
  roepnaam: string | null;

  geboortedatum: Date | string;

  email: string;
  telefoon: string;

  contractType:
    | "OPROEP"
    | "TIJDELIJK"
    | "VAST"
    | "STAGIAIR"
    | "VAKANTIEKRACHT"
    | null;

  contractUren: number | string | null;

  uurloon: number | string | null;

  datumInDienst: Date | string | null;
  datumUitDienst: Date | string | null;
};

type MedewerkerFormProps = {
  medewerker: Medewerker;
};

function formatDate(
  value: Date | string | null,
) {
  if (!value) {
    return "";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatAanhef(
  value: Medewerker["aanhef"],
) {
  switch (value) {
    case "DHR":
      return "Dhr.";
    case "MEVR":
      return "Mevr.";
    case "ANDERS":
      return "Anders";
    case "GEEN_OPGAVE":
      return "Geen opgave";
  }
}

function formatContractType(
  value: Medewerker["contractType"],
) {
  switch (value) {
    case "OPROEP":
      return "Oproep";
    case "TIJDELIJK":
      return "Tijdelijk";
    case "VAST":
      return "Vast";
    case "STAGIAIR":
      return "Stagiair";
    case "VAKANTIEKRACHT":
      return "Vakantiekracht";
    default:
      return "Nog niet ingevuld";
  }
}

function formatUurloon(
  value: number | string | null,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Niet ingevuld";
  }

  const bedrag = Number(value);

  if (Number.isNaN(bedrag)) {
    return "Niet ingevuld";
  }

  return `€ ${bedrag.toFixed(2).replace(".", ",")}`;
}

export default function MedewerkerForm({
  medewerker,
}: MedewerkerFormProps) {
  const [bewerken, setBewerken] =
    useState(false);

  const [form, setForm] = useState({
    personeelsnummer:
      medewerker.personeelsnummer ?? "",

    aanhef: medewerker.aanhef,

    voornaam: medewerker.voornaam,

    tussenvoegsel:
      medewerker.tussenvoegsel ?? "",

    achternaam: medewerker.achternaam,

    roepnaam:
      medewerker.roepnaam ?? "",

    geboortedatum: formatDate(
      medewerker.geboortedatum,
    ),

    email: medewerker.email,

    telefoon: medewerker.telefoon,

    contractType:
      medewerker.contractType ?? "",

    contractUren:
      medewerker.contractUren?.toString() ?? "",

    uurloon:
      medewerker.uurloon?.toString() ?? "",

    datumInDienst: formatDate(
      medewerker.datumInDienst,
    ),

    datumUitDienst: formatDate(
      medewerker.datumUitDienst,
    ),
  });

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  function updateField(
    field: keyof typeof form,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  }

  function annuleren() {
    setForm({
      personeelsnummer:
        medewerker.personeelsnummer ?? "",

      aanhef: medewerker.aanhef,

      voornaam: medewerker.voornaam,

      tussenvoegsel:
        medewerker.tussenvoegsel ?? "",

      achternaam: medewerker.achternaam,

      roepnaam:
        medewerker.roepnaam ?? "",

      geboortedatum: formatDate(
        medewerker.geboortedatum,
      ),

      email: medewerker.email,

      telefoon: medewerker.telefoon,

      contractType:
        medewerker.contractType ?? "",

      contractUren:
        medewerker.contractUren?.toString() ?? "",

      uurloon:
        medewerker.uurloon?.toString() ?? "",

      datumInDienst: formatDate(
        medewerker.datumInDienst,
      ),

      datumUitDienst: formatDate(
        medewerker.datumUitDienst,
      ),
    });

    setError("");
    setSuccess("");
    setBewerken(false);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/medewerkers/${medewerker.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personeelsnummer:
              form.personeelsnummer || null,

            aanhef: form.aanhef,

            voornaam: form.voornaam,

            tussenvoegsel:
              form.tussenvoegsel || null,

            achternaam: form.achternaam,

            roepnaam:
              form.roepnaam || null,

            geboortedatum:
              form.geboortedatum,

            email: form.email,

            telefoon: form.telefoon,

            contractType:
              form.contractType || null,

            contractUren:
              form.contractUren
                ? Number(form.contractUren)
                : null,

            uurloon:
              form.uurloon
                ? Number(form.uurloon)
                : null,

            datumInDienst:
              form.datumInDienst || null,

            datumUitDienst:
              form.datumUitDienst || null,
          }),
        },
      );

      const resultaat =
        await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat.error ??
            "Opslaan is mislukt.",
        );
      }

      setSuccess(
        "De gegevens zijn succesvol opgeslagen.",
      );

      setBewerken(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Opslaan is mislukt.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!bewerken) {
    return (
      <div className="space-y-8">
        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Personeelsnummer
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {medewerker.personeelsnummer ||
                "Niet ingevuld"}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Aanhef
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {formatAanhef(
                medewerker.aanhef,
              )}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Voornaam
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {medewerker.voornaam}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Tussenvoegsel
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {medewerker.tussenvoegsel ||
                "Niet ingevuld"}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Achternaam
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {medewerker.achternaam}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Roepnaam
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {medewerker.roepnaam ||
                "Niet ingevuld"}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Geboortedatum
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {formatDate(
                medewerker.geboortedatum,
              ) || "Niet ingevuld"}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              E-mailadres
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {medewerker.email}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Telefoonnummer
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {medewerker.telefoon}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Dienstverband
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Deze gegevens worden intern beheerd.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Contracttype
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {formatContractType(
                  medewerker.contractType,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Contracturen per week
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {medewerker.contractUren ??
                  "Niet ingevuld"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Uurloon
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {formatUurloon(
                  medewerker.uurloon,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Datum in dienst
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {formatDate(
                  medewerker.datumInDienst,
                ) || "Niet ingevuld"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Datum uit dienst
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {formatDate(
                  medewerker.datumUitDienst,
                ) || "Niet ingevuld"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 pt-6">
          <Button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setBewerken(true);
            }}
          >
            Gegevens bewerken
          </Button>
        </div>
      </div>
    );
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Input
          label="Personeelsnummer"
          name="personeelsnummer"
          value={form.personeelsnummer}
          onChange={(event) =>
            updateField(
              "personeelsnummer",
              event.target.value,
            )
          }
        />

        <div>
          <label
            htmlFor="aanhef"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Aanhef
          </label>

          <select
            id="aanhef"
            name="aanhef"
            value={form.aanhef}
            onChange={(event) =>
              updateField(
                "aanhef",
                event.target.value,
              )
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          >
            <option value="DHR">
              Dhr.
            </option>
            <option value="MEVR">
              Mevr.
            </option>
            <option value="ANDERS">
              Anders
            </option>
            <option value="GEEN_OPGAVE">
              Geen opgave
            </option>
          </select>
        </div>

        <Input
          label="Voornaam"
          name="voornaam"
          value={form.voornaam}
          onChange={(event) =>
            updateField(
              "voornaam",
              event.target.value,
            )
          }
          required
        />

        <Input
          label="Tussenvoegsel"
          name="tussenvoegsel"
          value={form.tussenvoegsel}
          onChange={(event) =>
            updateField(
              "tussenvoegsel",
              event.target.value,
            )
          }
        />

        <Input
          label="Achternaam"
          name="achternaam"
          value={form.achternaam}
          onChange={(event) =>
            updateField(
              "achternaam",
              event.target.value,
            )
          }
          required
        />

        <Input
          label="Roepnaam"
          name="roepnaam"
          value={form.roepnaam}
          onChange={(event) =>
            updateField(
              "roepnaam",
              event.target.value,
            )
          }
        />

        <Input
          label="Geboortedatum"
          name="geboortedatum"
          type="date"
          value={form.geboortedatum}
          onChange={(event) =>
            updateField(
              "geboortedatum",
              event.target.value,
            )
          }
          required
        />

        <Input
          label="E-mailadres"
          name="email"
          type="email"
          value={form.email}
          onChange={(event) =>
            updateField(
              "email",
              event.target.value,
            )
          }
          required
        />

        <Input
          label="Telefoonnummer"
          name="telefoon"
          type="tel"
          value={form.telefoon}
          onChange={(event) =>
            updateField(
              "telefoon",
              event.target.value,
            )
          }
          required
        />
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Dienstverband
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Deze gegevens worden intern beheerd.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <label
              htmlFor="contractType"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Contracttype
            </label>

            <select
              id="contractType"
              name="contractType"
              value={form.contractType}
              onChange={(event) =>
                updateField(
                  "contractType",
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              <option value="">
                Nog niet ingevuld
              </option>
              <option value="OPROEP">
                Oproep
              </option>
              <option value="TIJDELIJK">
                Tijdelijk
              </option>
              <option value="VAST">
                Vast
              </option>
              <option value="STAGIAIR">
                Stagiair
              </option>
              <option value="VAKANTIEKRACHT">
                Vakantiekracht
              </option>
            </select>
          </div>

          <Input
            label="Contracturen per week"
            name="contractUren"
            type="number"
            min="0"
            step="0.25"
            value={form.contractUren}
            onChange={(event) =>
              updateField(
                "contractUren",
                event.target.value,
              )
            }
          />

          <Input
            label="Uurloon"
            name="uurloon"
            type="number"
            min="0"
            step="0.01"
            value={form.uurloon}
            onChange={(event) =>
              updateField(
                "uurloon",
                event.target.value,
              )
            }
          />

          <Input
            label="Datum in dienst"
            name="datumInDienst"
            type="date"
            value={form.datumInDienst}
            onChange={(event) =>
              updateField(
                "datumInDienst",
                event.target.value,
              )
            }
          />

          <Input
            label="Datum uit dienst"
            name="datumUitDienst"
            type="date"
            value={form.datumUitDienst}
            onChange={(event) =>
              updateField(
                "datumUitDienst",
                event.target.value,
              )
            }
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
        <Button
          type="button"
          onClick={annuleren}
          disabled={saving}
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