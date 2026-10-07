import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DATA } from "./data";

const SECRET = "clevers-september-rebuild-2026-10-07";
const LEIDINGGEVENDEN = new Set(["Andrea de Bock","Bram Derks","Jayro Peters","Jessica Derks","Pleun Kamps"]);
const dt=(d:string,t:string)=>new Date(`${d}T${t}:00+02:00`);
const naam=(m:any)=>[m.voornaam,m.tussenvoegsel,m.achternaam].filter(Boolean).join(" ");

export async function GET(request:Request){
try{
if(new URL(request.url).searchParams.get("secret")!==SECRET)return NextResponse.json({fout:"Niet toegestaan."},{status:403});
const vestiging=await prisma.vestiging.findFirst({where:{naam:{contains:"Nijmegen",mode:"insensitive"}},select:{id:true,naam:true}});
if(!vestiging)return NextResponse.json({fout:"Nijmegen niet gevonden."},{status:404});
const namen=[...new Set(DATA.map(x=>x.naam))];
const medewerkers=await prisma.medewerker.findMany({where:{OR:namen.map(n=>{const p=n.split(" ");return{voornaam:p[0],achternaam:p.slice(1).join(" ")}})},select:{id:true,voornaam:true,tussenvoegsel:true,achternaam:true}});
const map=new Map<string,string>();
for(const n of namen){const ms=medewerkers.filter(m=>naam(m)===n);if(ms.length!==1)return NextResponse.json({fout:`Medewerker '${n}' niet uniek gevonden.`,gevonden:ms.map(naam)},{status:400});map.set(n,ms[0].id);}
const tags=await prisma.tag.findMany({where:{naam:{in:["Leidinggevende","Handijs"]},actief:true},select:{id:true,naam:true}});
const tagMap=new Map(tags.map(t=>[t.naam,t.id]));
if(!tagMap.has("Leidinggevende")||!tagMap.has("Handijs"))return NextResponse.json({fout:"Planningstags ontbreken."},{status:400});
const weken=await prisma.week.findMany({where:{vestigingId:vestiging.id,jaar:2026,weeknummer:{gte:36,lte:40}},select:{id:true,jaar:true,weeknummer:true}});
const weekMap=new Map(weken.map(w=>[`${w.jaar}-${w.weeknummer}`,w.id]));
const iso=(d:Date)=>{const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y=x.getUTCFullYear();const j=new Date(Date.UTC(y,0,4));const jd=j.getUTCDay()||7;j.setUTCDate(j.getUTCDate()+4-jd);return{year:y,week:1+Math.round((x.getTime()-j.getTime())/604800000)}};
const groepen=new Map<string,typeof DATA>();
for(const x of DATA){const k=`${x.datum}|${x.start}|${x.eind}`;groepen.set(k,[...(groepen.get(k)||[]),x]);}
const voorbereid=[...groepen.entries()].map(([k,items])=>{const[d,s,e]=k.split("|");const w=iso(dt(d,s));const weekId=weekMap.get(`${w.year}-${w.week}`);if(!weekId)throw new Error(`Week ontbreekt voor ${d}`);const l=items.filter(x=>LEIDINGGEVENDEN.has(x.naam)).length;const h=items.length-l;return{datum:dt(d,"00:00"),begintijd:dt(d,s),eindtijd:dt(d,e),weekId,items,tags:[...(l?[{tagId:tagMap.get("Leidinggevende")!,aantal:l}]:[]),...(h?[{tagId:tagMap.get("Handijs")!,aantal:h}]:[])]};});
const begin=dt("2026-09-01","00:00"),einde=dt("2026-10-01","00:00");
const bez=await prisma.dienstBezetting.findMany({where:{dienst:{week:{vestigingId:vestiging.id},datum:{gte:begin,lt:einde}}},select:{id:true}});
if(bez.length)await prisma.urenRegistratie.deleteMany({where:{dienstBezettingId:{in:bez.map(x=>x.id)}}});
const verwijderd=await prisma.dienst.deleteMany({where:{week:{vestigingId:vestiging.id},datum:{gte:begin,lt:einde}}});
let diensten=0,bezettingen=0;
for(const x of voorbereid){const d=await prisma.dienst.create({data:{weekId:x.weekId,datum:x.datum,begintijd:x.begintijd,eindtijd:x.eindtijd,tags:{create:x.tags}}});diensten++;for(const m of x.items){await prisma.dienstBezetting.create({data:{dienstId:d.id,medewerkerId:map.get(m.naam)!,status:"GEPLAND"}});bezettingen++;}}
return NextResponse.json({succes:true,vestiging:vestiging.naam,verwijderd:verwijderd.count,aangemaakt:diensten,bezettingen,bronDiensten:DATA.length});
}catch(e){console.error("September rebuild",e);return NextResponse.json({succes:false,fout:e instanceof Error?e.message:String(e)},{status:500});}
}