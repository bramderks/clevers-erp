import { NextRequest, NextResponse } from "next/server";

import { medewerkerAanmelden } from "@/modules/medewerkers/aanmelden/service/medewerker-aanmelden.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const resultaat = await medewerkerAanmelden(body);

    return NextResponse.json(resultaat, {
      status: 201,
    });
  } catch (error) {
    console.error("Aanmelden mislukt:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Er is een onbekende fout opgetreden.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 400,
      },
    );
  }
}