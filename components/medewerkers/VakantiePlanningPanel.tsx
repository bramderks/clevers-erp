"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

type Aanvraag = {
  id: string;
  startDatum: string;
  eindDatum: string;
  vestigingId: string;
  vestigingNaam: string;
  status: string;
  opmerking: string | null;
  redenAfwijzing: string | null;
};

function fmt(d:string){return new Intl.DateTimeFormat("nl-NL",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(d));}

export default function VakantiePlanningPanel({medewerkerId,isEigenaar}:{medewerkerId:string;isEigenaar:boolean}) {
  const [items,setItems]=useState<Aanvraag[]>([]);
  const [loading,setLoading]=useState(true);
  const [fout,setFout]=useState<string|null>(null);
  const [opslaan,setOpslaan]=useState(false);
  const [startDatum,setStartDatum]=useState("");
  const [eindDatum,setEindDatum]=useState("");
  const [vestigingId,setVestigingId]=useState("");
  const [opmerking,setOpmerking]=useState("");

  async function laad(){
    setLoading(true);
    const r=await fetch(`/api/medewerkers/${encodeURIComponent(medewerkerId)}/vakantie`,{cache:"no-store"});
    const d=await r.json();
    if(!r.ok){setFout(d.fout ?? "Vakantieplanning kon niet worden geladen.");setLoading(false);return;}
    setItems(d.aanvragen ?? []);
    setLoading(false);
  }
  useEffect(()=>{void laad();},[medewerkerId]);

  async function indienen(e:React.FormEvent){
    e.preventDefault();setFout(null);setOpslaan(true);
    const r=await fetch(`/api/medewerkers/${encodeURIComponent(medewerkerId)}/vakantie`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({startDatum,eindDatum,vestigingId,opmerking})});
    const d=await r.json();
    setOpslaan(false);
    if(!r.ok){setFout(d.fout ?? "Aanvraag kon niet worden opgeslagen.");return;}
    setStartDatum("");setEindDatum("");setVestigingId("");setOpmerking("");await laad();
  }

  async function beoordeel(id:string,status:"GOEDGEKEURD"|"AFGEWEZEN"){
    const reden=status==="AFGEWEZEN"?window.prompt("Reden van afwijzing:") ?? "":undefined;
    if(status==="AFGEWEZEN" && !reden.trim()) return;
    const r=await fetch(`/api/medewerkers/${encodeURIComponent(medewerkerId)}/vakantie/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status,redenAfwijzing:reden})});
    const d=await r.json();
    if(!r.ok){setFout(d.fout ?? "Aanvraag kon niet worden beoordeeld.");return;}
    await laad();
  }

  const statusVariant=(s:string)=>s==="GOEDGEKEURD"?"success":s==="AFGEWEZEN"?"danger":s==="GEANNULEERD"?"default":"warning";

  return <div className="space-y-6">
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <p className="font-semibold">Zomervakantie juni, juli en augustus</p>
      <p className="mt-1">Je levert je vakantieplanning uiterlijk 30 april in. In deze periode mag je maximaal 14 dagen vakantie opnemen, ook maximaal 14 dagen aaneengesloten.</p>
    </div>
    <form onSubmit={indienen} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">Vestiging<select required value={vestigingId} onChange={e=>setVestigingId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Kies een vestiging</option>{Array.from(new Map(items.map(i=>[i.vestigingId,i.vestigingNaam])).entries()).map(([id,naam])=><option key={id} value={id}>{naam}</option>)}</select></label>
      <label className="text-sm font-medium text-slate-700">Startdatum<input required type="date" value={startDatum} onChange={e=>setStartDatum(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"/></label>
      <label className="text-sm font-medium text-slate-700">Einddatum<input required type="date" value={eindDatum} onChange={e=>setEindDatum(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"/></label>
      <label className="text-sm font-medium text-slate-700 md:col-span-2">Opmerking<textarea value={opmerking} onChange={e=>setOpmerking(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"/></label>
      {fout && <p className="text-sm text-red-700 md:col-span-2">{fout}</p>}
      <div className="md:col-span-2"><Button disabled={opslaan}>{opslaan?"Opslaan...":"Vakantieplanning indienen"}</Button></div>
    </form>
    <div className="space-y-3">
      {loading?<p className="text-sm text-slate-500">Laden...</p>:items.length===0?<p className="text-sm text-slate-500">Nog geen vakantieplanning ingediend.</p>:items.map(i=><div key={i.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{fmt(i.startDatum)} t/m {fmt(i.eindDatum)}</p><p className="mt-1 text-sm text-slate-500">{i.vestigingNaam}</p>{i.opmerking&&<p className="mt-2 text-sm text-slate-600">{i.opmerking}</p>}{i.redenAfwijzing&&<p className="mt-2 text-sm text-red-700">{i.redenAfwijzing}</p>}</div><div className="flex items-center gap-2"><Badge variant={statusVariant(i.status) as never}>{i.status}</Badge>{isEigenaar&&i.status==="AANGEVRAAGD"&&<><Button onClick={()=>void beoordeel(i.id,"GOEDGEKEURD")}>Goedkeuren</Button><Button variant="secondary" onClick={()=>void beoordeel(i.id,"AFGEWEZEN")}>Afwijzen</Button></>}</div></div></div>)}
    </div>
  </div>;
}
