import { redirect } from "next/navigation";

import {
  getCurrentUser,
  hasPermission,
  isEigenaar,
} from "@/lib/auth";

export async function vereisInloggen() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login");
  }

  return gebruiker;
}

export async function vereisPermission(
  permission: string,
  organisatieId?: string,
) {
  const gebruiker =
    await vereisInloggen();

  const toegestaan =
    await hasPermission(
      permission,
      organisatieId,
    );

  if (!toegestaan) {
    redirect("/dashboard");
  }

  return gebruiker;
}

export async function vereisEigenaar() {
  const gebruiker =
    await vereisInloggen();

  const eigenaar =
    await isEigenaar();

  if (!eigenaar) {
    redirect("/dashboard");
  }

  return gebruiker;
}