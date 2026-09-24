import { NextResponse } from "next/server";

import { logout } from "@/lib/auth";

export async function POST() {
  try {
    // Uitloggen is idempotent: ook als de sessie al verlopen is,
    // moet de gebruiker altijd terug naar de loginpagina kunnen.
    await logout();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Uitloggen mislukt:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Uitloggen is mislukt.",
      },
      {
        status: 500,
      },
    );
  }
}