import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { fout: "Niet gevonden." },
    { status: 404 },
  );
}
