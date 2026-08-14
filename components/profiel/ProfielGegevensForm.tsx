"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";

type ProfielGegevens = {
  aanhef:
    | "DHR"
    | "MEVR"
    | "ANDERS"
    | "GEEN_OPGAVE";
  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;
  roepnaam: string | null;
  email: string;
  telefoon: string;
};

type ProfielGegevensFormProps = {
  gegevens: ProfielGegevens;
  onOpgeslagen?: () => void;
};

export default function ProfielGegevensForm({
  gegevens,
  onOpgeslagen,
}: ProfielGegevensFormProps) {
  const [open, setOpen] =
    useState(false);

  const [voornaam, setVoornaam] =
    useState(gegevens.voornaam);

  const [tussenvoegsel, setTussenvoegsel] =
    useState(
      gegevens.tussenvoegsel ?? "",
    );

  const [achternaam, setAchternaam] =
    useState(gegevens.achternaam);

  const [roepnaam, setRoepnaam] =
    useState(
      gegevens.roepnaam ?? "",
    );

  const [email, setEmail] =
    useState(gegevens.email);

  const [telefoon, setTelefoon] =
    useState(
      gegevens.telefoon,
    );

  const [opslaanBezig, setOpslaanBezig] =
    useState(false);

  const [fout, setFout] =
    useState("");

  const [succes, setSucces] =
    useState("");

  function startBewerken() {
    setVoornaam(gegevens.voornaam);
    setTussenvoegsel(
      gegevens.tussenvoegsel ?? "",
    );
    setAchternaam(
      gegevens.achternaam,
    );
    setRoepnaam(
      gegevens.roepnaam ?? "",
    );
    setEmail(gegevens.email);
    setTelefoon(
      gegevens.telefoon,
    );

    setFout("");
    setSucces("");
    setOpen(true);
  }

  function annuleer() {
    setVoornaam(gegevens.voornaam);
    setTussenvoegsel(
      gegevens.tussenvoegsel ?? "",
    );
    setAchternaam(
      gegevens.achternaam,
    );
    setRoepnaam(
      gegevens.roepnaam ?? "",
    );
    setEmail(gegevens.email);
    setTelefoon(
      gegevens.telefoon,
    );

    setFout("");
    setSucces("");
    setOpen(false);
  }

  async function opslaan(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setOpslaanBezig(true);
    setFout("");
    setSucces("");

    try {
      const response =
        await fetch(
          "/api/profiel",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              voornaam,
              tussenvoegsel:
                tussenvoegsel.trim() ||
                null,
              achternaam,
              roepnaam:
                roepnaam.trim() ||
                null,
              email,
              telefoon,
            }),
          },
        );

      const resultaat =
        await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat.error ??
            "De gegevens konden niet worden opgeslagen.",
        );
      }

      setSucces(
        "Je gegevens zijn opgeslagen.",
      );

      setOpen(false);

      onOpgeslagen?.();
    } catch (error) {
      setFout(
        error instanceof Error
          ? error.message
          : "De gegevens konden niet worden opgeslagen.",
      );
    } finally {
      setOpslaanBezig(false);
    }
  }

  if (!open) {
    return (
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Persoonsgegevens
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Gegevens die bij je account horen.
            </p>
          </div>

          <Button
            type="button"
            onClick={startBewerken}
          >
            Wijzigen
          </Button>
        </div>

        <dl className="mt-6 space-y-5">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Voornaam
            </dt>

            <dd className="mt-1 text-sm font-medium text-slate-900">
              {gegevens.voornaam}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Tussenvoegsel
            </dt>

            <dd className="mt-1 text-sm font-medium text-slate-900">
              {gegevens.tussenvoegsel ||
                "—"}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Achternaam
            </dt>

            <dd className="mt-1 text-sm font-medium text-slate-900">
              {gegevens.achternaam}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Roepnaam
            </dt>

            <dd className="mt-1 text-sm font-medium text-slate-900">
              {gegevens.roepnaam ||
                "—"}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              E-mailadres
            </dt>

            <dd className="mt-1 text-sm font-medium text-slate-900">
              {gegevens.email}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Telefoonnummer
            </dt>

            <dd className="mt-1 text-sm font-medium text-slate-900">
              {gegevens.telefoon ||
                "—"}
            </dd>
          </div>
        </dl>

        {succes && (
          <p className="mt-4 text-sm font-medium text-emerald-600">
            {succes}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={opslaan}
      className="space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Persoonsgegevens wijzigen
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Wijzig hier je eigen persoonlijke gegevens.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="profiel-voornaam"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Voornaam
          </label>

          <input
            id="profiel-voornaam"
            value={voornaam}
            onChange={(event) =>
              setVoornaam(
                event.target.value,
              )
            }
            required
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="profiel-tussenvoegsel"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Tussenvoegsel
          </label>

          <input
            id="profiel-tussenvoegsel"
            value={tussenvoegsel}
            onChange={(event) =>
              setTussenvoegsel(
                event.target.value,
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="profiel-achternaam"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Achternaam
          </label>

          <input
            id="profiel-achternaam"
            value={achternaam}
            onChange={(event) =>
              setAchternaam(
                event.target.value,
              )
            }
            required
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="profiel-roepnaam"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Roepnaam
          </label>

          <input
            id="profiel-roepnaam"
            value={roepnaam}
            onChange={(event) =>
              setRoepnaam(
                event.target.value,
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="profiel-email"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            E-mailadres
          </label>

          <input
            id="profiel-email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value,
              )
            }
            required
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="profiel-telefoon"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Telefoonnummer
          </label>

          <input
            id="profiel-telefoon"
            type="tel"
            value={telefoon}
            onChange={(event) =>
              setTelefoon(
                event.target.value,
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>
      </div>

      {fout && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fout}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        <Button
          type="button"
          onClick={annuleer}
          disabled={opslaanBezig}
          variant="secondary"
        >
          Annuleren
        </Button>

        <Button
          type="submit"
          disabled={opslaanBezig}
        >
          {opslaanBezig
            ? "Opslaan..."
            : "Opslaan"}
        </Button>
      </div>
    </form>
  );
}