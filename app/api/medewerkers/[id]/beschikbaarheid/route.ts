import { NextRequest, NextResponse } from "next/server";

import { beschikbaarheidService } from "@/lib/services/beschikbaarheid.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;

    const beschikbaarheden =
      await beschikbaarheidService.getByMedewerker(
        id,
      );

    return NextResponse.json(
      beschikbaarheden,
    );
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Er is een onbekende fout opgetreden.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;

    const body = await request.json();

    const beschikbaarheid =
      await beschikbaarheidService.create({
        weekId: body.weekId,
        medewerkerId: id,
        datum: new Date(body.datum),
        begintijd: new Date(body.begintijd),
        eindtijd: new Date(body.eindtijd),
        status:
          body.status ?? "BESCHIKBAAR",
        opmerking:
          body.opmerking ?? null,
      });

    return NextResponse.json(
      beschikbaarheid,
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Er is een onbekende fout opgetreden.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      },
    );
  }
}