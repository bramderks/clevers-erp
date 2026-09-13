import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, verstuurMail } from "@/lib/mail";

function emailGeldig(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const gebruiker = await getCurrentUser();
    if (!gebruiker) return NextResponse.json({ error: "Je moet ingelogd zijn." }, { status: 401 });

    const eigenaarRelaties = gebruiker.organisaties.filter(
      (r) => r.actief && r.organisatie.actief && r.rol.naam.trim().toLowerCase() === "eigenaar",
    );
    if (eigenaarRelaties.length === 0) {
      return NextResponse.json({ error: "Alleen de Eigenaar kan medewerkers uitnodigen." }, { status: 403 });
    }

    const body = await request.json();
    const voornaam = typeof body?.voornaam === "string" ? body.voornaam.trim() : "";
    const achternaam = typeof body?.achternaam === "string" ? body.achternaam.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const organisatieId = eigenaarRelaties[0].organisatieId;

    if (!voornaam || !achternaam) return NextResponse.json({ error: "Voornaam en achternaam zijn verplicht." }, { status: 400 });
    if (!emailGeldig(email)) return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });

    const bestaand = await prisma.systeemGebruiker.findUnique({ where: { email }, select: { id: true } });
    if (bestaand) return NextResponse.json({ error: "Er bestaat al een account met dit e-mailadres." }, { status: 409 });

    const bestaandMedewerker = await prisma.medewerker.findUnique({ where: { email }, select: { id: true } });
    if (bestaandMedewerker) return NextResponse.json({ error: "Er bestaat al een medewerker met dit e-mailadres." }, { status: 409 });

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const verlooptOp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.medewerkerUitnodiging.create({
      data: { organisatieId, voornaam, achternaam, email, tokenHash, verlooptOp, aangemaaktDoorId: gebruiker.id },
    });

    const activationUrl = absoluteUrl(`/account/activeren?token=${encodeURIComponent(token)}`);
    const text = `Beste ${voornaam},\n\nJe bent uitgenodigd om je Clevers ERP-account te activeren. Gebruik de volgende link om je account te activeren:\n${activationUrl}\n\nDe uitnodiging is 7 dagen geldig. Tijdens de activatie vul je je algemene gegevens in en kies je een sterk wachtwoord. Na goedkeuring van je rol ontvang je een tweede e-mail zodra je toegang tot Clevers ERP actief is.\n\nMet vriendelijke groet,\nClevers`;
    const html = `<p>Beste ${voornaam},</p><p>Je bent uitgenodigd om je <strong>Clevers ERP-account</strong> te activeren.</p><p><a href="${activationUrl}">Account activeren</a></p><p>De uitnodiging is 7 dagen geldig. Tijdens de activatie vul je je algemene gegevens in en kies je een sterk wachtwoord. Na toekenning van je rol ontvang je een tweede e-mail zodra je toegang actief is.</p><p>Met vriendelijke groet,<br>Clevers</p>`;
    await verstuurMail({ to: email, subject: "Uitnodiging om je Clevers ERP-account te activeren", html, text });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Medewerker uitnodigen mislukt:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "De uitnodiging kon niet worden verstuurd." }, { status: 500 });
  }
}
