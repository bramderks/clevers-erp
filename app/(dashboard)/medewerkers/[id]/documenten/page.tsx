"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";

type Document = { id: string; naam: string; categorie: string; verloopDatum: string | null; opmerkingen: string | null };

export default function MedewerkerDocumentenPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [documenten, setDocumenten] = useState<Document[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [categorie, setCategorie] = useState("Certificaat");
  const [verloopDatum, setVerloopDatum] = useState("");
  const [opmerkingen, setOpmerkingen] = useState("");
  const [bericht, setBericht] = useState("");
  const [bezig, setBezig] = useState(false);

  useEffect(() => { void params.then((waarde) => setId(waarde.id)); }, [params]);
  const laden = useCallback(async () => {
    if (!id) return;
    const response = await fetch(`/api/medewerkers/${id}/documenten`, { cache: "no-store" });
    const data = await response.json();
    setDocumenten(Array.isArray(data) ? data : []);
  }, [id]);
  useEffect(() => { void laden(); }, [laden]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !id) return;
    setBezig(true); setBericht("");
    const data = new FormData();
    data.set("file", file); data.set("categorie", categorie); data.set("verloopDatum", verloopDatum); data.set("opmerkingen", opmerkingen);
    const response = await fetch(`/api/medewerkers/${id}/documenten/upload`, { method: "POST", body: data });
    const result = await response.json();
    setBericht(response.ok ? "Document succesvol geüpload." : result.fout ?? "Upload mislukt.");
    if (response.ok) { setFile(null); setVerloopDatum(""); setOpmerkingen(""); await laden(); }
    setBezig(false);
  }

  async function verwijderen(documentId: string) {
    if (!id || !confirm("Document verwijderen?")) return;
    const response = await fetch(`/api/medewerkers/${id}/documenten/${documentId}`, { method: "DELETE" });
    const result = await response.json();
    setBericht(response.ok ? "Document verwijderd." : result.fout ?? "Verwijderen mislukt.");
    if (response.ok) await laden();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <header><p className="text-sm text-slate-500">Eigenaar · Medewerkerbeheer</p><h1 className="text-2xl font-bold text-slate-900">Documenten</h1><p className="mt-1 text-sm text-slate-600">PDF, JPG, PNG of WEBP tot maximaal 4 MB. Documenten blijven privé.</p></header>
      <form onSubmit={upload} className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)} required className="block w-full text-sm" />
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full rounded-xl border p-3"><option>Certificaat</option><option>Contract</option><option>Identificatie</option><option>Opleiding</option><option>Overig</option></select>
        <input type="date" value={verloopDatum} onChange={(e) => setVerloopDatum(e.target.value)} className="w-full rounded-xl border p-3" />
        <textarea value={opmerkingen} onChange={(e) => setOpmerkingen(e.target.value)} placeholder="Opmerkingen (optioneel)" className="w-full rounded-xl border p-3" rows={3} />
        <button disabled={bezig || !file} className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{bezig ? "Uploaden..." : "Document uploaden"}</button>
      </form>
      {bericht && <p className="rounded-xl border bg-white p-4 text-sm">{bericht}</p>}
      <section className="rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="font-bold">Documenten</h2></div>
        {documenten.length === 0 ? <p className="p-5 text-sm text-slate-500">Nog geen documenten.</p> : <div className="divide-y">{documenten.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-semibold">{document.naam}</p><p className="text-sm text-slate-500">{document.categorie}{document.verloopDatum ? ` · verloopt ${new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(document.verloopDatum))}` : ""}</p></div><div className="flex gap-2"><a href={`/api/medewerkers/${id}/documenten/${document.id}/download`} className="rounded-lg border px-3 py-2 text-sm">Openen</a><button onClick={() => void verwijderen(document.id)} className="rounded-lg border px-3 py-2 text-sm">Verwijderen</button></div></div>)}</div>}
      </section>
    </main>
  );
}
