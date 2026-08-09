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

type BezettingFormProps = {
  dienstId: string;
  vestigingId: string;
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

export default function BezettingForm({
  dienstId,
  vestigingId,
  onAangemaakt,
}: BezettingFormProps) {
  const [medewerkers, setMedewerkers] =
    useState<Medewerker[]>([]);

  const [medewerkerId, setMedewerkerId] =
    useState("");

  const [status, setStatus] = useState<
    "GEPLAND" | "BEVESTIGD"
  >("GEPLAND");

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
      try {
        setLadenMedewerkers(true);
        setFout(null);

        const response = await fetch(
          `/api/planning/medewerkers?vestigingId=${encodeURIComponent(
            vestigingId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.fout ??
              "De medewerkers konden niet worden opgehaald.",
          );
        }

        if (actief) {
          setMedewerkers(data);
        }
      } catch (error) {
        console.error(
          "Fout bij laden medewerkers:",
          error,
        );

        if (actief) {
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

    if (vestigingId) {
      void laadMedewerkers();
    } else {
      setMedewerkers([]);
      setLadenMedewerkers(false);
    }

    return () => {
      actief = false;
    };
  }, [vestigingId]);

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

      const response = await fetch(
        "/api/planning/bezetting",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            dienstId,
            medewerkerId,
            status,
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
      setStatus("GEPLAND");

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
      className="space-y-5 rounded-xl border bg-white p-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Medewerker inplannen
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Voeg een medewerker toe aan
          deze dienst.
        </p>
      </div>

      <div>
        <label
          htmlFor="bezetting-medewerker"
          className="block text-sm font-medium text-gray-900"
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
          disabled={ladenMedewerkers}
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 disabled:opacity-50"
          required
        >
          <option value="">
            {ladenMedewerkers
              ? "Medewerkers laden..."
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
              </option>
            ),
          )}
        </select>

        {!ladenMedewerkers &&
          medewerkers.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Er zijn geen actieve
              medewerkers beschikbaar
              voor deze vestiging.
            </p>
          )}
      </div>

      <div>
        <label
          htmlFor="bezetting-status"
          className="block text-sm font-medium text-gray-900"
        >
          Status
        </label>

        <select
          id="bezetting-status"
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value as
                | "GEPLAND"
                | "BEVESTIGD",
            )
          }
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900"
        >
          <option value="GEPLAND">
            Gepland
          </option>

          <option value="BEVESTIGD">
            Bevestigd
          </option>
        </select>
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
        disabled={
          laden ||
          ladenMedewerkers ||
          medewerkers.length === 0
        }
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {laden
          ? "Inplannen..."
          : "Medewerker inplannen"}
      </button>
    </form>
  );
}