import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "Activatielink ontbreekt." }, { status: 400 });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invitation = await prisma.medewerkerUitnodiging.findUnique({ where: { tokenHash }, select: { voornaam: true, achternaam: true, email: true, verlooptOp: true, gebruiktOp: true } });
  if (!invitation || invitation.gebruiktOp || invitation.verlooptOp < new Date()) return NextResponse.json({ error: "Deze activatielink is ongeldig of verlopen." }, { status: 400 });
  return NextResponse.json({ voornaam: invitation.voornaam, achternaam: invitation.achternaam, email: invitation.email });
}
