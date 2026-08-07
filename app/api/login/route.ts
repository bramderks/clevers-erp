import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { maakToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, wachtwoord } = await req.json();

  const gebruiker = await prisma.gebruiker.findUnique({
    where: {
      email,
    },
    include: {
      rollen: {
        include: {
          rol: true,
        },
      },
    },
  });

  if (!gebruiker) {
    return NextResponse.json(
      { error: "Ongeldige gegevens" },
      { status: 401 }
    );
  }

  const geldig = await bcrypt.compare(
    wachtwoord,
    gebruiker.wachtwoordHash
  );

  if (!geldig) {
    return NextResponse.json(
      { error: "Ongeldige gegevens" },
      { status: 401 }
    );
  }

  const token = await maakToken({
    id: gebruiker.id,
    naam: gebruiker.naam,
    email: gebruiker.email,
    rollen: gebruiker.rollen.map((r) => r.rol.naam),
  });

  (await cookies()).set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return NextResponse.json({
    success: true,
  });
}