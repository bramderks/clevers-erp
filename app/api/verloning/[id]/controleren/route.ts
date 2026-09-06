import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          fout: "Je bent niet ingelogd.",
        },
        {
          status: 401,
        },
      );
    }

    const medewerkerId =
      gebruiker.medewerker?.id;

    if (!medewerkerId) {
      return NextResponse.json(
        {
          fout: "Alleen een medewerker kan zijn eigen verloning controleren.",
        },
        {
          status: 403,
        },
      );
    }

    const { id: periodeId } =
      await params;

    const periode =
      await prisma.verloningsPeriode.findUnique({
        where: {
          id: periodeId,
        },
        select: {
          id: true,
          status: true,
          controleStart: true,
          controleDeadline: true,
          controles: {
            where: {
              medewerkerId,
            },
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

    if (!periode) {
      return NextResponse.json(
        {
          fout: "De verloningsperiode bestaat niet.",
        },
        {
          status: 404,
        },
      );
    }

    const controle =
      periode.controles[0];

    if (!controle) {
      return NextResponse.json(
        {
          fout: "Je maakt geen deel uit van deze verloningsperiode.",
        },
        {
          status: 403,
        },
      );
    }

    if (periode.status !== "KLAAR") {
      return NextResponse.json(
        {
          fout: "Deze verloningsperiode staat niet open voor controle.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !periode.controleStart ||
      !periode.controleDeadline
    ) {
      return NextResponse.json(
        {
          fout: "Voor deze verloningsperiode is geen geldige controleperiode ingesteld.",
        },
        {
          status: 400,
        },
      );
    }

    const nu = new Date();

    if (
      nu < periode.controleStart ||
      nu > periode.controleDeadline
    ) {
      return NextResponse.json(
        {
          fout: "De controleperiode is niet geopend of inmiddels verlopen.",
        },
        {
          status: 400,
        },
      );
    }

    if (controle.status !== "OPEN") {
      return NextResponse.json({
        succes: true,
        status: controle.status,
      });
    }

    const bijgewerkteControle =
      await prisma.verloningsControle.update({
        where: {
          id: controle.id,
        },
        data: {
          status: "AKKOORD",
          gecontroleerdOp: nu,
          automatischAkkoordOp: null,
        },
        select: {
          id: true,
          status: true,
          gecontroleerdOp: true,
        },
      });

    return NextResponse.json({
      succes: true,
      controle: bijgewerkteControle,
    });
  } catch (error) {
    console.error(
      "Fout bij controleren eigen verloning:",
      error,
    );

    return NextResponse.json(
      {
        fout: "De verloning kon niet worden gecontroleerd.",
      },
      {
        status: 500,
      },
    );
  }
}
