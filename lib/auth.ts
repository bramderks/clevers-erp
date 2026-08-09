import { cookies } from "next/headers";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";

import { prisma } from "@/lib/prisma";
import { roles } from "@/lib/roles";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET!,
);

export async function maakToken(payload: JWTPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({
      alg: "HS256",
    })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function controleerToken(token: string) {
  const { payload } = await jwtVerify(token, secret);

  return payload;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await controleerToken(token);

    if (!payload.sub) {
      return null;
    }

    return prisma.systeemGebruiker.findUnique({
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
    });
  } catch {
    return null;
  }
}

export async function isAuthenticated() {
  const gebruiker = await getCurrentUser();

  return gebruiker !== null;
}

export async function heeftRol(
  rolNaam: string,
  organisatieId?: string,
) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  return gebruiker.organisaties.some(
    (relatie) =>
      relatie.actief &&
      relatie.organisatie.actief &&
      (!organisatieId ||
        relatie.organisatieId === organisatieId) &&
      relatie.rol.naam.toLowerCase() === rolNaam.toLowerCase(),
  );
}

export async function isEigenaar(
  organisatieId?: string,
) {
  return heeftRol("Eigenaar", organisatieId);
}

export async function heeftOrganisatieToegang(
  organisatieId: string,
) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  return gebruiker.organisaties.some(
    (relatie) =>
      relatie.organisatieId === organisatieId &&
      relatie.actief &&
      relatie.organisatie.actief,
  );
}

export async function heeftVestigingToegang(
  vestigingId: string,
) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  const vestiging = await prisma.vestiging.findUnique({
    where: {
      id: vestigingId,
    },
    select: {
      organisatieId: true,
      actief: true,
    },
  });

  if (!vestiging?.actief) {
    return false;
  }

  const organisatieRelatie = gebruiker.organisaties.find(
    (relatie) =>
      relatie.organisatieId === vestiging.organisatieId &&
      relatie.actief &&
      relatie.organisatie.actief,
  );

  if (!organisatieRelatie) {
    return false;
  }

  if (
    organisatieRelatie.rol.naam.toLowerCase() ===
    "eigenaar"
  ) {
    return true;
  }

  return gebruiker.vestigingToegang.some(
    (toegang) =>
      toegang.vestigingId === vestigingId &&
      toegang.actief &&
      toegang.vestiging.actief &&
      toegang.vestiging.organisatieId ===
        vestiging.organisatieId,
  );
}

export async function heeftVestigingToegangBinnenOrganisatie(
  vestigingId: string,
  organisatieId: string,
) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  const organisatie = gebruiker.organisaties.find(
    (relatie) =>
      relatie.organisatieId === organisatieId &&
      relatie.actief &&
      relatie.organisatie.actief,
  );

  if (!organisatie) {
    return false;
  }

  if (
    organisatie.rol.naam.toLowerCase() ===
    "eigenaar"
  ) {
    return true;
  }

  return gebruiker.vestigingToegang.some(
    (toegang) =>
      toegang.vestigingId === vestigingId &&
      toegang.actief &&
      toegang.vestiging.actief &&
      toegang.vestiging.organisatieId ===
        organisatieId,
  );
}

export async function hasPermission(
  permission: string,
  organisatieId?: string,
) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  const relaties = gebruiker.organisaties.filter(
    (relatie) =>
      relatie.actief &&
      relatie.organisatie.actief &&
      (!organisatieId ||
        relatie.organisatieId === organisatieId),
  );

  return relaties.some((relatie) => {
    const rolDefinitie = Object.values(roles).find(
      (rol) =>
        rol.naam.toLowerCase() ===
        relatie.rol.naam.toLowerCase(),
    );

    if (!rolDefinitie) {
      return false;
    }

    return rolDefinitie.permissions.some(
      (toegestanePermission) =>
        toegestanePermission === permission,
    );
  });
}

export async function hasPermissionForVestiging(
  permission: string,
  vestigingId: string,
) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  const vestiging = await prisma.vestiging.findUnique({
    where: {
      id: vestigingId,
    },
    select: {
      organisatieId: true,
      actief: true,
    },
  });

  if (!vestiging?.actief) {
    return false;
  }

  const organisatieRelatie = gebruiker.organisaties.find(
    (relatie) =>
      relatie.organisatieId === vestiging.organisatieId &&
      relatie.actief &&
      relatie.organisatie.actief,
  );

  if (!organisatieRelatie) {
    return false;
  }

  const rolDefinitie = Object.values(roles).find(
    (rol) =>
      rol.naam.toLowerCase() ===
      organisatieRelatie.rol.naam.toLowerCase(),
  );

  if (!rolDefinitie) {
    return false;
  }

  const heeftPermission = rolDefinitie.permissions.some(
    (toegestanePermission) =>
      toegestanePermission === permission,
  );

  if (!heeftPermission) {
    return false;
  }

  if (
    organisatieRelatie.rol.naam.toLowerCase() ===
    "eigenaar"
  ) {
    return true;
  }

  return gebruiker.vestigingToegang.some(
    (toegang) =>
      toegang.vestigingId === vestigingId &&
      toegang.actief &&
      toegang.vestiging.actief &&
      toegang.vestiging.organisatieId ===
        vestiging.organisatieId,
  );
}

export async function logout() {
  const cookieStore = await cookies();

  cookieStore.delete("token");
}