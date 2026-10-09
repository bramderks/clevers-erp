"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

type Aanvraag = {
  id: string;
  startDatum: string;
  eindDatum: string;
  type: string;
  vestigingNaam: string;
  status: string;
  opmerking: string | null;
  redenAfwijzing: string | null;
};

function fmt(d: string) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(d));
}

export default function DagVerlofPanel({ medewerkerId, isEigenaar, magIndienen }: { medewerkerId: string; isEigenaar: boolean; magIndienen: boolean }) {
  const [items, setItems] = useState<Aanvraag[]>([]);
  const [vestigingen, setVestigingen] = useState<Array<{ id: string; naam: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [opslaan, setOpslaan] = useState(false);
  const [verlofDatum, setVerlofDatum] = useState("");
  const [vestigingId, setVestigingId] = useState("");
  const [opmerking, setOpmerking] = useState("");

  const laad = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/medewerkers/${encodeURIComponent(medewerkerId)}/vakantie`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) {
        setFout(d.fout ?? "Dagverlof kon niet worden geladen.");
        setLoading(false);
        return;
      }
      setItems((d.aanvragen ?? []).filter((a: Aanvraag) => a.type === "OVERIG"));
      setVestigingen(d.vestigingen ?? []);
    } catch {
      setFout("Dagverlof kon niet worden geladen.");
    }
    setLoading(false);
  }, [medewerkerId]);

  useEffect(() => { void laad(); }, [laad]);

  async function indienen(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setOpslaan(true);
    try {
      const r = await fetch(`/api/medewerkers/${encodeURIComponent(medewerkerId)}/vakantie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDatum: verlofDatum, eindDatum: verlofDatum, vestigingId, opmerking, type: "OVERIG" }),
      });
      const d = await r.json();
      if (!r.ok) {
        setFout(d.fout ?? "Dagverlof kon niet worden aangevraagd.");
        setOpslaan(false);
        return;
      }
      setVerlofDatum("");
      setVestigingId("");
      setOpmerking("");
      await laad();
    } catch {
      setFout("Dagverlof kon niet worden aangevraagd.");
    }
    setOpslaan(false);
  }

  async function beoordeel(id: string, status: "GOEDGEKEURD" | "AFGEWEZEN") {
    const reden = status === "AFGEWEZEN" ? (window.prompt("Reden van afwijzing:") ?? "") : undefined;
    if (status === "AFGEWEZEN" && !reden.trim()) return;
    setFout(null);
    const r = await fetch(`/api/medewerkers/${encodeURIComponent(medewerkerId)}/vakantie/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, redenAfwijzing: reden }),
    });
    const d = await r.json();
    if (!r.ok) {
      setFout(d.fout ?? "Aanvraag kon niet worden beoordeeld.");
      return;
    }
    await laad();
  }

  const statusVariant = (s: string) => s === "GOEDGEKEURD" ? "success" : s === "AFGEWEZEN" ? "danger" : s === "GEANNULEERD" ? "default" : "warning";

  return <div className="space-y-6">
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <p className="font-semibold">Een enkele dag verlof</p>
      <p className="mt-1">Vraag hier verlof aan voor één datum. De aanvraag wordt pas definitief na goedkeuring door de eigenaar. Na goedkeuring wordt die dag automatisch als niet beschikbaar vastgelegd.</p>
    </div>
    {magIndienen && <form onSubmit={indienen} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">Vestiging
        <select required value={vestigingId} onChange={e => setVestigingId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
          <option value="">Kies een vestiging</option>{vestigingen.map(v => <option key={v.id} value={v.id}>{v.naam}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">Dag verlof
        <input required type="date" value={verlofDatum} onChange={e => setVerlofDatum(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
      </label>
      <label className="text-sm font-medium text-slate-700 md:col-span-2">Toelichting (optioneel)
        <textarea value={opmerking} onChange={e => setOpmerking(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
      </label>
      {fout && <p className="text-sm text-red-700 md:col-span-2">{fout}</p>}
      <div className="md:col-span-2"><Button type="submit" disabled={opslaan}>{opslaan ? "Aanvragen..." : "Dag verlof aanvragen"}</Button></div>
    </form>}
    {fout && !magIndienen && <p className="text-sm text-red-700">{fout}</p>}
    <div className="space-y-3">
      {loading ? <p className="text-sm text-slate-500">Laden...</p> : items.length === 0 ? <p className="text-sm text-slate-500">Nog geen dagverlof aangevraagd.</p> : items.map(i => <div key={i.id} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-semibold text-slate-900">{fmt(i.startDatum)}</p><p className="mt-1 text-sm text-slate-500">{i.vestigingNaam}</p>{i.opmerking && <p className="mt-2 text-sm text-slate-600">{i.opmerking}</p>}{i.redenAfwijzing && <p className="mt-2 text-sm text-red-700">{i.redenAfwijzing}</p>}</div>
          <div className="flex items-center gap-2"><Badge variant={statusVariant(i.status) as never}>{i.status}</Badge>{isEigenaar && i.status === "AANGEVRAAGD" && <><Button onClick={() => void beoordeel(i.id, "GOEDGEKEURD")}>Goedkeuren</Button><Button variant="secondary" onClick={() => void beoordeel(i.id, "AFGEWEZEN")}>Afwijzen</Button></>}</div>
        </div>
      </div>)}
    </div>
  </div>;
}
