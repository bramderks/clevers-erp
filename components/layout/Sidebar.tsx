import SidebarClient from "./SidebarClient";

import { getCurrentUser } from "@/lib/auth";
import { roles } from "@/lib/roles";

export default async function Sidebar() {
  const gebruiker = await getCurrentUser();

  const naam = gebruiker?.naam ?? "Gast";

  const actieveRelaties =
    gebruiker?.organisaties.filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief,
    ) ?? [];

  const relatie =
    actieveRelaties[0] ?? null;

  const rolNaam =
    relatie?.rol.naam ?? "Gebruiker";

  const rolKey = (
    Object.keys(roles) as Array<
      keyof typeof roles
    >
  ).find(
    (key) =>
      roles[key].naam.toLowerCase() ===
      rolNaam.toLowerCase(),
  );

  const gebruikersPermissions = rolKey
    ? Array.from(
        roles[rolKey].permissions,
      )
    : [];

  const isEigenaar =
    actieveRelaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "eigenaar",
    );

  const isTeamleider =
    actieveRelaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "teamleider",
    );

  const isMedewerker =
    gebruiker?.medewerker != null;

  const initialen =
    naam
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((deel) =>
        deel.charAt(0).toUpperCase(),
      )
      .join("") || "G";

  return (
    <SidebarClient
      naam={naam}
      rol={rolNaam}
      initialen={initialen}
      permissions={
        gebruikersPermissions
      }
      isEigenaar={isEigenaar}
      isTeamleider={isTeamleider}
      isMedewerker={isMedewerker}
    />
  );
}