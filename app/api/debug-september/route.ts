import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TOKEN = "clevers-september-rebuild-2026";
const LEIDINGGEVENDEN = new Set(["Jessica Derks","Bram Derks","Andrea de Bock","Pleun Kamps","Jayro Peters"]);
const BRON = "2026-09-01|Andrea de Bock|09:00|14:00;2026-09-01|Bram Derks|14:00|22:15;2026-09-01|Julia Leenders|18:00|22:15;2026-09-02|Jessica Derks|09:00|18:00;2026-09-02|Jayro Peters|18:00|22:15;2026-09-03|Jessica Derks|09:00|17:00;2026-09-03|Jayro Peters|17:00|22:15;2026-09-03|Julia Leenders|18:00|22:15;2026-09-04|Bram Derks|09:00|14:00;2026-09-04|Andrea de Bock|14:00|22:15;2026-09-04|Isa Derks|18:00|21:00;2026-09-04|Pleun Schenk|18:00|22:15;2026-09-05|Jessica Derks|09:00|14:00;2026-09-05|Pleun Kamps,Maureen Houkes|14:00|22:00;2026-09-05|Millie Kempenaar|18:00|22:00;2026-09-06|Jessica Derks|09:00|14:00;2026-09-06|Lotte Trilsbeek|14:00|18:00;2026-09-06|Bram Derks|14:00|22:15;2026-09-06|Pleun Schenk,Maud Broeren|18:00|22:15;2026-09-07|Andrea de Bock|11:30|17:00;2026-09-07|Coosje Helsen,Jayro Peters|17:00|21:30;2026-09-08|Bram Derks|11:30|17:00;2026-09-08|Julia Leenders,Jayro Peters|17:00|20:45;2026-09-09|Jessica Derks|11:30|21:00;2026-09-10|Jessica Derks|11:30|17:00;2026-09-10|Sayanora Amadmoesri,Jayro Peters|17:00|21:00;2026-09-11|Andrea de Bock|11:30|21:00;2026-09-11|Pleun Schenk|17:30|21:00;2026-09-11|Isa Derks|18:00|21:00;2026-09-12|Pleun Kamps|11:30|21:00;2026-09-12|Coosje Helsen|14:00|21:00;2026-09-13|Bram Derks|11:30|20:45;2026-09-13|Pleun Schenk|17:00|20:45;2026-09-13|Maud Broeren|18:00|20:45;2026-09-14|Andrea de Bock|11:30|17:00;2026-09-14|Coosje Helsen,Jayro Peters|17:00|21:15;2026-09-15|Bram Derks|11:30|21:30;2026-09-15|Lotte Trilsbeek|17:00|21:00;2026-09-16|Jessica Derks|11:30|21:00;2026-09-17|Bram Derks|11:30|21:00;2026-09-17|Maud Broeren|17:00|21:00;2026-09-18|Andrea de Bock|11:30|21:00;2026-09-18|Isa Derks|17:00|21:00;2026-09-19|Pleun Kamps|11:30|20:45;2026-09-19|Maureen Houkes|14:00|17:00;2026-09-19|Sayanora Amadmoesri|17:00|20:45;2026-09-20|Jessica Derks|11:30|21:15;2026-09-20|Lotte Trilsbeek|14:00|18:00;2026-09-20|Maud Broeren|17:00|21:15;2026-09-21|Andrea de Bock|11:30|17:00;2026-09-21|Coosje Helsen,Jayro Peters|17:00|21:00;2026-09-22|Bram Derks|11:30|17:00;2026-09-22|Andrea de Bock,Maud Broeren|17:00|20:45;2026-09-23|Jessica Derks|11:30|21:30;2026-09-24|Bram Derks|11:30|21:00;2026-09-24|Sayanora Amadmoesri|17:00|21:00;2026-09-25|Andrea de Bock|11:30|21:00;2026-09-25|Julia Leenders|17:00|21:00;2026-09-26|Pleun Kamps|11:30|21:30;2026-09-26|Millie Kempenaar|17:00|21:30;2026-09-27|Jessica Derks|11:30|21:30;2026-09-27|Lotte Trilsbeek|14:00|18:00;2026-09-27|Maud Broeren|17:00|21:00;2026-09-28|Andrea de Bock|11:00|17:00;2026-09-28|Coosje Helsen,Jayro Peters|17:00|21:00;2026-09-29|Bram Derks|11:30|21:30;2026-09-29|Julia Leenders|17:00|21:00;2026-09-30|Jessica Derks|11:30|21:00;2026-09-30|Julia Leenders|13:00|17:00;2026-09-30|Millie Kempenaar|17:00|21:00;2026-09-30|Isa Derks|17:30|21:00";

function norm(v:string){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");}
function naam(m:{voornaam:string,tussenvoegsel:string|null,achternaam:string}){return [m.voornaam,m.tussenvoegsel,m.achternaam].filter(Boolean).join(" ");}
function local(date:string,time:string){return new Date(date+"T"+time+":00+02:00");}
function isoWeek(datum:Date){const d=new Date(Date.UTC(datum.getFullYear(),datum.getMonth(),datum.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const year=d.getUTCFullYear();const first=new Date(Date.UTC(year,0,4));const fd=first.getUTCDay()||7;return {jaar:year,weeknummer:1+Math.round((d.getTime()-first.getTime())/(7*86400000))};}
function rows(){return BRON.split(";").map(x=>{const [date,names,start,end]=x.split("|");return {date,names:names.split(","),start,end};});}

export async function GET(request:Request){
  if(new URL(request.url).searchParams.get("token")!==TOKEN)return NextResponse.json({fout:"Ongeldige token."},{status:403});
  try{
    const vestiging=await prisma.vestiging.findFirst({where:{naam:"Nijmegen",actief:true},select:{id:true}});
    if(!vestiging)return NextResponse.json({fout:"Vestiging Nijmegen niet gevonden."},{status:404});
    const [leidingTag,handijsTag]=await Promise.all([
      prisma.tag.findFirst({where:{naam:"Leidinggevende",actief:true},select:{id:true}}),
      prisma.tag.findFirst({where:{naam:"Handijs",actief:true},select:{id:true}})
    ]);
    if(!leidingTag||!handijsTag)return NextResponse.json({fout:"Tags ontbreken."},{status:400});
    const medewerkers=await prisma.medewerker.findMany({where:{actief:true,vestigingen:{some:{vestigingId:vestiging.id}}},select:{id:true,voornaam:true,tussenvoegsel:true,achternaam:true,roepnaam:true}});
    const byName=new Map<string,string>();
    for(const m of medewerkers){byName.set(norm(naam(m)),m.id);if(m.roepnaam)byName.set(norm([m.roepnaam,m.tussenvoegsel,m.achternaam].filter(Boolean).join(" ")),m.id);}
    const medewerkerId=(n:string)=>byName.get(norm(n))??(norm(n)===norm("Andrea de Bock")?byName.get(norm("Andrea de Bock Berghmans")):undefined);
    const inputRows=rows();
    const missing=[...new Set(inputRows.flatMap(x=>x.names).filter(n=>!medewerkerId(n)))];
    if(missing.length)return NextResponse.json({fout:"Medewerkers ontbreken.",missing},{status:400});
    const start=new Date("2026-08-31T22:00:00.000Z"),end=new Date("2026-10-01T22:00:00.000Z");
    const old=await prisma.dienst.findMany({where:{week:{vestigingId:vestiging.id},datum:{gte:start,lt:end}},select:{id:true}});
    await prisma.dienst.deleteMany({where:{id:{in:old.map(x=>x.id)}}});
    let diensten=0,koppelingen=0,leiding=0,handijs=0;
    for(const item of inputRows){
      const datum=local(item.date,"00:00"), begintijd=local(item.date,item.start), eindtijd=local(item.date,item.end);
      const iw=isoWeek(datum);
      const week=await prisma.week.findFirst({where:{vestigingId:vestiging.id,jaar:iw.jaar,weeknummer:iw.weeknummer},select:{id:true}});
      if(!week)throw new Error("Planningweek ontbreekt: "+iw.jaar+"-"+iw.weeknummer);
      const isLeiding=item.names.some(n=>LEIDINGGEVENDEN.has(n));
      const dienst=await prisma.dienst.create({data:{weekId:week.id,datum,begintijd,eindtijd,tags:{create:{tagId:isLeiding?leidingTag.id:handijsTag.id,aantal:1}}},select:{id:true}});
      diensten++;
      for(const n of item.names){await prisma.dienstBezetting.create({data:{dienstId:dienst.id,medewerkerId:medewerkerId(n)!,status:"GEPLAND"}});koppelingen++;}
      if(isLeiding)leiding++;else handijs++;
    }
    return NextResponse.json({succes:true,verwijderd:old.length,nieuweDiensten:diensten,koppelingen,leidinggevende:leiding,handijs,bronRijen:inputRows.length});
  }catch(error){console.error("September rebuild mislukt:",error);return NextResponse.json({fout:error instanceof Error?error.message:"Onbekende fout"},{status:500});}
}
