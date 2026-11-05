import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_ROUTES = [
  "/login",
  "/api/login",
  "/api/logout",
  "/account/activeren",
  "/api/account/activeren",
  // Server-to-server endpoint: its own integration-secret check is the authentication layer.
  "/api/integraties/bestellen/auth",
  "/_next",
  "/favicon.ico",
  "/logo.png",
  "/ijs-logo-transparent.png",
  "/sw.js",
  "/manifest.webmanifest",


];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (isPublic) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const secret = process.env.AUTH_SECRET?.trim();
    if (!secret) throw new Error("AUTH_SECRET ontbreekt");
    const key = new TextEncoder().encode(secret);
    const { payload: sessie } = await jwtVerify(token, key);
    if (!sessie.sub) throw new Error("Ongeldige sessie");

    // De heartbeat controleert zelf beide tokens en verlengt de activiteitssessie.
    if (pathname === "/api/session/activity") return NextResponse.next();

    const activiteit = request.cookies.get("activity")?.value;
    if (!activiteit) throw new Error("Activiteitssessie ontbreekt");
    const { payload } = await jwtVerify(activiteit, key);
    if (payload.sub !== sessie.sub || payload.type !== "activity") {
      throw new Error("Activiteitssessie ongeldig");
    }
  } catch {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ message: "Sessie verlopen. Log opnieuw in." }, { status: 401 })
      : NextResponse.redirect(new URL("/login?reason=timeout", request.url));
    response.cookies.delete("token");
    response.cookies.delete("activity");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/login|_next/static|_next/image|favicon.ico|logo.png|ijs-logo-transparent.png|sw.js|manifest.webmanifest).*)",
  ],
};
