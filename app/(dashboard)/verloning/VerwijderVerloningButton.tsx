"use client";

import { useState, useTransition } from "react";

type Props = {
  verwijderAction: () => Promise<void>;
  compact?: boolean;
};

export default function VerwijderVerloningButton({
  verwijderAction,
  compact = false,
}: Props) {
  const [bevestigen, setBevestigen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function verwijderen() {
    setFout(null);

    startTransition(async () => {
      try {
        await verwijderAction();
      } catch (error) {
        setFout(
          error instanceof Error
            ? error.message
            : "De verloningsperiode kon niet worden verwijderd.",
        );
      }
    });
  }

  if (!bevestigen) {
    return (
      <button
        type="button"
        onClick={() => setBevestigen(true)}
        className={
          compact
            ? "rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            : "rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
        }
      >
        Verloning verwijderen
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="font-semibold text-red-900">
        Verloningsperiode definitief verwijderen?
      </p>
      <p className="mt-1 text-sm text-red-800">
        De verloningsregels en controles van deze periode worden verwijderd.
        De urenregistraties zelf blijven behouden en kunnen daarna opnieuw
        worden gebruikt om de verloning te genereren.
      </p>

      {fout && (
        <p className="mt-3 text-sm font-medium text-red-800">{fout}</p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={verwijderen}
          disabled={isPending}
          className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Verwijderen..." : "Ja, verwijderen"}
        </button>
        <button
          type="button"
          onClick={() => {
            setBevestigen(false);
            setFout(null);
          }}
          disabled={isPending}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}
