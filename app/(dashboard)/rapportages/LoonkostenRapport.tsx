"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Lock, Users, X } from "lucide-react";

type Vestiging = { id: string; naam: string };
type Dag = { datum: string; uren: number; kosten: number; ontbrekendUurloon: number };
type Medewerker = { medewerkerId: string; naam: string; uren: number; kosten: number; uurloon: number | null };

const euro = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

const compactEuro = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const percentage = (n: number | null) =>
  n == null ? "—" : `${n.toFixed(1).replace(".", ",")}%`;

const datum = (s: string) =>
  new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(s + "T12:00:00"));

function verschil(a: number, b: number) {
  return a - b;
}

export default function LoonkostenRapport(p: {
  vestigingen: Vestiging[];
  vestigingId: string;
  jaar: number;
  weeknummer: number;
  weekBestaat: boolean;
  weekStatus: string | null;
  afgeslotenOp: string | null;
  omzet: number;
  doelPercentage: number;
  percentageOmzet: number | null;
  totaalUren: number;
  totaalKosten: number;
  gemiddeldUurloon: number;
  ontbrekendUurloon: number;
  dagen: Dag[];
  medewerkers: Medewerker[];
  vorigeSeizoen: {
    omzet: number;
    doelPercentage: number;
    totaalUren: number;
    totaalKosten: number;
    gemiddeldUurloon: number;
    percentageOmzet: number | null;
    afgeslotenOp: string | null;
  } | null;
}) {
  const [omzet, setOmzet] = useState(
    p.omzet ? String(p.omzet).replace(".", ",") : "",
  );
  const [doel, setDoel] = useState(
    String(p.doelPercentage).replace(".", ","),
  );
  const [busy, setBusy] = useState(false);
  const [melding, setMelding] = useState("");
  const gesloten = Boolean(p.afgeslotenOp);
  const bovenNorm = p.percentageOmzet != null && p.percentageOmzet > p.doelPercentage;
  const meter = Math.min(100, Math.max(0, p.percentageOmzet ?? 0));
  const maxDagKosten = Math.max(...p.dagen.map((d) => d.kosten), 1);
  const zichtbareMedewerkers = p.medewerkers.slice(0, 5);

  const parseNummer = (waarde: string) =>
    Number(waarde.replace(/\s/g, "").replace(",", ".")) || 0;

  const navigeren = (richting: -1 | 1) => {
    const date = new Date(p.jaar, 0, 4);
    date.setDate(date.getDate() + (p.weeknummer - 1) * 7 + richting * 7);
    const dag = date.getDay() || 7;
    date.setDate(date.getDate() + 4 - dag);
    const nieuwJaar = date.getFullYear();
    const eerste = new Date(nieuwJaar, 0, 4);
    const eersteDag = eerste.getDay() || 7;
    const nieuwWeek = Math.ceil((((date.getTime() - eerste.getTime()) / 86400000) + eersteDag - 1) / 7);
    window.location.href =
      "/rapportages?vestiging=" +
      encodeURIComponent(p.vestigingId) +
      "&jaar=" +
      encodeURIComponent(String(nieuwJaar)) +
      "&week=" +
      encodeURIComponent(String(nieuwWeek));
  };

  const navigerenForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    window.location.href =
      "/rapportages?vestiging=" +
      encodeURIComponent(String(f.get("vestiging") || "")) +
      "&jaar=" +
      encodeURIComponent(String(f.get("jaar") || "")) +
      "&week=" +
      encodeURIComponent(String(f.get("week") || ""));
  };

  const opslaan = async () => {
    if (gesloten) return;
    setBusy(true);
    setMelding("");
    try {
      const response = await fetch("/api/rapportages/loonkosten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vestigingId: p.vestigingId,
          jaar: p.jaar,
          weeknummer: p.weeknummer,
          omzet: parseNummer(omzet),
          doelPercentage: parseNummer(doel),
        }),
      });
      const resultaat = await response.json();
      if (!response.ok) throw new Error(resultaat.error || "Opslaan mislukt.");
      window.location.reload();
    } catch (error) {
      setMelding(error instanceof Error ? error.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  };

  const afsluiten = async () => {
    if (gesloten || !p.weekBestaat) return;
    if (!window.confirm("Week afsluiten? De geplande loonkosten, omzet en personeelsmix worden definitief opgeslagen als historische waarde.")) return;

    setBusy(true);
    setMelding("");
    try {
      const response = await fetch("/api/rapportages/loonkosten/afsluiten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vestigingId: p.vestigingId,
          jaar: p.jaar,
          weeknummer: p.weeknummer,
          omzet: parseNummer(omzet),
          doelPercentage: parseNummer(doel),
        }),
      });
      const resultaat = await response.json();
      if (!response.ok) throw new Error(resultaat.error || "Afsluiten mislukt.");
      window.location.reload();
    } catch (error) {
      setMelding(error instanceof Error ? error.message : "Afsluiten mislukt.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-5">
      <form onSubmit={navigerenForm} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-[1.5fr_0.7fr_0.7fr_auto]">
          <select name="vestiging" defaultValue={p.vestigingId} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400">
            {p.vestigingen.map((v) => <option key={v.id} value={v.id}>{v.naam}</option>)}
          </select>
          <input name="jaar" type="number" defaultValue={p.jaar} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold" />
          <input name="week" type="number" min="1" max="53" defaultValue={p.weeknummer} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold" />
          <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800" type="submit">Week tonen</button>
        </div>
      </form>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigeren(-1)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <ArrowLeft size={16} /> Vorige
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {p.vestigingen.find((v) => v.id === p.vestigingId)?.naam}
          </p>
          <p className="text-xl font-bold text-slate-900">Week {p.weeknummer} · {p.jaar}</p>
          {p.weekStatus && <p className="text-xs text-slate-500">{gesloten ? "Historisch afgesloten" : p.weekStatus.replace("_", " ")}</p>}
        </div>
        <button type="button" onClick={() => navigeren(1)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Volgende <ArrowRight size={16} />
        </button>
      </div>

      {!p.weekBestaat && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Deze planningweek bestaat nog niet. Maak de week eerst aan vanuit de planning.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Geplande uren", `${p.totaalUren.toFixed(1).replace(".", ",")} uur`],
          ["Loonkosten", euro(p.totaalKosten)],
          ["Gem. uurloon", euro(p.gemiddeldUurloon)],
          ["Omzet", euro(p.omzet)],
        ].map(([label, value]) => (
          <button key={label} type="button" onClick={() => setDetail(label === "Geplande uren" ? "uren" : label === "Loonkosten" ? "kosten" : label === "Gem. uurloon" ? "loon" : "omzet")} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          </button>
        ))}
      </div>


      <button type="button" onClick={() => setDetail("omzet")} className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Seizoensomzet</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Omzet tot nu toe en verwachting einde seizoen</h2>
            <p className="mt-1 text-sm text-slate-500">
              Afgesloten: <strong className="text-slate-800">{euro(p.seizoenOmzetAfgesloten)}</strong>
              {" · "}verwacht seizoen: <strong className="text-slate-800">{euro(p.seizoenOmzetVerwacht)}</strong>
              {" · "}vorig seizoen: <strong className="text-slate-800">{euro(p.vorigSeizoenOmzet)}</strong>
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-slate-500">Bekijk per week →</span>
        </div>
      </button>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Loonkosten / omzet</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{percentage(p.percentageOmzet)}</p>
            <p className="mt-1 text-sm text-slate-500">Norm {percentage(p.doelPercentage)}</p>
          </div>
          <div className="w-full max-w-xl">
            <div className="relative h-4 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${bovenNorm ? "bg-red-400" : "bg-emerald-400"}`}
                style={{ width: `${meter}%` }}
              />
              <div className="absolute inset-y-0 w-0.5 bg-slate-900" style={{ left: `${Math.min(100, p.doelPercentage)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>0%</span>
              <span className="font-semibold text-slate-600">{percentage(p.doelPercentage)} norm</span>
              <span>100%</span>
            </div>
          </div>
        </div>
        {p.percentageOmzet != null && (
          <div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${bovenNorm ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
            {bovenNorm ? <X size={17} /> : <Check size={17} />}
            {bovenNorm
              ? `De geplande loonkosten liggen ${percentage(p.percentageOmzet - p.doelPercentage)} boven de norm.`
              : `De geplande loonkosten liggen ${percentage(p.doelPercentage - p.percentageOmzet)} onder de norm.`}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Verdeling</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Loonkosten per dag</h2>
          </div>
          <div className="space-y-4">
            {p.dagen.map((dag) => (
              <div key={dag.datum}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-700">{datum(dag.datum)}</span>
                  <span className="font-semibold text-slate-900">{compactEuro(dag.kosten)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-700" style={{ width: `${(dag.kosten / maxDagKosten) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {dag.uren.toFixed(1).replace(".", ",")} uur
                  {dag.ontbrekendUurloon > 0 ? ` · ${dag.ontbrekendUurloon.toFixed(1).replace(".", ",")} uur zonder uurloon` : ""}
                </p>
              </div>
            ))}
            {p.dagen.length === 0 && <p className="text-sm text-slate-500">Nog geen geplande diensten.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Personeel</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Mix van loonkosten</h2>
            </div>
            <Users size={20} className="text-slate-400" />
          </div>
          <div className="space-y-4">
            {zichtbareMedewerkers.map((medewerker) => {
              const mix = p.totaalKosten ? (medewerker.kosten / p.totaalKosten) * 100 : 0;
              return (
                <div key={medewerker.medewerkerId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold text-slate-700">{medewerker.naam}</span>
                    <span className="shrink-0 font-semibold text-slate-900">{compactEuro(medewerker.kosten)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-500" style={{ width: `${mix}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{percentage(mix)} · {medewerker.uren.toFixed(1).replace(".", ",")} uur</p>
                </div>
              );
            })}
            {p.medewerkers.length === 0 && <p className="text-sm text-slate-500">Nog geen medewerkers ingepland.</p>}
          </div>
          {p.medewerkers.length > 5 && (
            <details className="mt-5 border-t border-slate-100 pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">Bekijk alle {p.medewerkers.length} medewerkers</summary>
              <div className="mt-4 space-y-2">
                {p.medewerkers.slice(5).map((medewerker) => (
                  <div key={medewerker.medewerkerId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-slate-600">{medewerker.naam}</span>
                    <span className="shrink-0 font-medium text-slate-900">{euro(medewerker.kosten)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {p.ontbrekendUurloon > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={19} />
          <div>
            <p className="font-semibold">Uurloon ontbreekt</p>
            <p className="mt-1">{p.ontbrekendUurloon} geplande bezetting(en) hebben geen uurloon. Deze uren zijn niet meegenomen in de loonkosten.</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Weekgegevens</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Omzet en norm</h2>
            <p className="mt-1 text-sm text-slate-500">
              {gesloten ? "Deze waarden zijn bevroren in de historische rapportage." : "Vul de verwachte weekomzet in en pas de norm aan indien nodig."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[160px_140px_auto]">
            <label className="text-sm font-medium text-slate-700">
              Omzet (€)
              <input value={omzet} onChange={(e) => setOmzet(e.target.value)} inputMode="decimal" disabled={gesloten} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-60" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Norm (%)
              <input value={doel} onChange={(e) => setDoel(e.target.value)} inputMode="decimal" disabled={gesloten} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-60" />
            </label>
            <button onClick={opslaan} disabled={busy || gesloten || !p.weekBestaat} className="self-end rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? "Bezig..." : "Opslaan"}
            </button>
          </div>
        </div>
        {melding && <p className="mt-3 text-sm font-medium text-red-700">{melding}</p>}
      </div>

      {p.vorigeSeizoen ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Historische vergelijking</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Week {p.weeknummer}: {p.jaar} tegenover {p.jaar - 1}</h2>
              <p className="mt-1 text-sm text-slate-500">Vergelijk dezelfde ISO-week van het vorige seizoen.</p>
            </div>
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:inline-flex">Vastgelegd</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Omzet", euro(p.omzet), euro(p.vorigeSeizoen.omzet), verschil(p.omzet, p.vorigeSeizoen.omzet)],
              ["Loonkosten", euro(p.totaalKosten), euro(p.vorigeSeizoen.totaalKosten), verschil(p.totaalKosten, p.vorigeSeizoen.totaalKosten)],
              ["Uren", `${p.totaalUren.toFixed(1).replace(".", ",")} uur`, `${p.vorigeSeizoen.totaalUren.toFixed(1).replace(".", ",")} uur`, verschil(p.totaalUren, p.vorigeSeizoen.totaalUren)],
              ["Loonkosten %", percentage(p.percentageOmzet), percentage(p.vorigeSeizoen.percentageOmzet), p.percentageOmzet != null && p.vorigeSeizoen.percentageOmzet != null ? p.percentageOmzet - p.vorigeSeizoen.percentageOmzet : 0],
            ].map(([label, huidig, vorig, delta]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{huidig}</p>
                    <p className="text-xs text-slate-500">{p.jaar - 1}: {vorig}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {label === "Loonkosten %" ? `${Number(delta).toFixed(1).replace(".", ",")} pp` : `${Number(delta) >= 0 ? "+" : ""}${Number(delta).toFixed(1).replace(".", ",")}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-700">Vergelijking vorig seizoen</p>
          <p className="mt-1 text-sm text-slate-500">Voor week {p.weeknummer} van {p.jaar - 1} is nog geen afgesloten loonkostenrapport beschikbaar.</p>
        </div>
      )}

      {gesloten ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-700">
          <Lock size={19} className="shrink-0" />
          <div>
            <p className="font-semibold">Week afgesloten</p>
            <p className="mt-0.5">De loonkostenrapportage is definitief vastgelegd op {new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(p.afgeslotenOp!))}.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">Week definitief afsluiten</p>
            <p className="mt-1 text-sm text-slate-500">Hiermee worden de geplande uren, loonkosten, omzet, norm en personeelsmix als historische waarden opgeslagen.</p>
          </div>
          <button onClick={afsluiten} disabled={busy || !p.weekBestaat} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            <Lock size={17} /> Week afsluiten
          </button>
        </div>
      )}

      {detail === "uren" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-6" onMouseDown={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">Geplande uren · wie wanneer</h2><button onClick={() => setDetail(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20}/></button></div>
            <div className="max-h-[calc(90vh-73px)] overflow-y-auto p-5 space-y-3">
              {p.diensten.map((dienst, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex justify-between gap-3"><div><p className="font-semibold text-slate-900">{datum(dienst.datum.slice(0,10))}</p><p className="text-sm text-slate-500">{new Date(dienst.begintijd).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})} – {new Date(dienst.eindtijd).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})}</p></div><span className="text-sm text-slate-500">{dienst.medewerkers.length} medewerker{dienst.medewerkers.length === 1 ? "" : "s"}</span></div>
                  <div className="mt-3 space-y-2">{dienst.medewerkers.map(m => <div key={m.medewerkerId} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{m.naam}</span><span className="text-slate-500">{((new Date(dienst.eindtijd).getTime()-new Date(dienst.begintijd).getTime())/3600000).toFixed(1).replace(".",",")} uur</span></div>)}</div>
                </div>
              ))}
              {!p.diensten.length && <p className="text-sm text-slate-500">Geen diensten opgeslagen voor deze week.</p>}
            </div>
          </div>
        </div>
      )}

      {detail === "kosten" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-6" onMouseDown={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">Loonkosten · waar zit de week</h2><button onClick={() => setDetail(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20}/></button></div>
            <div className="max-h-[calc(90vh-73px)] overflow-y-auto p-5 space-y-3">
              {p.dagen.map(d => <div key={d.datum} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between"><span className="font-semibold">{datum(d.datum)}</span><span className="font-bold">{euro(d.kosten)}</span></div><div className="mt-2 h-3 rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-700" style={{width:`${(d.kosten/maxDagKosten)*100}%`}}/></div><p className="mt-2 text-xs text-slate-500">{d.uren.toFixed(1).replace(".",",")} uur gepland</p></div>)}
            </div>
          </div>
        </div>
      )}

      {detail === "loon" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-6" onMouseDown={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">Gemiddeld uurloon · opbouw per dag</h2><button onClick={() => setDetail(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20}/></button></div>
            <div className="max-h-[calc(90vh-73px)] overflow-y-auto p-5 space-y-3">
              {p.dagen.map(d => <div key={d.datum} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"><div><p className="font-semibold">{datum(d.datum)}</p><p className="text-xs text-slate-500">{d.uren.toFixed(1).replace(".",",")} uur · {euro(d.kosten)} loonkosten</p></div><span className="text-lg font-bold">{euro(d.gemiddeldUurloon ?? (d.uren-d.ontbrekendUurloon > 0 ? d.kosten/(d.uren-d.ontbrekendUurloon) : 0))}</span></div>)}
            </div>
          </div>
        </div>
      )}

      {detail === "omzet" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-6" onMouseDown={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-bold text-slate-900">Omzet · seizoen per week</h2><p className="text-xs text-slate-500">Afgesloten weken zijn gerealiseerd; overige opgeslagen bedragen zijn verwachtingen.</p></div><button onClick={() => setDetail(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20}/></button></div>
            <div className="max-h-[calc(90vh-73px)] overflow-y-auto p-5">
              <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Afgesloten tot nu toe</p><p className="mt-1 text-xl font-bold">{euro(p.seizoenOmzetAfgesloten)}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Verwacht einde seizoen</p><p className="mt-1 text-xl font-bold">{euro(p.seizoenOmzetVerwacht)}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Vorig seizoen</p><p className="mt-1 text-xl font-bold">{euro(p.vorigSeizoenOmzet)}</p></div></div>
              <div className="grid grid-cols-[56px_1fr_1fr] gap-3 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><span>Week</span><span>Dit seizoen</span><span className="text-right">Vorig seizoen</span></div>
              <div className="space-y-1">{p.seizoenWeken.map(w => { const vorig=vorigeMap.get(`${w.jaar}-${w.weeknummer}`); return <div key={`${w.jaar}-${w.weeknummer}`} className="grid grid-cols-[56px_1fr_1fr] items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-slate-50"><span className="font-semibold">W{w.weeknummer}</span><span>{w.omzet == null ? "—" : euro(w.omzet)} <small className="text-slate-400">{w.afgesloten ? "· afgesloten" : w.omzet != null ? "· verwachting" : ""}</small></span><span className="text-right text-slate-500">{vorig?.omzet == null ? "—" : euro(vorig.omzet)}</span></div>})}</div>
              {prognoseOntbreekt > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Voor {prognoseOntbreekt} toekomstige week{prognoseOntbreekt === 1 ? "" : "en"} is nog geen omzetverwachting opgeslagen. Die weken zijn niet meegenomen in de prognose.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
