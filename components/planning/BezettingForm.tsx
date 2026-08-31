"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

type Medewerker = {
  id: string;
  personeelsnummer: string | null;
  aanhef:
    | "DHR"
    | "MEVR"
    | "ANDERS"
    | "GEEN_OPGAVE";
  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;
};

type MedewerkersResponse = {
  huidigeMedewerkerId: string | null;
  medewerkers: Medewerker[];
};

type BezettingFormProps = {
  dienstId: string;
  vestigingId: string;
  datum?: string;
  onAangemaakt?: () => void;
};

function naamMedewerker(
  medewerker: Medewerker,
) {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

function datumVoorApi(
  datum: string,
) {
  const waarde = new Date(datum);

  if (Number.isNaN(waarde.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "sv-SE",
  ).format(waarde);
}

export default function BezettingForm({
  dienstId,
  vestigingId,
  datum,
  onAangemaakt,
}: BezettingFormProps) {
  const [medewerkers, setMedewerkers] =
    useState<Medewerker[]>([]);

  const [medewerkerId, setMedewerkerId] =
    useState("");

  const [
    ladenMedewerkers,
    setLadenMedewerkers,
  ] = useState(true);

  const [laden, setLaden] =
    useState(false);

  const [fout, setFout] =
    useState<string | null>(null);

  useEffect(() => {
    let actief = true;

    async function laadMedewerkers() {
      if (!vestigingId) {
        if (actief) {
          setMedewerkers([]);
          setLadenMedewerkers(false);
        }

        return;
      }

      if (!datum) {
        if (actief) {
          setMedewerkers([]);
          setLadenMedewerkers(false);
          setFout(
            "De datum van de dienst ontbreekt.",
          );
        }

        return;
      }

      const datumVoorRequest =
        datumVoorApi(datum);

      if (!datumVoorRequest) {
        if (actief) {
          setMedewerkers([]);
          setLadenMedewerkers(false);
          setFout(
            "De datum van de dienst is ongeldig.",
          );
        }

        return;
      }

      try {
        setLadenMedewerkers(true);
        setFout(null);

        const response =
          await fetch(
            `/api/planning/medewerkers?vestigingId=${encodeURIComponent(
              vestigingId,
            )}&datum=${encodeURIComponent(
              datumVoorRequest,
            )}`,
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as
            | MedewerkersResponse
            | { fout?: string };

        if (!response.ok) {
          throw new Error(
            "fout" in data &&
            typeof data.fout ===
              "string"
              ? data.fout
              : "De medewerkers konden niet worden opgehaald.",
          );
        }

        if (
          !data ||
          typeof data !== "object" ||
          !("medewerkers" in data) ||
          !Array.isArray(
            data.medewerkers,
          )
        ) {
          throw new Error(
            "Ongeldige medewerkersgegevens ontvangen.",
          );
        }

        if (actief) {
          setMedewerkers(
            data.medewerkers,
          );
        }
      } catch (error) {
        console.error(
          "Fout bij laden medewerkers:",
          error,
        );

        if (actief) {
          setMedewerkers([]);

          setFout(
            error instanceof Error
              ? error.message
              : "De medewerkers konden niet worden opgehaald.",
          );
        }
      } finally {
        if (actief) {
          setLadenMedewerkers(false);
        }
      }
    }

    void laadMedewerkers();

    return () => {
      actief = false;
    };
  }, [vestigingId, datum]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFout(null);

    if (!dienstId) {
      setFout(
        "Dienst is verplicht.",
      );
      return;
    }

    if (!vestigingId) {
      setFout(
        "Vestiging is verplicht.",
      );
      return;
    }

    if (!medewerkerId) {
      setFout(
        "Selecteer een medewerker.",
      );
      return;
    }

    try {
      setLaden(true);

      const response =
        await fetch(
          "/api/planning/bezetting",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              dienstId,
              medewerkerId,
              status: "BEVESTIGD",
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De medewerker kon niet worden ingepland.",
        );
      }

      setMedewerkerId("");

      onAangemaakt?.();
    } catch (error) {
      console.error(
        "Fout bij toevoegen bezetting:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De medewerker kon niet worden ingepland.",
      );
    } finally {
      setLaden(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Medewerker inplannen
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Voeg een medewerker toe aan
          deze dienst.
        </p>
      </div>

      <div>
        <label
          htmlFor="bezetting-medewerker"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Medewerker
        </label>

        <select
          id="bezetting-medewerker"
          value={medewerkerId}
          onChange={(event) =>
            setMedewerkerId(
              event.target.value,
            )
          }
          disabled={
            ladenMedewerkers ||
            laden
          }
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
          required
        >
          <option value="">
            {ladenMedewerkers
              ? "Medewerkers laden..."
              : medewerkers.length === 0
                ? "Geen medewerkers beschikbaar"
                : "Selecteer medewerker"}
          </option>

          {medewerkers.map(
            (medewerker) => (
              <option
                key={medewerker.id}
                value={medewerker.id}
              >
                {naamMedewerker(
                  medewerker,
                )}
                {medewerker.personeelsnummer
                  ? ` — ${medewerker.personeelsnummer}`
                  : ""}
              </option>
            ),
          )}
        </select>

        {!ladenMedewerkers &&
          medewerkers.length === 0 &&
          !fout && (
            <p className="mt-2 text-xs text-slate-500">
              Er zijn geen actieve
              medewerkers beschikbaar
              voor deze vestiging.
            </p>
          )}
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
            ✓
          </span>

          <p className="text-sm font-semibold text-emerald-800">
            Direct bevestigd
          </p>
        </div>

        <p className="mt-1.5 text-xs leading-5 text-emerald-700">
          Een medewerker die hier aan
          de dienst wordt gekoppeld,
          krijgt direct de status
          Bevestigd.
        </p>
      </div>

      {fout && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">
            {fout}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            laden ||
            ladenMedewerkers ||
            medewerkers.length === 0 ||
            !medewerkerId
          }
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {laden
            ? "Inplannen..."
            : "Medewerker inplannen"}
        </button>
      </div>
    </form>
  );
}