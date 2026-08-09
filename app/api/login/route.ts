import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { maakToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, wachtwoord } = await request.json();

    if (!email || !wachtwoord) {
      return NextResponse.json(
        {
          message: "Vul e-mailadres en wachtwoord in.",
        },
        {
          status: 400,
        },
      );
    }

    const gebruiker = await prisma.systeemGebruiker.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!gebruiker) {
      return NextResponse.json(
        {
          message: "Ongeldige inloggegevens.",
        },
        {
          status: 401,
        },
      );
    }

    if (!gebruiker.actief) {
      return NextResponse.json(
        {
          message: "Dit account is gedeactiveerd.",
        },
        {
          status: 403,
        },
      );
    }

    const geldig = await bcrypt.compare(
      wachtwoord,
      gebruiker.wachtwoordHash,
    );

    if (!geldig) {
      return NextResponse.json(
        {
          message: "Ongeldige inloggegevens.",
        },
        {
          status: 401,
        },
      );
    }

    const token = await maakToken({
      sub: gebruiker.id,
      naam: gebruiker.naam,
      email: gebruiker.email,
    });

    (await cookies()).set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    await prisma.systeemGebruiker.update({
      where: {
        id: gebruiker.id,
      },
      data: {
        laatsteLoginOp: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "Er is een interne fout opgetreden.",
      },
      {
        status: 500,
      },
    );
  }
}