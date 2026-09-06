"use client";

import { useState } from "react";

import DienstBewerkForm from "@/components/planning/DienstBewerkForm";

import type { Dienst } from "@/types/planning";

type DienstBewerkToggleProps = {
  dienst: Dienst;
  vestigingId: string;
};

export default function DienstBewerkToggle({
  dienst,
  vestigingId,
}: DienstBewerkToggleProps) {
  const [bewerken, setBewerken] =
    useState(false);

  if (!bewerken) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            setBewerken(true)
          }
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          Dienst wijzigen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Dienst wijzigen
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Pas de gegevens van deze dienst aan.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setBewerken(false)
          }
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Annuleren
        </button>
      </div>

      <DienstBewerkForm
        dienst={dienst}
        vestigingId={vestigingId}
        onGewijzigd={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
