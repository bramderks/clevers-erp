import { cookies } from "next/headers";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";

import { prisma } from "@/lib/prisma";
import { permissions } from "@/lib/permissions";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);

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
        rollen: {
          include: {
            rol: true,
          },
        },
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

export async function isSuperAdmin() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  return gebruiker.rollen.some(
    (r) => r.rol.naam === "Super Admin",
  );
}

export async function hasPermission(permission: string) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  if (
    gebruiker.rollen.some(
      (r) => r.rol.naam === "Super Admin",
    )
  ) {
    return true;
  }

  // Placeholder.
  // In de volgende stap koppelen we rollen automatisch
  // aan permissions via lib/roles.ts.
  return permission === permissions.dashboard.view;
}

export async function logout() {
  const cookieStore = await cookies();

  cookieStore.delete("token");
}