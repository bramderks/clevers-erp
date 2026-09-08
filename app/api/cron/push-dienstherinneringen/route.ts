import { NextRequest, NextResponse } from "next/server";
import { verstuurDienstHerinneringen } from "@/lib/push/dienst-herinneringen";

export const dynamic = "force-dynamic";

function geautoriseerd(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!geautoriseerd(request)) {
    return NextResponse.json(
      { fout: "Niet geautoriseerd." },
      { status: 401 },
    );
  }

  try {
    const resultaat = await verstuurDienstHerinneringen();

    return NextResponse.json({
      ok: true,
      ...resultaat,
    });
  } catch (error) {
    console.error("Dienstherinneringen mislukt:", error);

    return NextResponse.json(
      {
        fout: "Dienstherinneringen konden niet worden verwerkt.",
      },
      { status: 500 },
    );
  }
}
