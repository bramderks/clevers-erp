import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string;vakantieId:string}>}){
 const gebruiker=await getCurrentUser();
 if(!gebruiker)return NextResponse.json({fout:"Je moet ingelogd zijn."},{status:401});
 const eigenaar=gebruiker.organisaties.some(r=>r.actief&&r.organisatie.actief&&r.rol.naam.trim().toLowerCase()==="eigenaar");
 if(!eigenaar)return NextResponse.json({fout:"Alleen de eigenaar mag vakantieaanvragen beoordelen."},{status:403});
 const {id,vakantieId}=await params; const body=await request.json() as {status?:string;redenAfwijzing?:string};
 if(!["GOEDGEKEURD","AFGEWEZEN"].includes(body.status??""))return NextResponse.json({fout:"Ongeldige beoordeling."},{status:400});
 const aanvraag=await prisma.vakantieAanvraag.findFirst({where:{id:vakantieId,medewerkerId:id}});
 if(!aanvraag)return NextResponse.json({fout:"Vakantieaanvraag niet gevonden."},{status:404});
 const resultaat=await prisma.vakantieAanvraag.update({where:{id:vakantieId},data:{status:body.status,beoordeeldDoorId:gebruiker.id,beoordeeldOp:new Date(),redenAfwijzing:body.status==="AFGEWEZEN"?(body.redenAfwijzing?.trim()||null):null}});
 return NextResponse.json({aanvraag:resultaat});
}
