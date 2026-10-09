import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isoWeek(datum: Date) {
 const d = new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
 const dag = d.getUTCDay() || 7;
 d.setUTCDate(d.getUTCDate() + 4 - dag);
 const jaar = d.getUTCFullYear();
 const jaarStart = new Date(Date.UTC(jaar, 0, 1));
 return { jaar, weeknummer: Math.ceil((((d.getTime() - jaarStart.getTime()) / 86400000) + 1) / 7) };
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string;vakantieId:string}>}) {
 const gebruiker=await getCurrentUser();
 if(!gebruiker)return NextResponse.json({fout:"Je moet ingelogd zijn."},{status:401});
 const {id,vakantieId}=await params;
 const body=await request.json() as {status?:string;redenAfwijzing?:string};
 if(!["GOEDGEKEURD","AFGEWEZEN"].includes(body.status??""))return NextResponse.json({fout:"Ongeldige beoordeling."},{status:400});
 const aanvraag=await prisma.vakantieAanvraag.findFirst({where:{id:vakantieId,medewerkerId:id},select:{id:true,vestigingId:true,startDatum:true,eindDatum:true,type:true,status:true,vestiging:{select:{organisatieId:true}}}});
 if(!aanvraag)return NextResponse.json({fout:"Verlofaanvraag niet gevonden."},{status:404});
 const eigenaar=gebruiker.organisaties.some(r=>r.actief&&r.organisatie.actief&&r.organisatieId===aanvraag.vestiging.organisatieId&&r.rol.naam.trim().toLowerCase()==="eigenaar");
 if(!eigenaar)return NextResponse.json({fout:"Alleen de eigenaar van deze organisatie mag verlofaanvragen beoordelen."},{status:403});
 if(aanvraag.status!=="AANGEVRAAGD")return NextResponse.json({fout:"Deze aanvraag is al beoordeeld."},{status:400});
 const data={status:body.status,beoordeeldDoorId:gebruiker.id,beoordeeldOp:new Date(),redenAfwijzing:body.status==="AFGEWEZEN"?(body.redenAfwijzing?.trim()||null):null};
 if(body.status==="GOEDGEKEURD"&&aanvraag.type==="OVERIG"&&aanvraag.startDatum.getTime()===aanvraag.eindDatum.getTime()){
  const datum=new Date(Date.UTC(aanvraag.startDatum.getUTCFullYear(),aanvraag.startDatum.getUTCMonth(),aanvraag.startDatum.getUTCDate()));
  const {jaar,weeknummer}=isoWeek(datum);
  const week=await prisma.week.upsert({where:{vestigingId_jaar_weeknummer:{vestigingId:aanvraag.vestigingId,jaar,weeknummer}},update:{},create:{vestigingId:aanvraag.vestigingId,jaar,weeknummer,status:"OPEN"},select:{id:true}});
  const [,resultaat]=await prisma.$transaction([
   prisma.beschikbaarheid.upsert({where:{weekId_medewerkerId_datum:{weekId:week.id,medewerkerId:id,datum}},update:{datum,begintijd:null,eindtijd:null,status:"NIET_BESCHIKBAAR",opmerking:"Goedgekeurd dagverlof"},create:{weekId:week.id,medewerkerId:id,datum,begintijd:null,eindtijd:null,status:"NIET_BESCHIKBAAR",opmerking:"Goedgekeurd dagverlof"}}),
   prisma.vakantieAanvraag.update({where:{id:vakantieId},data})
  ]);
  return NextResponse.json({aanvraag:resultaat});
 }
 const resultaat=await prisma.vakantieAanvraag.update({where:{id:vakantieId},data});
 return NextResponse.json({aanvraag:resultaat});
}
