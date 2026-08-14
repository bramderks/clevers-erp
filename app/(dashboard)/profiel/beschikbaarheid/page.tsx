import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function MijnBeschikbaarheidPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login");
  }

  if (!gebruiker.medewerker?.id) {
    redirect("/profiel");
  }

  redirect(
    `/medewerkers/${gebruiker.medewerker.id}/beschikbaarheid`,
  );
}