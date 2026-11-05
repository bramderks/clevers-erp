import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  INACTIVITEIT_TIMEOUT_SECONDEN,
  controleerActiviteitToken,
  controleerToken,
  maakActiviteitToken,
} from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const activiteit = cookieStore.get("activity")?.value;

  if (!token || !activiteit) {
    return NextResponse.json({ message: "Sessie verlopen." }, { status: 401 });
  }

  try {
    const sessie = await controleerToken(token);
    if (!sessie.sub || !(await controleerActiviteitToken(activiteit, sessie.sub))) {
      return NextResponse.json({ message: "Sessie verlopen." }, { status: 401 });
    }

    cookieStore.set({
      name: "activity",
      value: await maakActiviteitToken(sessie.sub),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: INACTIVITEIT_TIMEOUT_SECONDEN,
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ message: "Sessie verlopen." }, { status: 401 });
  }
}
