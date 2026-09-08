import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function AppProfielPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/profiel");
  }

  if (!gebruiker.medewerker?.id) {
    redirect("/app");
  }

  redirect("/profiel");
}
