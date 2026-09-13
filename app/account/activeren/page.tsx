"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AccountActiverenPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [persoon, setPersoon] = useState<{ voornaam: string; achternaam: string; email: string } | null>(null);
  const [aanhef, setAanhef] = useState("GEEN_OPGAVE");
  const [roepnaam, setRoepnaam] = useState("");
  const [geboortedatum, setGeboortedatum] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaling, setHerhaling] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/account/activeren/info?token=${encodeURIComponent(token)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setPersoon(d); })
      .catch((e) => setError(e instanceof Error ? e.message : "De activatielink is ongeldig."));
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const r = await fetch("/api/account/activeren", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, aanhef, roepnaam, geboortedatum, telefoon, wachtwoord, wachtwoordHerhaling: herhaling }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Activeren is mislukt.");
      router.push("/login?activatie=geslaagd");
    } catch (e) { setError(e instanceof Error ? e.message : "Activeren is mislukt."); } finally { setSaving(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10"><div className="w-full max-w-2xl"><div className="mb-8 flex justify-center"><Image src="/logo.png" alt="Clevers" width={300} height={128} priority className="h-auto max-h-32 w-auto max-w-[300px] object-contain" /></div><div className="rounded-3xl border border-slate-200 bg-white shadow-xl"><form onSubmit={submit} className="space-y-8 p-6 sm:p-10"><div><h1 className="text-2xl font-bold text-slate-900">Account activeren</h1><p className="mt-2 text-sm text-slate-500">Vul je algemene gegevens in en kies een sterk wachtwoord. Je toegang tot Clevers ERP wordt actief nadat de eigenaar je rol heeft toegewezen.</p></div>{error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{persoon && <div className="rounded-xl bg-slate-50 p-4 text-sm"><strong>{persoon.voornaam} {persoon.achternaam}</strong><div className="text-slate-500">{persoon.email}</div></div>}<div className="grid gap-6 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium text-slate-700">Aanhef</label><select value={aanhef} onChange={(e) => setAanhef(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3"><option value="DHR">Dhr.</option><option value="MEVR">Mevr.</option><option value="ANDERS">Anders</option><option value="GEEN_OPGAVE">Geen opgave</option></select></div><label className="text-sm font-medium text-slate-700">Roepnaam<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" value={roepnaam} onChange={(e) => setRoepnaam(e.target.value)} /></label><label className="text-sm font-medium text-slate-700">Geboortedatum<input required type="date" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" value={geboortedatum} onChange={(e) => setGeboortedatum(e.target.value)} /></label><label className="text-sm font-medium text-slate-700">Telefoonnummer<input required type="tel" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} /></label><label className="text-sm font-medium text-slate-700">Sterk wachtwoord<input required type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} /><span className="mt-1 block text-xs text-slate-500">Minimaal 12 tekens, met hoofdletter, kleine letter, cijfer en speciaal teken.</span></label><label className="text-sm font-medium text-slate-700">Wachtwoord herhalen<input required type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" value={herhaling} onChange={(e) => setHerhaling(e.target.value)} /></label></div><div className="flex justify-end border-t border-slate-200 pt-6"><button disabled={saving || !persoon} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Account activeren..." : "Account activeren"}</button></div></form></div></div></main>;
}
