"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type LoonPeriode = {
  id: string;
  uurloon: number;
  periodeStart: string;
  periodeEinde: string;
  actief: boolean;
};

type Props = {
  medewerkerId: string;
  periodes: LoonPeriode[];
  actiefUurloon: number | null;
  alleenLezen?: boolean;
};

function datum(waarde: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(waarde));
}

export default function MedewerkerLoonperiodesPanel({
  medewerkerId, periodes, actiefUurloon, alleenLezen = false,
}: Props) {
  const router = useRouter();
  const vandaag = new Date().toISOString().slice(0, 10);
  const [bewerkenId, setBewerkenId] = useState<string | null>(null);
  const [uurloon, setUurloon] = useState("");
  const [start, setStart] = useState(vandaag);
  const [einde, setEinde] = useState("");
  const [opslaan, setOpslaan] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  function nieuw() {
    setBewerkenId(null);
    setUurloon("");
    setStart(vandaag);
    setEinde("");
    setFout(null);
  }

  function wijzig(periode: LoonPeriode) {
    setBewerkenId(periode.id);
    setUurloon(String(periode.uurloon));
    setStart(periode.periodeStart.slice(0, 10));
    setEinde(periode.periodeEinde.slice(0, 10));
    setFout(null);
  }

  async function opslaanPeriode(e: React.FormEvent) {
    e.preventDefault();
    if (opslaan) return;
    setFout(null);
    if (!uurloon.trim() || !start || !einde) {
      setFout("Vul uurloon, begindatum en einddatum in.");
      return;
    }
    if (einde < start) {
      setFout("De einddatum kan niet vóór de begindatum liggen.");
      return;
    }
    const bedrag = Number(uurloon.replace(",", "."));
    if (!Number.isFinite(bedrag) || bedrag < 0) {
      setFout("Uurloon moet een geldig bedrag zijn.");
      return;
    }
    setOpslaan(true);
    try {
      const response = await fetch(
        `/api/medewerkers/${encodeURIComponent(medewerkerId)}/loonperiodes`,
        {
          method: bewerkenId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: bewerkenId,
            uurloon: bedrag,
            periodeStart: start,
            periodeEinde: einde,
          }),
        },
      );
      const resultaat = await response.json();
      if (!response.ok) throw new Error(resultaat.error ?? "Opslaan mislukt.");
      nieuw();
      router.refresh();
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Opslaan mislukt.");
    } finally {
      setOpslaan(false);
    }
  }

  return (
    <div className="space-y-6">
      {!alleenLezen && (
        <Card title="Nieuw uurloon" description="Leg een uurloon vast voor een specifieke periode. Periodes mogen niet overlappen.">
          <form onSubmit={opslaanPeriode} className="space-y-5">
            {fout && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fout}</div>}
            <div className="grid gap-5 md:grid-cols-3">
              <Input label="Uurloon" type="number" min="0" step="0.01" value={uurloon} onChange={(e) => setUurloon(e.target.value)} placeholder="bijv. 14,50" />
              <Input label="Geldig vanaf" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              <Input label="Geldig t/m" type="date" value={einde} onChange={(e) => setEinde(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={opslaan}>{opslaan ? "Opslaan..." : bewerkenId ? "Uurloon wijzigen" : "Uurloon toevoegen"}</Button>
              {bewerkenId && <Button type="button" variant="secondary" onClick={nieuw}>Annuleren</Button>}
            </div>
          </form>
        </Card>
      )}

      <Card title="Uurloonhistorie" description="Het planbord gebruikt automatisch het uurloon dat actief is op de datum van de dienst.">
        {actiefUurloon != null && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Actief uurloon vandaag</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">€ {actiefUurloon.toFixed(2).replace(".", ",")} per uur</p>
          </div>
        )}
        {periodes.length === 0 ? (
          <p className="text-sm text-slate-500">Nog geen periodegebonden lonen vastgelegd.</p>
        ) : (
          <div className="space-y-3">
            {periodes.map((periode) => (
              <div key={periode.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">€ {periode.uurloon.toFixed(2).replace(".", ",")} per uur</p>
                  <p className="mt-1 text-sm text-slate-600">{datum(periode.periodeStart)} t/m {datum(periode.periodeEinde)}</p>
                  <p className={`mt-1 text-xs font-medium ${periode.actief ? "text-emerald-700" : "text-slate-500"}`}>{periode.actief ? "Actief" : "Inactief"}</p>
                </div>
                {!alleenLezen && <Button variant="secondary" onClick={() => wijzig(periode)}>Wijzigen</Button>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
