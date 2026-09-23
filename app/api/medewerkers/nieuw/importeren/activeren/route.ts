import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, verstuurMail } from "@/lib/mail";

type Medewerker = { voornaam: string; achternaam: string; email: string };

export async function POST(request: Request) {
  try {
    const gebruiker = await getCurrentUser();
    if (!gebruiker) return NextResponse.json({ error: "Je moet ingelogd zijn." }, { status: 401 });

    const eigenaar = gebruiker.organisaties.find(
      (r) => r.actief && r.organisatie.actief && r.rol.naam.trim().toLowerCase() === "eigenaar",
    );
    if (!eigenaar) return NextResponse.json({ error: "Alleen de Eigenaar kan activaties versturen." }, { status: 403 });

    const body = await request.json();
    const medewerkers = Array.isArray(body?.medewerkers) ? body.medewerkers as Medewerker[] : [];
    if (!medewerkers.length) return NextResponse.json({ error: "Er zijn geen medewerkers om uit te nodigen." }, { status: 400 });

    const geldig: Medewerker[] = [];
    const gezien = new Set<string>();
    for (const item of medewerkers) {
      const voornaam = String(item?.voornaam ?? "").trim();
      const achternaam = String(item?.achternaam ?? "").trim();
      const email = String(item?.email ?? "").trim().toLowerCase();
      if (!voornaam || !achternaam || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if (gezien.has(email)) continue;
      gezien.add(email);
      geldig.push({ voornaam, achternaam, email });
    }

    const uitnodigingen: Array<{ medewerker: Medewerker; token: string }> = [];
    for (const medewerker of geldig) {
      const bestaat = await prisma.systeemGebruiker.findUnique({ where: { email: medewerker.email }, select: { id: true } });
      const bestaatMedewerker = await prisma.medewerker.findUnique({ where: { email: medewerker.email }, select: { id: true } });
      const openstaand = await prisma.medewerkerUitnodiging.findFirst({
        where: { organisatieId: eigenaar.organisatieId, email: medewerker.email, gebruiktOp: null, verlooptOp: { gt: new Date() } },
        select: { id: true },
      });
      if (bestaat || bestaatMedewerker || openstaand) continue;

      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await prisma.medewerkerUitnodiging.create({
        data: {
          organisatieId: eigenaar.organisatieId,
          voornaam: medewerker.voornaam,
          achternaam: medewerker.achternaam,
          email: medewerker.email,
          tokenHash,
          verlooptOp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          aangemaaktDoorId: gebruiker.id,
        },
      });
      uitnodigingen.push({ medewerker, token });
    }

    const resultaten: Array<{ email: string; ok: boolean; melding?: string }> = [];
    for (const { medewerker, token } of uitnodigingen) {
      try {
        const activationUrl = absoluteUrl(`/account/activeren?token=${encodeURIComponent(token)}`);
        const text = `Beste ${medewerker.voornaam},\n\nJe bent uitgenodigd om je Clevers ERP-account te activeren. Gebruik de volgende link om je account te activeren:\n${activationUrl}\n\nDe uitnodiging is 7 dagen geldig. Tijdens de activatie vul je je algemene gegevens in en kies je een sterk wachtwoord. Na goedkeuring van je rol ontvang je een tweede e-mail zodra je toegang tot Clevers ERP actief is.\n\nMet vriendelijke groet,\nClevers`;
        const html = `<p>Beste ${medewerker.voornaam},</p><p>Je bent uitgenodigd om je <strong>Clevers ERP-account</strong> te activeren.</p><p><a href="${activationUrl}">Account activeren</a></p><p>De uitnodiging is 7 dagen geldig. Tijdens de activatie vul je de algemene gegevens en een sterk wachtwoord in.</p><p>Met vriendelijke groet,<br>Clevers</p>`;
        await verstuurMail({ to: medewerker.email, subject: "Uitnodiging om je Clevers ERP-account te activeren", html, text });
        resultaten.push({ email: medewerker.email, ok: true });
      } catch (error) {
        console.error("Activatiemail mislukt:", error);
        resultaten.push({ email: medewerker.email, ok: false, melding: "E-mail kon niet worden verstuurd." });
      }
    }

    return NextResponse.json({
      ok: resultaten.every((r) => r.ok),
      verstuurd: resultaten.filter((r) => r.ok).length,
      resultaten,
    });
  } catch (error) {
    console.error("Bulk activaties versturen:", error);
    return NextResponse.json({ error: "De activatie-uitnodigingen konden niet worden verstuurd." }, { status: 500 });
  }
}
