"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function NieuweMedewerkerPage() {
  const router = useRouter();
  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [melding, setMelding] = useState("");
  const [error, setError] = useState("");

  async function verstuurUitnodiging(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMelding("");
    if (!voornaam.trim() || !achternaam.trim() || !email.trim()) {
      setError("Voornaam, achternaam en e-mailadres zijn verplicht.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/medewerkers/uitnodigen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voornaam, achternaam, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "De uitnodiging kon niet worden verstuurd.");
      setMelding("De activatie-uitnodiging is verstuurd. De medewerker kan het account nu activeren.");
      setTimeout(() => router.push("/medewerkers"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "De uitnodiging kon niet worden verstuurd.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout>
      <PageToolbar title="Nieuwe medewerker" />
      <Card>
        <form onSubmit={verstuurUitnodiging} className="max-w-2xl space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Account uitnodigen</h2>
            <p className="mt-1 text-sm text-slate-500">Vul alleen de basisgegevens in. De medewerker vult de algemene gegevens en het sterke wachtwoord zelf in via de activatielink.</p>
          </div>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {melding && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{melding}</div>}
          <div className="grid gap-6 md:grid-cols-2">
            <Input label="Voornaam" value={voornaam} onChange={(e) => setVoornaam(e.target.value)} required disabled={saving} />
            <Input label="Achternaam" value={achternaam} onChange={(e) => setAchternaam(e.target.value)} required disabled={saving} />
            <div className="md:col-span-2"><Input label="E-mailadres" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={saving} /></div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
            <Button type="button" variant="secondary" onClick={() => router.push("/medewerkers")} disabled={saving}>Annuleren</Button>
            <Button type="submit" disabled={saving}>{saving ? "Uitnodiging versturen..." : "Verstuur activatiecode"}</Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
