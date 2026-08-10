import SidebarClient from "./SidebarClient";

import { getCurrentUser } from "@/lib/auth";
import { roles } from "@/lib/roles";

export default async function Sidebar() {
  const gebruiker = await getCurrentUser();

  const naam = gebruiker?.naam ?? "Gast";

  const relatie = gebruiker?.organisaties[0];

  const rolNaam =
    relatie?.rol.naam ?? "Gebruiker";

  const rolKey = (
    Object.keys(roles) as Array<keyof typeof roles>
  ).find(
    (key) =>
      roles[key].naam === rolNaam,
  );

  const gebruikersPermissions = rolKey
    ? Array.from(roles[rolKey].permissions)
    : [];

  const isEigenaar =
    rolKey === "eigenaar";

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
    />
  );
}