import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const vestigingen = await prisma.vestiging.findMany({
    orderBy: {
      naam: "asc",
    },
  });

  return NextResponse.json(vestigingen);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const vestiging = await prisma.vestiging.create({
    data: {
      code: body.code,
      naam: body.naam,
    },
  });

  return NextResponse.json(vestiging);
}