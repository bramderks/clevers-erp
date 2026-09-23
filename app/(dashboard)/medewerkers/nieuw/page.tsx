"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, X, AlertCircle } from "lucide-react";
import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type MedewerkerImport = {
  rij: number;
  voornaam: string;
  achternaam: string;
  email: string;
  status: "TOEVOEGEN" | "DUBBEL";
  melding: string;
};

type ImportResultaat = {
  medewerkers: MedewerkerImport[];
  fouten: { rij: number; melding: string }[];
};

type ActivatieHistorie = {
  id: string;
  voornaam: string;
  achternaam: string;
  email: string;
  verstuurdOp: string;
  verlooptOp: string;
  gebruiktOp: string | null;
};

export default function NieuweMedewerkerPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [modus, setModus] = useState<"handmatig" | "import">("handmatig");
  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [email, setEmail] = useState("");
  const [bestand, setBestand] = useState<File | null>(null);
  const [controle, setControle] = useState<ImportResultaat | null>(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");
  const [error, setError] = useState("");
  const [verzendResultaat, setVerzendResultaat] = useState<Array<{ voornaam: string; achternaam: string; email: string; ok: boolean; melding?: string }>>([]);
  const [activatieHistorie, setActivatieHistorie] = useState<ActivatieHistorie[]>([]);
  const [historieBezig, setHistorieBezig] = useState(true);

  useEffect(() => {
    let actief = true;
    fetch("/api/medewerkers/nieuw/importeren/historie")
      .then((response) => response.json())
      .then((data) => {
        if (actief && Array.isArray(data.activaties)) setActivatieHistorie(data.activaties);
      })
      .catch(() => {})
      .finally(() => {
        if (actief) setHistorieBezig(false);
      });
    return () => {
      actief = false;
    };
  }, []);

  function verversActivatieHistorie() {
    fetch("/api/medewerkers/nieuw/importeren/historie")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.activaties)) setActivatieHistorie(data.activaties);
      })
      .catch(() => {});
  }

  async function verstuurUitnodiging(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setMelding(""); setBezig(true);
    try {
      const response = await fetch("/api/medewerkers/uitnodigen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voornaam, achternaam, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "De uitnodiging kon niet worden verstuurd.");
      setMelding("De activatie-uitnodiging is verstuurd.");
      setTimeout(() => router.push("/medewerkers"), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "De uitnodiging kon niet worden verstuurd.");
    } finally { setBezig(false); }
  }

  function kiesBestand(event: ChangeEvent<HTMLInputElement>) {
    setBestand(event.target.files?.[0] ?? null);
    setControle(null); setVerzendResultaat([]); setError(""); setMelding("");
  }

  async function controleerImport() {
    if (!bestand) return;
    setBezig(true); setError(""); setControle(null);
    try {
      const formData = new FormData();
      formData.append("bestand", bestand);
      const response = await fetch("/api/medewerkers/nieuw/importeren", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok && !data.medewerkers) throw new Error(data.error || "Het bestand kon niet worden gecontroleerd.");
      setControle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Het bestand kon niet worden gecontroleerd.");
    } finally { setBezig(false); }
  }

  async function verstuurActivaties() {
    if (!controle) return;
    const toeTeVoegen = controle.medewerkers.filter((m) => m.status === "TOEVOEGEN");
    if (!toeTeVoegen.length) return;
    setBezig(true); setError(""); setMelding(""); setVerzendResultaat([]);
    try {
      const response = await fetch("/api/medewerkers/nieuw/importeren/activeren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medewerkers: toeTeVoegen.map(({ voornaam, achternaam, email }) => ({ voornaam, achternaam, email })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "De activaties konden niet worden verstuurd.");
      const resultaten = Array.isArray(data.resultaten) ? data.resultaten : [];
      setVerzendResultaat(resultaten);
      verversActivatieHistorie();
      const verstuurd = resultaten.filter((r: { ok: boolean }) => r.ok).length;
      const mislukt = resultaten.length - verstuurd;
      setMelding(mislukt > 0 ? `${verstuurd} activatie-uitnodiging(en) verstuurd, ${mislukt} niet verstuurd.` : `${verstuurd} activatie-uitnodiging(en) zijn verstuurd.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "De activaties konden niet worden verstuurd.");
    } finally { setBezig(false); }
  }

  const toevoegen = controle?.medewerkers.filter((m) => m.status === "TOEVOEGEN") ?? [];
  const dubbelen = controle?.medewerkers.filter((m) => m.status === "DUBBEL") ?? [];

  return (
    <PageLayout>
      <PageToolbar title="Nieuwe medewerker" />
      <Card>
        <div className="max-w-4xl space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Medewerkers toevoegen</h2>
            <p className="mt-1 text-sm text-slate-500">Voeg één medewerker handmatig toe of voeg meerdere medewerkers tegelijk toe met Excel.</p>
          </div>

          <div className="flex rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => setModus("handmatig")} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${modus === "handmatig" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>Handmatig toevoegen</button>
            <button type="button" onClick={() => setModus("import")} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${modus === "import" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>Meerdere via Excel</button>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {melding && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{melding}</div>}

          {modus === "handmatig" ? (
            <form onSubmit={verstuurUitnodiging} className="space-y-8">
              <p className="text-sm text-slate-500">Vul voornaam, achternaam en e-mailadres in. De medewerker ontvangt daarna de activatielink.</p>
              <div className="grid gap-6 md:grid-cols-2">
                <Input label="Voornaam" value={voornaam} onChange={(e) => setVoornaam(e.target.value)} required disabled={bezig} />
                <Input label="Achternaam" value={achternaam} onChange={(e) => setAchternaam(e.target.value)} required disabled={bezig} />
                <div className="md:col-span-2"><Input label="E-mailadres" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={bezig} /></div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
                <Button type="button" variant="secondary" onClick={() => router.push("/medewerkers")} disabled={bezig}>Annuleren</Button>
                <Button type="submit" disabled={bezig}>{bezig ? "Uitnodiging versturen..." : "Verstuur activatiecode"}</Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Excel-indeling</p>
                <p className="mt-1 text-sm text-slate-500">Gebruik drie kolommen: <strong>voornaam</strong>, <strong>achternaam</strong> en <strong>email</strong>. Eén medewerker per regel.</p>
              </div>

              {activatieHistorie.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">Eerder verzonden activaties</p>
                      <p className="mt-1 text-sm text-slate-500">Hier zie je welke medewerkers eerder vanuit deze organisatie een activatie-uitnodiging hebben ontvangen.</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{activatieHistorie.length} recente uitnodigingen</span>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
                    <div className="grid min-w-[680px] grid-cols-[1.1fr_1.5fr_1fr_120px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                      <span>Medewerker</span><span>E-mail</span><span>Verzonden</span><span>Status</span>
                    </div>
                    {activatieHistorie.map((activatie) => (
                      <div key={activatie.id} className="grid min-w-[680px] grid-cols-[1.1fr_1.5fr_1fr_120px] gap-3 border-t border-slate-100 px-4 py-3 text-sm">
                        <span className="font-medium text-slate-800">{activatie.voornaam} {activatie.achternaam}</span>
                        <span className="truncate text-slate-600">{activatie.email}</span>
                        <span className="text-slate-500">{new Date(activatie.verstuurdOp).toLocaleString("nl-NL")}</span>
                        <span className={activatie.gebruiktOp ? "font-medium text-emerald-700" : new Date(activatie.verlooptOp) < new Date() ? "font-medium text-red-600" : "font-medium text-amber-700"}>
                          {activatie.gebruiktOp ? "Geactiveerd" : new Date(activatie.verlooptOp) < new Date() ? "Verlopen" : "Verstuurd"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {historieBezig && (
                <p className="text-xs text-slate-400">Activatiehistorie laden...</p>
              )}

              {!bestand ? (
                <label htmlFor="nieuw-medewerkers-bestand" className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center hover:border-slate-400 hover:bg-slate-100">
                  <FileSpreadsheet size={30} className="text-slate-500" />
                  <span className="mt-4 text-sm font-semibold text-slate-800">Kies Excel-bestand</span>
                  <span className="mt-1 text-xs text-slate-500">.xlsx</span>
                  <input ref={inputRef} id="nieuw-medewerkers-bestand" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={kiesBestand} className="sr-only" />
                </label>
              ) : (
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileSpreadsheet size={22} className="shrink-0 text-slate-500" />
                    <span className="truncate text-sm font-semibold text-slate-900">{bestand.name}</span>
                  </div>
                  <button type="button" onClick={() => { setBestand(null); setControle(null); if (inputRef.current) inputRef.current.value = ""; }} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"><X size={18} /></button>
                </div>
              )}

              {bestand && !controle && (
                <div className="flex justify-end">
                  <Button type="button" onClick={controleerImport} disabled={bezig}>
                    {bezig ? <><Loader2 size={18} className="animate-spin" /> Bestand controleren...</> : <><Upload size={18} /> Bestand controleren</>}
                  </Button>
                </div>
              )}

              {controle && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                    <CheckCircle2 className="text-emerald-600" size={24} />
                    <div>
                      <p className="font-semibold text-slate-900">Controle afgerond</p>
                      <p className="text-sm text-slate-500">{toevoegen.length} worden toegevoegd en {dubbelen.length} zijn als dubbel aangemerkt.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-[60px_1fr_1fr_1.4fr_120px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                      <span>Rij</span><span>Voornaam</span><span>Achternaam</span><span>E-mail</span><span>Status</span>
                    </div>
                    {controle.medewerkers.map((m) => (
                      <div key={`${m.rij}-${m.email}`} className="grid grid-cols-[60px_1fr_1fr_1.4fr_120px] gap-3 border-t border-slate-100 px-4 py-3 text-sm">
                        <span>{m.rij}</span><span>{m.voornaam}</span><span>{m.achternaam}</span><span className="truncate">{m.email}</span>
                        <span className={m.status === "TOEVOEGEN" ? "font-medium text-emerald-700" : "font-medium text-red-600"}>{m.status === "TOEVOEGEN" ? "Toevoegen" : "Dubbel"}</span>
                      </div>
                    ))}
                  </div>

                  {dubbelen.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex gap-3">
                        <AlertCircle size={20} className="mt-0.5 text-amber-700" />
                        <div>
                          <p className="font-semibold text-amber-900">Dubbele regels worden niet toegevoegd</p>
                          <p className="mt-1 text-sm text-amber-800">{dubbelen.map((m) => `Rij ${m.rij}: ${m.voornaam} ${m.achternaam} — ${m.melding}`).join(" · ")}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {verzendResultaat.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="font-semibold text-slate-900">Resultaat activaties</p>
                      <div className="mt-3 space-y-2">
                        {verzendResultaat.map((r) => (
                          <div key={r.email} className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-medium text-slate-800">{r.voornaam} {r.achternaam} <span className="font-normal text-slate-500">({r.email})</span></span>
                            <span className={r.ok ? "font-medium text-emerald-700" : "font-medium text-red-600"}>{r.ok ? "Verstuurd" : (r.melding ?? "Niet verstuurd")}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end"><Button type="button" variant="secondary" onClick={() => router.push("/medewerkers")}>Terug naar medewerkers</Button></div>
                    </div>
                  )}

                  {controle.fouten.length > 0 && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {controle.fouten.map((f) => <div key={`${f.rij}-${f.melding}`}>Rij {f.rij}: {f.melding}</div>)}
                    </div>
                  )}

                  {verzendResultaat.length === 0 && (
                    <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
                      <Button type="button" variant="secondary" onClick={() => { setBestand(null); setControle(null); }}>Ander bestand kiezen</Button>
                      <Button type="button" onClick={verstuurActivaties} disabled={bezig || toevoegen.length === 0}>
                        {bezig ? <><Loader2 size={18} className="animate-spin" /> Activaties versturen...</> : `Verstuur activatie naar ${toevoegen.length} medewerker${toevoegen.length === 1 ? "" : "s"}`}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </PageLayout>
  );
}
