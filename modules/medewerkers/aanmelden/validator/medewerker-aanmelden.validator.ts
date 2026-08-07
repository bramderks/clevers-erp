import { z } from "zod";

export const medewerkerAanmeldenValidator = z
  .object({
    aanhef: z.enum([
      "DHR",
      "MEVR",
      "ANDERS",
      "GEEN_OPGAVE",
    ]),

    voornaam: z
      .string()
      .trim()
      .min(2, "Voornaam is verplicht.")
      .max(100),

    tussenvoegsel: z
      .string()
      .trim()
      .max(25)
      .optional()
      .or(z.literal("")),

    achternaam: z
      .string()
      .trim()
      .min(2, "Achternaam is verplicht.")
      .max(100),

    roepnaam: z
      .string()
      .trim()
      .max(100)
      .optional()
      .or(z.literal("")),

    geboortedatum: z
      .string()
      .min(1, "Geboortedatum is verplicht.")
      .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        {
          message: "Ongeldige geboortedatum.",
        },
      ),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Ongeldig e-mailadres."),

    telefoon: z
      .string()
      .trim()
      .min(10, "Telefoonnummer is verplicht.")
      .max(25),

    wachtwoord: z
      .string()
      .min(8, "Wachtwoord moet minimaal 8 tekens bevatten.")
      .max(100),

    wachtwoordBevestiging: z.string(),

    privacyAkkoord: z.boolean().refine(
      (value) => value === true,
      {
        message: "Je moet akkoord gaan met de privacyverklaring.",
      },
    ),
  })
  .refine(
    (data) => data.wachtwoord === data.wachtwoordBevestiging,
    {
      path: ["wachtwoordBevestiging"],
      message: "De wachtwoorden komen niet overeen.",
    },
  );

export type MedewerkerAanmeldenInput = z.infer<
  typeof medewerkerAanmeldenValidator
>;