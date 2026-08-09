import { NextResponse } from "next/server";

import { hasPermissionForVestiging } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const vestigingId =
      searchParams.get("vestigingId");

    if (!vestigingId) {
      return NextResponse.json(
        {
          fout:
            "vestigingId is verplicht.",
        },
        { status: 400 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.view,
        vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Geen toegang tot planningtags voor deze vestiging.",
        },
        { status: 403 },
      );
    }

    const tags = await prisma.tag.findMany({
      where: {
        actief: true,
      },
      orderBy: {
        volgorde: "asc",
      },
      select: {
        id: true,
        naam: true,
        volgorde: true,
        actief: true,
      },
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error(
      "Fout bij ophalen planningtags:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De planningtags konden niet worden opgehaald.",
      },
      { status: 500 },
    );
  }
}