import { NextResponse } from "next/server";

import { hasPermissionForVestiging } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const TOEGESTANE_STATUSSEN = [
  "OPEN",
  "GEPLAND",
  "BEVESTIGD",
  "AFGEZEGD",
  "GEWERKT",
] as const;

type BezettingStatus =
  (typeof TOEGESTANE_STATUSSEN)[number];

async function haalDienstOp(
  dienstId: string,
) {
  return prisma.dienst.findUnique({
    where: {
      id: dienstId,
    },
    select: {
      id: true,
      week: {
        select: {
          vestigingId: true,
        },
      },
    },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const dienstId =
      searchParams.get("dienstId");

    if (!dienstId) {
      return NextResponse.json(
        {
          fout:
            "dienstId is verplicht.",
        },
        { status: 400 },
      );
    }

    const dienst =
      await haalDienstOp(dienstId);

    if (!dienst) {
      return NextResponse.json(
        {
          fout:
            "Dienst niet gevonden.",
        },
        { status: 404 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.view,
        dienst.week.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Geen toegang tot deze planning.",
        },
        { status: 403 },
      );
    }

    const bezetting =
      await prisma.dienstBezetting.findMany({
        where: {
          dienstId,
        },
        include: {
          medewerker: {
            select: {
              id: true,
              personeelsnummer: true,
              aanhef: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
            },
          },
        },
        orderBy: {
          aangemaaktOp: "asc",
        },
      });

    return NextResponse.json(
      bezetting,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen bezetting:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De bezetting kon niet worden opgehaald.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const dienstId = body?.dienstId;
    const medewerkerId =
      body?.medewerkerId;
    const status = body?.status;

    if (
      typeof dienstId !== "string" ||
      dienstId.length === 0
    ) {
      return NextResponse.json(
        {
          fout:
            "dienstId is verplicht.",
        },
        { status: 400 },
      );
    }

    if (
      medewerkerId !== undefined &&
      medewerkerId !== null &&
      typeof medewerkerId !== "string"
    ) {
      return NextResponse.json(
        {
          fout:
            "medewerkerId is ongeldig.",
        },
        { status: 400 },
      );
    }

    const dienst =
      await haalDienstOp(dienstId);

    if (!dienst) {
      return NextResponse.json(
        {
          fout:
            "Dienst niet gevonden.",
        },
        { status: 404 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.update,
        dienst.week.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om de bezetting te wijzigen.",
        },
        { status: 403 },
      );
    }

    if (
      status !== undefined &&
      (
        typeof status !== "string" ||
        !TOEGESTANE_STATUSSEN.includes(
          status as BezettingStatus,
        )
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "Ongeldige bezettingsstatus.",
        },
        { status: 400 },
      );
    }

    const gekozenStatus: BezettingStatus =
      typeof status === "string"
        ? (status as BezettingStatus)
        : medewerkerId
          ? "GEPLAND"
          : "OPEN";

    if (medewerkerId) {
      const medewerker =
        await prisma.medewerker.findUnique({
          where: {
            id: medewerkerId,
          },
          select: {
            id: true,
            actief: true,
            vestigingen: {
              where: {
                vestigingId:
                  dienst.week.vestigingId,
              },
              select: {
                id: true,
              },
            },
          },
        });

      if (!medewerker) {
        return NextResponse.json(
          {
            fout:
              "Medewerker niet gevonden.",
          },
          { status: 404 },
        );
      }

      if (!medewerker.actief) {
        return NextResponse.json(
          {
            fout:
              "Een inactieve medewerker kan niet worden ingepland.",
          },
          { status: 400 },
        );
      }

      if (
        medewerker.vestigingen.length ===
        0
      ) {
        return NextResponse.json(
          {
            fout:
              "Deze medewerker hoort niet bij deze vestiging.",
          },
          { status: 400 },
        );
      }

      const bestaandeBezetting =
        await prisma.dienstBezetting.findFirst({
          where: {
            dienstId,
            medewerkerId,
          },
          select: {
            id: true,
          },
        });

      if (bestaandeBezetting) {
        return NextResponse.json(
          {
            fout:
              "Deze medewerker staat al op deze dienst.",
          },
          { status: 409 },
        );
      }
    }

    const bezetting =
      await prisma.dienstBezetting.create({
        data: {
          dienstId,
          medewerkerId:
            typeof medewerkerId ===
            "string"
              ? medewerkerId
              : null,
          status: gekozenStatus,
        },
        include: {
          medewerker: {
            select: {
              id: true,
              personeelsnummer: true,
              aanhef: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
            },
          },
        },
      });

    return NextResponse.json(
      bezetting,
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Fout bij toevoegen bezetting:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De bezetting kon niet worden toegevoegd.",
      },
      { status: 500 },
    );
  }
}