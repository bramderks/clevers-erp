"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import Form from "@/components/form/Form";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";
import FormCheckbox from "@/components/form/FormCheckbox";
import Button from "@/components/ui/Button";

import type { MedewerkerAanmeldenDto } from "../dto/medewerker-aanmelden.dto";
import { medewerkerAanmeldenValidator } from "../validator/medewerker-aanmelden.validator";

const AANHEFFEN = [
  {
    value: "DHR",
    label: "De heer",
  },
  {
    value: "MEVR",
    label: "Mevrouw",
  },
  {
    value: "ANDERS",
    label: "Anders",
  },
  {
    value: "GEEN_OPGAVE",
    label: "Wil ik niet opgeven",
  },
] as const;

export default function AanmeldForm() {
  const router = useRouter();

  const form = useForm<MedewerkerAanmeldenDto>({
    resolver: zodResolver(medewerkerAanmeldenValidator),
    defaultValues: {
      aanhef: "DHR",

      voornaam: "",
      tussenvoegsel: "",
      achternaam: "",
      roepnaam: "",

      geboortedatum: "",

      email: "",
      telefoon: "",

      wachtwoord: "",
      wachtwoordBevestiging: "",

      privacyAkkoord: false,
    },
  });

  async function onSubmit(data: MedewerkerAanmeldenDto) {
    try {
      const response = await fetch("/api/aanmelden", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const resultaat = await response.json();

      if (!response.ok) {
        alert(resultaat.error ?? "Er is een fout opgetreden.");
        return;
      }

      form.reset();

      router.push("/aanmelden/succes");
    } catch {
      alert("Er is een onverwachte fout opgetreden.");
    }
  }

  return (
    <Form
      form={form}
      onSubmit={onSubmit}
    >
      <FormSelect
        name="aanhef"
        label="Aanhef"
        options={AANHEFFEN.map((item) => ({
          value: item.value,
          label: item.label,
        }))}
        required
      />

      <FormInput
        name="voornaam"
        label="Voornaam"
        required
      />

      <FormInput
        name="tussenvoegsel"
        label="Tussenvoegsel"
      />

      <FormInput
        name="achternaam"
        label="Achternaam"
        required
      />

      <FormInput
        name="roepnaam"
        label="Roepnaam"
      />

      <FormInput
        name="geboortedatum"
        label="Geboortedatum"
        type="date"
        required
      />

      <FormInput
        name="email"
        label="E-mailadres"
        type="email"
        required
      />

      <FormInput
        name="telefoon"
        label="Telefoonnummer"
        type="tel"
        required
      />

      <FormInput
        name="wachtwoord"
        label="Wachtwoord"
        type="password"
        required
      />

      <FormInput
        name="wachtwoordBevestiging"
        label="Herhaal wachtwoord"
        type="password"
        required
      />

      <FormCheckbox
        name="privacyAkkoord"
        label="Ik ga akkoord met de privacyverklaring."
        required
      />

      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? "Aanmelden..."
            : "Aanmelden"}
        </Button>
      </div>
    </Form>
  );
}