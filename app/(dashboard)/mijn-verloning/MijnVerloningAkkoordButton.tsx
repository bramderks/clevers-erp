"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MijnVerloningAkkoordButtonProps = {
  periodeId: string;
};

export default function MijnVerloningAkkoordButton({
  periodeId,
}: MijnVerloningAkkoordButtonProps) {
  const router = useRouter();

  const [laden, setLaden] =
    useState(false);

  const [fout, setFout] =
    useState<string | null>(null);

  async function akkoordGeven() {
    setLaden(true);
    setFout(null);

    try {
      const response = await fetch(
        `/api/verloning/${periodeId}/controleren`,
        {
          method: "POST",
        },
      );

      const resultaat =
        await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat.fout ??
            "De verloning kon niet worden gecontroleerd.",
        );
      }

      router.refresh();
    } catch (error) {
      setFout(
        error instanceof Error
          ? error.message
          : "Er is een onverwachte fout opgetreden.",
      );
    } finally {
      setLaden(false);
    }
  }

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
      <h2 className="font-semibold text-blue-950">
        Verloning controleren
      </h2>

      <p className="mt-1 text-sm text-blue-800">
        Controleer je gewerkte dagen en uren. Als alles
        klopt, kun je akkoord geven.
      </p>

      {fout && (
        <p className="mt-3 text-sm font-medium text-red-700">
          {fout}
        </p>
      )}

      <button
        type="button"
        onClick={akkoordGeven}
        disabled={laden}
        className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {laden
          ? "Akkoord opslaan..."
          : "Mijn verloning klopt"}
      </button>
    </section>
  );
}
