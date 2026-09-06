import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function fout(fout:string,status:number){return NextResponse.json({fout},{status});}
function datum(value:string){const d=new Date(value+"T00:00:00");return Number.isNaN(d.getTime())?null:d;}
function dagen(start:Date,eind:Date){return Math.floor((eind.getTime()-start.getTime())/86400000)+1;}
function deadlineVoorSeizoen(seizoenStart:Date){return new Date(seizoenStart.getFullYear(),3,30,23,59,59,999);}
function zomerGrenzen(jaar:number){return {start:new Date(jaar,5,1),einde:new Date(jaar,7,31,23,59,59,999)};}

async function magEigenaar(gebruiker:Awaited<ReturnType<typeof getCurrentUser>>){
 return !!gebruiker?.organisaties.some(r=>r.actief&&r.organisatie.actief&&r.rol.naam.trim().toLowerCase()==="eigenaar");
}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const gebruiker=await getCurrentUser(); if(!gebruiker)return fout("Je moet ingelogd zijn.",401);
 const {id}=await params; const eigenaar=await magEigenaar(gebruiker);
 if(!eigenaar&&gebruiker.medewerker?.id!==id)return fout("Geen toegang.",403);
 const [aanvragen, medewerker]=await Promise.all([prisma.vakantieAanvraag.findMany({where:{medewerkerId:id},orderBy:{startDatum:"asc"},select:{id:true,startDatum:true,eindDatum:true,vestigingId:true,status:true,opmerking:true,redenAfwijzing:true,vestiging:{select:{naam:true}}}}),prisma.medewerker.findUnique({where:{id},select:{vestigingen:{select:{vestiging:{select:{id:true,naam:true,actief:true,seizoenStart:true}}}}}})]);
 const vestigingen=(medewerker?.vestigingen??[]).map(v=>v.vestiging).filter(v=>v.actief&&v.seizoenStart).map(v=>({id:v.id,naam:v.naam}));
 return NextResponse.json({aanvragen:aanvragen.map(a=>({...a,vestigingNaam:a.vestiging.naam})),vestigingen});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const gebruiker=await getCurrentUser(); if(!gebruiker)return fout("Je moet ingelogd zijn.",401);
 const {id}=await params;
 if(gebruiker.medewerker?.id!==id)return fout("Een vakantieplanning kan alleen voor je eigen medewerkerprofiel worden ingediend.",403);
 const body=await request.json() as {startDatum?:string;eindDatum?:string;vestigingId?:string;opmerking?:string};
 const start=body.startDatum?datum(body.startDatum):null, einde=body.eindDatum?datum(body.eindDatum):null;
 if(!start||!einde||!body.vestigingId)return fout("Vul vestiging, startdatum en einddatum in.",400);
 if(einde<start)return fout("De einddatum kan niet vóór de startdatum liggen.",400);
 const medewerker=await prisma.medewerker.findUnique({where:{id},select:{actief:true,vestigingen:{where:{vestigingId:body.vestigingId},select:{vestiging:{select:{id:true,naam:true,actief:true,seizoenStart:true}}}}}});
 if(!medewerker?.actief)return fout("Alleen actieve medewerkers kunnen een vakantieplanning indienen.",400);
 const vestiging=medewerker.vestigingen[0]?.vestiging; if(!vestiging||!vestiging.actief)return fout("Deze medewerker is niet actief gekoppeld aan deze vestiging.",400);
 if(!vestiging.seizoenStart)return fout("De eigenaar heeft voor deze vestiging nog geen seizoenstart ingesteld.",400);
 const deadline=deadlineVoorSeizoen(vestiging.seizoenStart); if(new Date()>deadline)return fout("De deadline van 30 april voor deze vakantieplanning is verstreken.",400); const jaar=vestiging.seizoenStart.getFullYear(); const zomer=zomerGrenzen(jaar);
 if(start<zomer.start||einde>zomer.einde)return fout("De vakantieplanning mag alleen betrekking hebben op juni, juli en augustus van het seizoen.",400);
 if(dagen(start,einde)>14)return fout("Je mag maximaal 14 dagen aaneengesloten vakantie plannen.",400);
 const bestaande=await prisma.vakantieAanvraag.findMany({where:{medewerkerId:id,vestigingId:vestiging.id,status:{in:["AANGEVRAAGD","GOEDGEKEURD"]},startDatum:{lte:zomer.einde},eindDatum:{gte:zomer.start}},select:{startDatum:true,eindDatum:true}});
 const totaal=bestaande.reduce((som,a)=>som+dagen(a.startDatum,a.eindDatum),0)+dagen(start,einde);
 if(totaal>14)return fout("In totaal mag je in juni, juli en augustus maximaal 14 dagen vakantie plannen.",400);
 const aanvraag=await prisma.vakantieAanvraag.create({data:{medewerkerId:id,vestigingId:vestiging.id,startDatum:start,eindDatum:einde,type:"VAKANTIE",opmerking:body.opmerking?.trim()||null,status:"AANGEVRAAGD"}});
 return NextResponse.json({aanvraag,deadline}, {status:201});
}
