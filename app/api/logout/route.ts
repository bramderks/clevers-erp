import { NextResponse } from "next/server";

import {
  getCurrentUser,
  logout,
} from "@/lib/auth";

export async function POST() {
  try {
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          error:
            "Je bent niet ingelogd.",
        },
        {
          status: 401,
        },
      );
    }

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