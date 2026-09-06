import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function MedewerkerAppBeschikbaarheidPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/beschikbaarheid");
  }

  if (!gebruiker.medewerker?.id) {
    redirect("/dashboard");
  }

  redirect(
    `/medewerkers/${encodeURIComponent(
      gebruiker.medewerker.id,
    )}/beschikbaarheid?app=1`,
  );
}
