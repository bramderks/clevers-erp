"use client";

import {
  useState,
  useTransition,
} from "react";

type GenereerVerloningFormProps = {
  standaardJaar: number;
  standaardMaand: number;
};

type GenereerVerloningResponse = {
  succes: boolean;
  status?: string;
  bericht?: string;
  fout?: string;
};

const maanden = [
  {
    waarde: 1,
    naam: "Januari",
  },
  {
    waarde: 2,
    naam: "Februari",
  },
  {
    waarde: 3,
    naam: "Maart",
  },
  {
    waarde: 4,
    naam: "April",
  },
  {
    waarde: 5,
    naam: "Mei",
  },
  {
    waarde: 6,
    naam: "Juni",
  },
  {
    waarde: 7,
    naam: "Juli",
  },
  {
    waarde: 8,
    naam: "Augustus",
  },
  {
    waarde: 9,
    naam: "September",
  },
  {
    waarde: 10,
    naam: "Oktober",
  },
  {
    waarde: 11,
    naam: "November",
  },
  {
    waarde: 12,
    naam: "December",
  },
];

export default function GenereerVerloningForm({
  standaardJaar,
  standaardMaand,
}: GenereerVerloningFormProps) {
  /*
   * ============================================================
   * STATE
   * ============================================================
   */

  const [jaar, setJaar] =
    useState(standaardJaar);

  const [maand, setMaand] =
    useState(standaardMaand);

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [fout, setFout] =
    useState<string | null>(null);

  /*
   * ============================================================
   * VERLONING GENEREREN
   * ============================================================
   */

  function handleGenereren() {
    setFout(null);

    /*
     * ==========================================================
     * INVOER CONTROLEREN
     * ==========================================================
     */

    if (
      !Number.isInteger(jaar) ||
      jaar < 2020 ||
      jaar > 2100
    ) {
      setFout(
        "Vul een geldig jaar in.",
      );

      return;
    }

    if (
      !Number.isInteger(maand) ||
      maand < 1 ||
      maand > 12
    ) {
      setFout(
        "Selecteer een geldige maand.",
      );

      return;
    }

    /*
     * ==========================================================
     * API AANROEP
     * ==========================================================
     */

    startTransition(async () => {
      try {
        const response =
          await fetch(
            "/api/verloning/genereren",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                jaar,
                maand,
              }),
            },
          );

        let resultaat:
          GenereerVerloningResponse;

        try {
          resultaat =
            await response.json();
        } catch {
          throw new Error(
            "De server gaf een ongeldige reactie terug.",
          );
        }

        /*
         * ========================================================
         * FOUT
         * ========================================================
         */

        if (
          !response.ok ||
          !resultaat.succes
        ) {
          throw new Error(
            resultaat.fout ??
              resultaat.bericht ??
              "De verloning kon niet worden gegenereerd.",
          );
        }

        /*
         * ========================================================
         * SUCCES
         * ========================================================
         *
         * De verloningspagina wordt opnieuw geladen zodat:
         *
         * - de nieuwe periode direct verschijnt;
         * - de actuele status zichtbaar is;
         * - alle totalen opnieuw vanaf de server worden geladen.
         * ========================================================
         */

        window.location.reload();
      } catch (error) {
        setFout(
          error instanceof Error
            ? error.message
            : "De verloning kon niet worden gegenereerd.",
        );
      }
    });
  }

  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="border-b bg-slate-50 px-6 py-5">
        <h2 className="font-semibold text-slate-900">
          Verloning handmatig genereren
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Genereer handmatig een maandoverzicht
          wanneer dit nog niet automatisch is
          aangemaakt.
        </p>
      </div>

      <div className="space-y-5 p-6">
        {/* ======================================================
         * PERIODE SELECTEREN
         * ====================================================== */}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="maand"
              className="text-sm font-medium text-slate-700"
            >
              Maand
            </label>

            <select
              id="maand"
              value={maand}
              onChange={(event) =>
                setMaand(
                  Number(
                    event.target.value,
                  ),
                )
              }
              disabled={isPending}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {maanden.map(
                (item) => (
                  <option
                    key={item.waarde}
                    value={item.waarde}
                  >
                    {item.naam}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="jaar"
              className="text-sm font-medium text-slate-700"
            >
              Jaar
            </label>

            <input
              id="jaar"
              type="number"
              min="2020"
              max="2100"
              step="1"
              value={jaar}
              onChange={(event) =>
                setJaar(
                  Number(
                    event.target.value,
                  ),
                )
              }
              disabled={isPending}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* ======================================================
         * FOUTMELDING
         * ====================================================== */}

        {fout && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-700">
              {fout}
            </p>
          </div>
        )}

        {/* ======================================================
         * ACTIE
         * ====================================================== */}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenereren}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Verloning genereren..."
              : "Verloning genereren"}
          </button>
        </div>
      </div>
    </section>
  );
}