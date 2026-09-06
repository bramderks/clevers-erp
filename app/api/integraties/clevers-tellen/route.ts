import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

interface ExterneTellingRegel {
  productNaam: string;
  geteld: number;
  buffer?: number;
  besteld?: number;
}

interface ExterneTellingRequest {
  synchronisatieId: string;
  datum: string;
  vestigingCode: string;
  medewerker: string;
  opmerking?: string;
  regels: ExterneTellingRegel[];
}

function veiligeVergelijking(
  ontvangen: string | null,
  verwacht: string,
): boolean {
  if (!ontvangen) {
    return false;
  }

  const ontvangenBuffer = Buffer.from(ontvangen);
  const verwachtBuffer = Buffer.from(verwacht);

  if (ontvangenBuffer.length !== verwachtBuffer.length) {
    return false;
  }

  return timingSafeEqual(ontvangenBuffer, verwachtBuffer);
}

function isGeldigGetal(waarde: unknown): waarde is number {
  return (
    typeof waarde === "number" &&
    Number.isFinite(waarde) &&
    waarde >= 0
  );
}

function normaliseerNaam(waarde: string): string {
  return waarde.trim().replace(/\s+/g, " ").toLocaleLowerCase("nl-NL");
}

function valideer(
  body: ExterneTellingRequest,
): string | null {
  if (!body.synchronisatieId?.trim()) {
    return "synchronisatieId ontbreekt.";
  }

  if (!body.vestigingCode?.trim()) {
    return "vestigingCode ontbreekt.";
  }

  if (!body.medewerker?.trim()) {
    return "medewerker ontbreekt.";
  }

  if (
    !body.datum ||
    Number.isNaN(new Date(body.datum).getTime())
  ) {
    return "Ongeldige datum.";
  }

  if (
    !Array.isArray(body.regels) ||
    body.regels.length === 0
  ) {
    return "Geen telregels ontvangen.";
  }

  const productNamen = new Set<string>();

  for (const regel of body.regels) {
    if (!regel.productNaam?.trim()) {
      return "Een productnaam ontbreekt.";
    }

    if (!isGeldigGetal(regel.geteld)) {
      return `Ongeldig geteld aantal voor ${regel.productNaam}.`;
    }

    if (
      regel.buffer !== undefined &&
      !isGeldigGetal(regel.buffer)
    ) {
      return `Ongeldige buffer voor ${regel.productNaam}.`;
    }

    if (
      regel.besteld !== undefined &&
      !isGeldigGetal(regel.besteld)
    ) {
      return `Ongeldige bestelhoeveelheid voor ${regel.productNaam}.`;
    }

    const productNaam = normaliseerNaam(regel.productNaam);

    if (productNamen.has(productNaam)) {
      return `Product ${regel.productNaam} komt meerdere keren voor.`;
    }

    productNamen.add(productNaam);
  }

  return null;
}

export async function POST(request: Request) {
  const geheim =
    process.env.CLEVERS_TELLING_SYNC_SECRET;

  if (!geheim) {
    console.error(
      "CLEVERS_TELLING_SYNC_SECRET ontbreekt voor externe tellingen.",
    );

    return NextResponse.json(
      {
        fout: "Externe tellingkoppeling is niet geconfigureerd.",
      },
      {
        status: 503,
      },
    );
  }

  const ontvangenToken =
    request.headers.get("authorization")?.replace(
      /^Bearer\s+/i,
      "",
    ) ?? null;

  if (
    !veiligeVergelijking(
      ontvangenToken,
      geheim,
    )
  ) {
    return NextResponse.json(
      {
        fout: "Niet geautoriseerd.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const body =
      (await request.json()) as ExterneTellingRequest;

    const validatieFout = valideer(body);

    if (validatieFout) {
      return NextResponse.json(
        {
          fout: validatieFout,
        },
        {
          status: 400,
        },
      );
    }

    const synchronisatieMarker =
      `[CLEVERSTEL:${body.synchronisatieId.trim()}]`;

    const bestaandeTelling =
      await prisma.voorraadTelling.findFirst({
        where: {
          opmerkingen: {
            startsWith: synchronisatieMarker,
          },
        },
        select: {
          id: true,
        },
      });

    if (bestaandeTelling) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        tellingId: bestaandeTelling.id,
      });
    }

    const vestigingCode =
      body.vestigingCode.trim().toUpperCase();

    const vestigingen =
      await prisma.vestiging.findMany({
        where: {
          actief: true,
          OR: [
            {
              code: {
                equals: vestigingCode,
                mode: "insensitive",
              },
            },
            {
              naam: {
                equals: body.vestigingCode.trim(),
                mode: "insensitive",
              },
            },
          ],
        },
        select: {
          id: true,
          code: true,
          naam: true,
        },
      });

    if (vestigingen.length !== 1) {
      return NextResponse.json(
        {
          fout:
            "Vestiging kon niet eenduidig worden gekoppeld.",
        },
        {
          status: 422,
        },
      );
    }

    const vestiging = vestigingen[0];

    const producten =
      await prisma.vestigingProduct.findMany({
        where: {
          vestigingId: vestiging.id,
          actief: true,
          product: {
            actief: true,
          },
        },
        select: {
          product: {
            select: {
              id: true,
              naam: true,
            },
          },
        },
      });

    const productenPerNaam =
      new Map<string, string[]>();

    for (const item of producten) {
      const sleutel =
        normaliseerNaam(item.product.naam);

      const bestaande =
        productenPerNaam.get(sleutel) ?? [];

      bestaande.push(item.product.id);
      productenPerNaam.set(
        sleutel,
        bestaande,
      );
    }

    const gekoppeldeRegels = body.regels.map(
      (regel) => {
        const matches =
          productenPerNaam.get(
            normaliseerNaam(regel.productNaam),
          ) ?? [];

        if (matches.length !== 1) {
          throw new Error(
            `Product kon niet eenduidig worden gekoppeld: ${regel.productNaam}.`,
          );
        }

        return {
          productId: matches[0],
          geteld: regel.geteld,
          advies: regel.buffer ?? null,
          bestelling: regel.besteld ?? null,
        };
      },
    );

    const status =
      await prisma.status.findUnique({
        where: {
          module_code: {
            module: "VOORRAAD",
            code: "AFGEROND",
          },
        },
        select: {
          id: true,
        },
      });

    if (!status) {
      throw new Error(
        "Voorraadstatus AFGEROND ontbreekt in de ERP.",
      );
    }

    const opmerkingen = [
      synchronisatieMarker,
      `Bron: Clevers tel-app`,
      `Medewerker: ${body.medewerker.trim()}`,
      body.opmerking?.trim(),
    ]
      .filter(
        (waarde): waarde is string =>
          Boolean(waarde),
      )
      .join("\n");

    const telling =
      await prisma.voorraadTelling.create({
        data: {
          vestigingId: vestiging.id,
          teldatum: new Date(body.datum),
          statusId: status.id,
          opmerkingen,
          regels: {
            create: gekoppeldeRegels,
          },
        },
        select: {
          id: true,
        },
      });

    await prisma.auditLog.create({
      data: {
        module: "VOORRAAD",
        actie: "EXTERNE_TELLING_GESYNCHRONISEERD",
        recordId: telling.id,
        details: {
          bron: "clevers-bestellen",
          synchronisatieId:
            body.synchronisatieId.trim(),
          vestigingCode: vestiging.code,
          medewerker:
            body.medewerker.trim(),
          aantalRegels:
            gekoppeldeRegels.length,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        tellingId: telling.id,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Externe voorraad telling synchroniseren mislukt:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          error instanceof Error
            ? error.message
            : "De externe telling kon niet worden verwerkt.",
      },
      {
        status: 500,
      },
    );
  }
}
