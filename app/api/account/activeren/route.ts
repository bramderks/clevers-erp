import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

function sterkeWachtwoord(wachtwoord: string) {
  return wachtwoord.length >= 12 && /[a-z]/.test(wachtwoord) && /[A-Z]/.test(wachtwoord) && /\d/.test(wachtwoord) && /[^A-Za-z0-9]/.test(wachtwoord);
}

function emailGeldig(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token : "";
    const aanhef = body?.aanhef;
    const roepnaam = typeof body?.roepnaam === "string" ? body.roepnaam.trim() : "";
    const geboortedatum = typeof body?.geboortedatum === "string" ? body.geboortedatum : "";
    const telefoon = typeof body?.telefoon === "string" ? body.telefoon.trim() : "";
    const wachtwoord = typeof body?.wachtwoord === "string" ? body.wachtwoord : "";
    const wachtwoordHerhaling = typeof body?.wachtwoordHerhaling === "string" ? body.wachtwoordHerhaling : "";

    if (!token) return NextResponse.json({ error: "Activatielink ontbreekt." }, { status: 400 });
    if (!["DHR", "MEVR", "ANDERS", "GEEN_OPGAVE"].includes(aanhef)) return NextResponse.json({ error: "Kies een geldige aanhef." }, { status: 400 });
    if (!geboortedatum || Number.isNaN(new Date(`${geboortedatum}T00:00:00`).getTime())) return NextResponse.json({ error: "Geboortedatum is verplicht." }, { status: 400 });
    if (!telefoon) return NextResponse.json({ error: "Telefoonnummer is verplicht." }, { status: 400 });
    if (!sterkeWachtwoord(wachtwoord)) return NextResponse.json({ error: "Kies een sterk wachtwoord van minimaal 12 tekens met hoofdletter, kleine letter, cijfer en speciaal teken." }, { status: 400 });
    if (wachtwoord !== wachtwoordHerhaling) return NextResponse.json({ error: "De wachtwoorden komen niet overeen." }, { status: 400 });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const uitnodiging = await prisma.medewerkerUitnodiging.findUnique({ where: { tokenHash } });
    if (!uitnodiging || uitnodiging.gebruiktOp || uitnodiging.verlooptOp < new Date()) return NextResponse.json({ error: "Deze activatielink is ongeldig of verlopen." }, { status: 400 });

    const status = await prisma.status.findUniqueOrThrow({ where: { module_code: { module: "MEDEWERKER", code: "AANGEMELD" } } });
    const wachtwoordHash = await bcrypt.hash(wachtwoord, 12);

    const resultaat = await prisma.$transaction(async (tx) => {
      const systeemGebruiker = await tx.systeemGebruiker.create({
        data: {
          naam: `${uitnodiging.voornaam} ${uitnodiging.achternaam}`,
          email: uitnodiging.email,
          wachtwoordHash,
          actief: true,
        },
      });

      const medewerker = await tx.medewerker.create({
        data: {
          systeemGebruikerId: systeemGebruiker.id,
          aanhef,
          voornaam: uitnodiging.voornaam,
          achternaam: uitnodiging.achternaam,
          roepnaam: roepnaam || null,
          geboortedatum: new Date(`${geboortedatum}T00:00:00`),
          email: uitnodiging.email,
          telefoon,
          statusId: status.id,
          actief: false,
          geactiveerdOp: new Date(),
          geactiveerdDoor: "MEDEWERKER",
        },
      });

      await tx.medewerkerUitnodiging.update({ where: { id: uitnodiging.id }, data: { gebruiktOp: new Date() } });
      return medewerker;
    });

    return NextResponse.json({ success: true, medewerkerId: resultaat.id });
  } catch (error) {
    console.error("Account activeren mislukt:", error);
    const message = error instanceof Error && error.message.includes("Unique constraint") ? "Dit account is al geactiveerd of het e-mailadres is al in gebruik." : "Het account kon niet worden geactiveerd.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
