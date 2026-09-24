import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { maakToken } from "@/lib/auth";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const wachtwoord = typeof body?.wachtwoord === "string" ? body.wachtwoord : "";

    if (!email || !wachtwoord) {
      return NextResponse.json(
        { message: "Vul e-mailadres en wachtwoord in." },
        { status: 400 },
      );
    }

    const gebruiker = await prisma.systeemGebruiker.findUnique({
      where: { email },
      include: {
        medewerker: {
          include: {
            status: true,
            rollen: { select: { rolId: true } },
          },
        },
      },
    });

    if (!gebruiker) {
      return NextResponse.json(
        { message: "Ongeldige inloggegevens." },
        { status: 401 },
      );
    }

    const medewerker = gebruiker.medewerker;
    const wachtOpEigenaar =
      medewerker?.status?.module === "MEDEWERKER" &&
      medewerker.status.code === "AANGEMELD" &&
      medewerker.actief === false;

    if (wachtOpEigenaar) {
      return NextResponse.json(
        {
          message:
            "Je account is succesvol geregistreerd. De eigenaar moet je rol nog toewijzen voordat je kunt inloggen.",
        },
        { status: 403 },
      );
    }

    if (!gebruiker.actief) {
      return NextResponse.json(
        { message: "Dit account is gedeactiveerd." },
        { status: 403 },
      );
    }

    if (medewerker && (!medewerker.actief || medewerker.rollen.length === 0)) {
      return NextResponse.json(
        {
          message:
            "Je account is geactiveerd, maar je toegang wordt nog klaargezet door de eigenaar.",
        },
        { status: 403 },
      );
    }

    const geldig = await bcrypt.compare(wachtwoord, gebruiker.wachtwoordHash);
    if (!geldig) {
      return NextResponse.json(
        { message: "Ongeldige inloggegevens." },
        { status: 401 },
      );
    }

    const token = await maakToken({
      sub: gebruiker.id,
      naam: gebruiker.naam,
      email: gebruiker.email,
    });

    const cookieStore = await cookies();
    cookieStore.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    await prisma.systeemGebruiker.update({
      where: { id: gebruiker.id },
      data: { laatsteLoginOp: new Date() },
    });

    try {
      await prisma.auditLog.create({
        data: {
          systeemGebruikerId: gebruiker.id,
          module: "AUTH",
          actie: "LOGIN_SUCCES",
          recordId: gebruiker.id,
          details: { requestId },
        },
      });
    } catch (auditError) {
      console.warn("Login-audit kon niet worden opgeslagen:", { requestId, auditError });
    }

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
  } catch (error) {
    console.error("Login mislukt:", { requestId, error });
    return NextResponse.json(
      { message: "Er is een interne fout opgetreden." },
      { status: 500 },
    );
  }
}
