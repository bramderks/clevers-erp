import SidebarClient from "./SidebarClient";

import { getCurrentUser } from "@/lib/auth";
import { roles } from "@/lib/roles";

export default async function Sidebar() {
  const gebruiker =
    await getCurrentUser();

  const naam =
    gebruiker?.naam ?? "Gast";

  const actieveRelaties =
    gebruiker?.organisaties?.filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief,
    ) ?? [];

  const heeftSuperAdminRol = actieveRelaties.some(
    (relatie) => relatie.rol?.naam?.trim().toLowerCase() === "super admin",
  );
  const heeftEigenaarRol = actieveRelaties.some(
    (relatie) => relatie.rol?.naam?.trim().toLowerCase() === "eigenaar",
  );
  const relatie =
    actieveRelaties.find((relatie) =>
      ["super admin", "eigenaar"].includes(relatie.rol?.naam?.trim().toLowerCase() ?? ""),
    ) ?? actieveRelaties[0] ?? null;

  const rolNaam = heeftSuperAdminRol
    ? "Super Admin"
    : heeftEigenaarRol
      ? "Eigenaar"
      : relatie?.rol?.naam ?? "Gebruiker";

  const rolKey = (
    Object.keys(roles) as Array<
      keyof typeof roles
    >
  ).find(
    (key) =>
      roles[key].naam.toLowerCase() ===
      rolNaam.toLowerCase(),
  );

  // Super Admin heeft dezelfde volledige navigatierechten als Eigenaar,
  // onafhankelijk van de volgorde van organisatie-relaties.
  const gebruikersPermissions =
    heeftSuperAdminRol || heeftEigenaarRol
      ? Array.from(roles.eigenaar.permissions)
      : rolKey
        ? Array.from(roles[rolKey].permissions)
        : [];

  const isEigenaar = heeftEigenaarRol || heeftSuperAdminRol;

  const isTeamleider =
    actieveRelaties.some(
      (relatie) =>
        relatie.rol?.naam
          ?.toLowerCase() ===
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
      .map(
        (deel) =>
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