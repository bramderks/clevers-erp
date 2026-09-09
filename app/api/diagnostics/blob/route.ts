import { list } from "@vercel/blob";
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

  try {
    const resultaat = await list({ limit: 1 });

    return NextResponse.json({
      ok: true,
      blobBereikbaar: true,
      aantalGelezen: resultaat.blobs.length,
    });
  } catch (error) {
    console.error("Private Blob diagnostic mislukt:", error);

    return NextResponse.json(
      {
        ok: false,
        blobBereikbaar: false,
        fout: "Private Blob is niet bereikbaar vanuit productie.",
      },
      { status: 500 },
    );
  }
}
