import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verstuurPushNaarGebruiker } from "@/lib/push/service";

export async function POST() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return NextResponse.json(
      { fout: "Je moet ingelogd zijn." },
      { status: 401 },
    );
  }

  try {
    const resultaat = await verstuurPushNaarGebruiker({
      systeemGebruikerId: gebruiker.id,
      type: "PUSH_TEST",
      sleutel: "push-test:" + gebruiker.id + ":" + Date.now(),
      titel: "Testmelding",
      body: "Pushmeldingen werken. Dit is een testmelding.",
      href: "/dashboard",
    });

    if (resultaat.apparaten === 0) {
      return NextResponse.json(
        { fout: "Er is voor dit account geen actieve pushregistratie gevonden." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: resultaat.fouten === 0,
      verstuurd: resultaat.verstuurd,
      fouten: resultaat.fouten,
    });
  } catch (error) {
    return NextResponse.json(
      {
        fout:
          error instanceof Error
            ? error.message
            : "Testmelding kon niet worden verstuurd.",
      },
      { status: 500 },
    );
  }
}
