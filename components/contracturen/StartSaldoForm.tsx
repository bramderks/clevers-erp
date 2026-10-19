"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  medewerkerId: string;
  medewerkerNaam: string;
  startSaldo: number | null;
  peildatum: string | null;
  notitie: string | null;
};

export default function StartSaldoForm({ medewerkerId, medewerkerNaam, startSaldo, peildatum, notitie }: Props) {
  const router = useRouter();
  const [uren, setUren] = useState(startSaldo === null ? "" : String(startSaldo));
  const [datum, setDatum] = useState(peildatum ?? "2026-09-01");
  const [opmerking, setOpmerking] = useState(notitie ?? "");
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");
  const [fout, setFout] = useState(false);

  async function opslaan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBezig(true);
    setMelding("");
    setFout(false);
    try {
      const response = await fetch("/api/contracturen/startsaldo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medewerkerId, uren, peildatum: datum, notitie: opmerking }),
      });
      const resultaat = await response.json();
      if (!response.ok) throw new Error(resultaat.error ?? "Opslaan is mislukt.");
      setMelding("Startsaldo opgeslagen");
      router.refresh();
    } catch (error) {
      setFout(true);
      setMelding(error instanceof Error ? error.message : "Opslaan is mislukt.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <form onSubmit={opslaan} className="mt-3 min-w-[250px] space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-700">Startsaldo nog te werken</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-600">
          Uren
          <input aria-label={`Startsaldo uren voor ${medewerkerNaam}`} type="number" min="0" max="10000" step="0.01" required value={uren} onChange={(event) => setUren(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
        </label>
        <label className="text-xs text-slate-600">
          Peildatum
          <input aria-label={`Peildatum startsaldo voor ${medewerkerNaam}`} type="date" required value={datum} onChange={(event) => setDatum(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
        </label>
      </div>
      <label className="block text-xs text-slate-600">
        Notitie (optioneel)
        <input value={opmerking} onChange={(event) => setOpmerking(event.target.value)} maxLength={500} placeholder="Bijv. saldo bij start ERP" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
      </label>
      <button disabled={bezig} type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{bezig ? "Opslaan…" : "Saldo opslaan"}</button>
      {melding && <p role="status" className={`text-xs ${fout ? "text-red-700" : "text-emerald-700"}`}>{melding}</p>}
    </form>
  );
}
