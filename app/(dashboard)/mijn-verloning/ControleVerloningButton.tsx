"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ControleVerloningButtonProps = {
  periodeId: string;
  status: string;
};

export default function ControleVerloningButton({
  periodeId,
  status,
}: ControleVerloningButtonProps) {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function controleer() {
    if (bezig || status !== "OPEN") {
      return;
    }

    try {
      setBezig(true);
      setFout(null);

      const response = await fetch(
        "/api/verloning/" +
          periodeId +
          "/controleren",
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De verloning kon niet worden gecontroleerd.",
        );
      }

      router.refresh();
    } catch (error) {
      setFout(
        error instanceof Error
          ? error.message
          : "De verloning kon niet worden gecontroleerd.",
      );
    } finally {
      setBezig(false);
    }
  }

  if (status !== "OPEN") {
    return (
      <span className="text-sm font-medium text-emerald-700">
        Gecontroleerd
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={bezig}
        onClick={() => void controleer()}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {bezig
          ? "Controleren..."
          : "Akkoord"}
      </button>

      {fout && (
        <p className="text-xs text-red-600">
          {fout}
        </p>
      )}
    </div>
  );
}
