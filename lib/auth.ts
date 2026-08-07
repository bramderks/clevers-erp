import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function maakToken(payload: JWTPayload) {
  return await new SignJWT(payload)
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