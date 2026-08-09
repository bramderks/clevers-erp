import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

import type { MedewerkerAanmeldenDto } from "../dto/medewerker-aanmelden.dto";
import { medewerkerAanmeldenValidator } from "../validator/medewerker-aanmelden.validator";
import {
  bestaatEmail,
  medewerkerAanmaken,
} from "../repository/medewerker-aanmelden.repository";

export async function medewerkerAanmelden(
  dto: MedewerkerAanmeldenDto,
) {
  const gegevens =
    medewerkerAanmeldenValidator.parse(dto);

  const emailBestaat =
    await bestaatEmail(gegevens.email);

  if (emailBestaat) {
    throw new Error(
      "Er bestaat al een medewerker met dit e-mailadres.",
    );
  }

  const status =
    await prisma.status.findUnique({
      where: {
        module_code: {
          module: "MEDEWERKER",
          code: "AANGEMELD",
        },
      },
    });

  if (!status) {
    throw new Error(
      "Status 'AANGEMELD' is niet gevonden. Controleer de database-seed.",
    );
  }

  const wachtwoordHash =
    await bcrypt.hash(
      gegevens.wachtwoord,
      12,
    );

  const naam = [
    gegevens.voornaam,
    gegevens.tussenvoegsel,
    gegevens.achternaam,
  ]
    .filter(Boolean)
    .join(" ");

  const medewerker =
    await medewerkerAanmaken({
      aanhef: gegevens.aanhef,
      voornaam: gegevens.voornaam,
      tussenvoegsel:
        gegevens.tussenvoegsel || null,
      achternaam: gegevens.achternaam,
      roepnaam:
        gegevens.roepnaam || null,
      geboortedatum: new Date(
        gegevens.geboortedatum,
      ),
      email: gegevens.email,
      telefoon: gegevens.telefoon,
      actief: false,

      status: {
        connect: {
          id: status.id,
        },
      },

      systeemGebruiker: {
        create: {
          naam,
          email: gegevens.email,
          wachtwoordHash,
          actief: false,
        },
      },
    });

  return {
    id: medewerker.id,
    status: medewerker.status.code,
    melding:
      "Je aanmelding is succesvol ontvangen. Na goedkeuring door een beheerder ontvang je een e-mail.",
  };
}