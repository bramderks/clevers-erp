import { del, get, put } from "@vercel/blob";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "https://github.com/bramderks/clevers-erp";
const REPOSITORY = "bramderks/clevers-erp";
const REPOSITORY_ID = "1325101992";
const BRANCH = "refs/heads/main";

const JWKS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

async function geautoriseerd(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  try {
    const token = authorization.slice("Bearer ".length).trim();
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    return (
      payload.repository === REPOSITORY &&
      payload.repository_id === REPOSITORY_ID &&
      payload.ref === BRANCH &&
      (payload.event_name === "schedule" ||
        payload.event_name === "workflow_dispatch")
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!(await geautoriseerd(request))) {
    return NextResponse.json({ ok: false, fout: "Niet geautoriseerd." }, { status: 401 });
  }

  const pathname = `diagnostics/private-blob-${Date.now()}.txt`;

  try {
    const uploaded = await put(pathname, "clevers-private-blob-check", {
      access: "private",
      addRandomSuffix: false,
      contentType: "text/plain",
    });

    try {
      const result = await get(uploaded.pathname, { access: "private" });

      if (!result || result.statusCode !== 200 || !result.stream) {
        throw new Error("Private Blob GET gaf geen geldig resultaat terug.");
      }

      return NextResponse.json({
        ok: true,
        privateBlobWrite: true,
        privateBlobRead: true,
        pathname: uploaded.pathname,
      });
    } finally {
      await del(uploaded.pathname);
    }
  } catch (error) {
    try {
      await del(pathname);
    } catch {
      // Best effort cleanup only.
    }

    console.error("Private Blob write/read diagnostic mislukt:", error);

    return NextResponse.json(
      {
        ok: false,
        privateBlobWrite: false,
        privateBlobRead: false,
        fout: "Private Blob private write/read is niet volledig beschikbaar.",
      },
      { status: 500 },
    );
  }
}
