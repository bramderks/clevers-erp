"use client";

import { useState, useTransition } from "react";

type Props = {
  verstuurAction: () => Promise<void>;
};

export default function VerstuurVerloningButton({
  verstuurAction,
}: Props) {
  const [bevestigen, setBevestigen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function versturen() {
    setFout(null);
    startTransition(async () => {
      try {
        await verstuurAction();
      } catch (error) {
        setFout(
          error instanceof Error
            ? error.message
            : "De verloning kon niet ter controle worden verstuurd.",
        );
      }
    });
  }

  if (!bevestigen) {
    return (
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setBevestigen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Verstuur verloning ter controle
        </button>
        {fout && (
          <p className="mt-3 text-sm font-medium text-red-700">{fout}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p className="font-medium text-blue-950">
        Verloning ter controle versturen?
      </p>
      <p className="mt-1 text-sm text-blue-800">
        De medewerkers krijgen daarna hun verloning te zien en kunnen akkoord geven.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={versturen}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Versturen..." : "Ja, versturen"}
        </button>
        <button
          type="button"
          onClick={() => {
            setBevestigen(false);
            setFout(null);
          }}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Annuleren
        </button>
      </div>

      {fout && <p className="mt-3 text-sm font-medium text-red-700">{fout}</p>}
    </div>
  );
}
