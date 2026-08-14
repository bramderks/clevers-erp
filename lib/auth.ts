import { cookies } from "next/headers";
import {
  jwtVerify,
  SignJWT,
  type JWTPayload,
} from "jose";

import { prisma } from "@/lib/prisma";
import { roles } from "@/lib/roles";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET!,
);

/*
 * ============================================================
 * TOKEN
 * ============================================================
 */

export async function maakToken(
  payload: JWTPayload,
) {
  return new SignJWT(payload)
    .setProtectedHeader({
      alg: "HS256",
    })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function controleerToken(
  token: string,
) {
  const { payload } =
    await jwtVerify(
      token,
      secret,
    );

  return payload;
}

/*
 * ============================================================
 * HUIDIGE GEBRUIKER
 * ============================================================
 */

export async function getCurrentUser() {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get("token")?.value;

  if (!token) {
    return null;
  }

  try {
    const payload =
      await controleerToken(token);

    if (!payload.sub) {
      return null;
    }

    return prisma.systeemGebruiker.findUnique(
      {
        where: {
          id: payload.sub as string,
        },

        include: {
          organisaties: {
            include: {
              organisatie: true,
              rol: true,
            },
          },

          vestigingToegang: {
            include: {
              vestiging: true,
            },
          },

          medewerker: true,
        },
      },
    );
  } catch {
    return null;
  }
}

export async function isAuthenticated() {
  const gebruiker =
    await getCurrentUser();

  return gebruiker !== null;
}

/*
 * ============================================================
 * ORGANISATIE
 * ============================================================
 */

export async function heeftRol(
  rolNaam: string,
  organisatieId?: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  return gebruiker.organisaties.some(
    (relatie) =>
      relatie.actief &&
      relatie.organisatie.actief &&
      (!organisatieId ||
        relatie.organisatieId ===
          organisatieId) &&
      relatie.rol.naam.toLowerCase() ===
        rolNaam.toLowerCase(),
  );
}

export async function isEigenaar(
  organisatieId?: string,
) {
  return heeftRol(
    "Eigenaar",
    organisatieId,
  );
}

export async function heeftOrganisatieToegang(
  organisatieId: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  return gebruiker.organisaties.some(
    (relatie) =>
      relatie.organisatieId ===
        organisatieId &&
      relatie.actief &&
      relatie.organisatie.actief,
  );
}

/*
 * ============================================================
 * HULPFUNCTIES VESTIGING
 * ============================================================
 */

async function haalVestiging(
  vestigingId: string,
) {
  return prisma.vestiging.findUnique({
    where: {
      id: vestigingId,
    },
    select: {
      id: true,
      organisatieId: true,
      actief: true,
    },
  });
}

function heeftActieveOrganisatieRelatie(
  gebruiker: Awaited<
    ReturnType<typeof getCurrentUser>
  >,
  organisatieId: string,
) {
  if (!gebruiker) {
    return false;
  }

  return gebruiker.organisaties.some(
    (relatie) =>
      relatie.organisatieId ===
        organisatieId &&
      relatie.actief &&
      relatie.organisatie.actief,
  );
}

function isEigenaarVanOrganisatie(
  gebruiker: Awaited<
    ReturnType<typeof getCurrentUser>
  >,
  organisatieId: string,
) {
  if (!gebruiker) {
    return false;
  }

  return gebruiker.organisaties.some(
    (relatie) =>
      relatie.organisatieId ===
        organisatieId &&
      relatie.actief &&
      relatie.organisatie.actief &&
      relatie.rol.naam.toLowerCase() ===
        "eigenaar",
  );
}

function heeftExplicieteVestigingToegang(
  gebruiker: Awaited<
    ReturnType<typeof getCurrentUser>
  >,
  vestigingId: string,
  organisatieId: string,
) {
  if (!gebruiker) {
    return false;
  }

  return gebruiker.vestigingToegang.some(
    (toegang) =>
      toegang.vestigingId ===
        vestigingId &&
      toegang.actief &&
      toegang.vestiging.actief &&
      toegang.vestiging.organisatieId ===
        organisatieId,
  );
}

async function heeftMedewerkerVestiging(
  gebruiker: Awaited<
    ReturnType<typeof getCurrentUser>
  >,
  vestigingId: string,
  organisatieId: string,
) {
  if (
    !gebruiker?.medewerker?.id
  ) {
    return false;
  }

  const medewerker =
    await prisma.medewerker.findUnique(
      {
        where: {
          id: gebruiker.medewerker.id,
        },

        select: {
          id: true,
          actief: true,

          vestigingen: {
            where: {
              vestigingId,
            },

            select: {
              vestigingId: true,

              vestiging: {
                select: {
                  organisatieId: true,
                  actief: true,
                },
              },
            },
          },
        },
      },
    );

  if (!medewerker?.actief) {
    return false;
  }

  return medewerker.vestigingen.some(
    (relatie) =>
      relatie.vestigingId ===
        vestigingId &&
      relatie.vestiging.actief &&
      relatie.vestiging.organisatieId ===
        organisatieId,
  );
}

/*
 * ============================================================
 * VESTIGINGSTOEGANG
 * ============================================================
 *
 * Eigenaar:
 *   organisatiebreed.
 *
 * Medewerker / teamleider:
 *   toegang via medewerker.vestigingen.
 *
 * Overige gebruikers:
 *   toegang via vestigingToegang.
 */

export async function heeftVestigingToegang(
  vestigingId: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  const vestiging =
    await haalVestiging(
      vestigingId,
    );

  if (!vestiging?.actief) {
    return false;
  }

  if (
    !heeftActieveOrganisatieRelatie(
      gebruiker,
      vestiging.organisatieId,
    )
  ) {
    return false;
  }

  if (
    isEigenaarVanOrganisatie(
      gebruiker,
      vestiging.organisatieId,
    )
  ) {
    return true;
  }

  if (
    await heeftMedewerkerVestiging(
      gebruiker,
      vestigingId,
      vestiging.organisatieId,
    )
  ) {
    return true;
  }

  return heeftExplicieteVestigingToegang(
    gebruiker,
    vestigingId,
    vestiging.organisatieId,
  );
}

/*
 * ============================================================
 * VESTIGING BINNEN ORGANISATIE
 * ============================================================
 */

export async function heeftVestigingToegangBinnenOrganisatie(
  vestigingId: string,
  organisatieId: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  const vestiging =
    await haalVestiging(
      vestigingId,
    );

  if (
    !vestiging?.actief ||
    vestiging.organisatieId !==
      organisatieId
  ) {
    return false;
  }

  if (
    !heeftActieveOrganisatieRelatie(
      gebruiker,
      organisatieId,
    )
  ) {
    return false;
  }

  if (
    isEigenaarVanOrganisatie(
      gebruiker,
      organisatieId,
    )
  ) {
    return true;
  }

  if (
    await heeftMedewerkerVestiging(
      gebruiker,
      vestigingId,
      organisatieId,
    )
  ) {
    return true;
  }

  return heeftExplicieteVestigingToegang(
    gebruiker,
    vestigingId,
    organisatieId,
  );
}

/*
 * ============================================================
 * ALGEMENE PERMISSION
 * ============================================================
 */

export async function hasPermission(
  permission: string,
  organisatieId?: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  const relaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        (!organisatieId ||
          relatie.organisatieId ===
            organisatieId),
    );

  return relaties.some(
    (relatie) => {
      const rolDefinitie =
        Object.values(
          roles,
        ).find(
          (rol) =>
            rol.naam.toLowerCase() ===
            relatie.rol.naam.toLowerCase(),
        );

      if (!rolDefinitie) {
        return false;
      }

      return rolDefinitie.permissions.some(
        (toegestanePermission) =>
          toegestanePermission ===
          permission,
      );
    },
  );
}

/*
 * ============================================================
 * PERMISSION + VESTIGING
 * ============================================================
 *
 * Centrale controle voor bijvoorbeeld:
 *
 * GET    /api/planning
 * POST   /api/planning
 * PATCH  /api/planning/...
 * DELETE /api/planning/...
 *
 * Controle:
 *
 * 1. gebruiker ingelogd
 * 2. vestiging bestaat en is actief
 * 3. organisatiekoppeling is actief
 * 4. rol heeft de permission
 * 5. gebruiker heeft toegang tot de vestiging
 */

export async function hasPermissionForVestiging(
  permission: string,
  vestigingId: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  const vestiging =
    await haalVestiging(
      vestigingId,
    );

  if (!vestiging?.actief) {
    return false;
  }

  const organisatieRelaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.organisatieId ===
          vestiging.organisatieId &&
        relatie.actief &&
        relatie.organisatie.actief,
    );

  if (
    organisatieRelaties.length === 0
  ) {
    return false;
  }

  /*
   * De gebruiker moet via ten minste één
   * actieve rol de permission hebben.
   */

  const heeftPermission =
    organisatieRelaties.some(
      (relatie) => {
        const rolDefinitie =
          Object.values(
            roles,
          ).find(
            (rol) =>
              rol.naam.toLowerCase() ===
              relatie.rol.naam.toLowerCase(),
          );

        if (!rolDefinitie) {
          return false;
        }

        return rolDefinitie.permissions.some(
          (toegestanePermission) =>
            toegestanePermission ===
            permission,
        );
      },
    );

  if (!heeftPermission) {
    return false;
  }

  /*
   * Eigenaar is organisatiebreed.
   */

  if (
    organisatieRelaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "eigenaar",
    )
  ) {
    return true;
  }

  /*
   * Medewerker / teamleider met een
   * medewerkerrecord:
   *
   * toegang via de daadwerkelijke
   * vestigingskoppeling.
   */

  if (
    await heeftMedewerkerVestiging(
      gebruiker,
      vestigingId,
      vestiging.organisatieId,
    )
  ) {
    return true;
  }

  /*
   * Expliciete vestigingToegang blijft
   * beschikbaar als fallback voor
   * gebruikers die niet via een
   * medewerkerrecord gekoppeld zijn.
   */

  return heeftExplicieteVestigingToegang(
    gebruiker,
    vestigingId,
    vestiging.organisatieId,
  );
}

/*
 * ============================================================
 * LOGOUT
 * ============================================================
 */

export async function logout() {
  const cookieStore =
    await cookies();

  cookieStore.delete("token");
}