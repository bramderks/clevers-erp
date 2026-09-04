"use client";

import {
  useState,
  useTransition,
} from "react";

type VerwerkVerloningButtonProps = {
  verwerkAction: () => Promise<void>;
};

export default function VerwerkVerloningButton({
  verwerkAction,
}: VerwerkVerloningButtonProps) {
  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [
    fout,
    setFout,
  ] = useState<string | null>(
    null,
  );

  const [
    bevestigen,
    setBevestigen,
  ] = useState(false);

  function verwerken() {
    setFout(null);

    startTransition(async () => {
      try {
        await verwerkAction();
      } catch (error) {
        setFout(
          error instanceof Error
            ? error.message
            : "Er is een onbekende fout opgetreden bij het verwerken van de verloning.",
        );
      }
    });
  }

  return (
    <div className="mt-4">
      {!bevestigen ? (
        <button
          type="button"
          onClick={() =>
            setBevestigen(true)
          }
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Verloningsperiode verwerken
        </button>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">
            Weet je zeker dat je deze
            verloningsperiode wilt verwerken?
          </p>

          <p className="mt-1 text-sm text-amber-800">
            Na verwerking wordt deze periode
            definitief afgesloten.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={verwerken}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending
                ? "Verwerken..."
                : "Ja, verwerken"}
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
        </div>
      )}

      {fout && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            {fout}
          </p>
        </div>
      )}
    </div>
  );
}