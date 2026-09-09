import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { verstuurDienstHerinneringen } from "@/lib/push/dienst-herinneringen";

export const dynamic = "force-dynamic";

const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_AUDIENCE = "https://github.com/bramderks/clevers-erp";
const GITHUB_REPOSITORY = "bramderks/clevers-erp";
const GITHUB_REPOSITORY_ID = "1325101992";
const GITHUB_BRANCH = "refs/heads/main";

const GITHUB_JWKS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

async function geautoriseerd(request: NextRequest) {
  const legacySecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (legacySecret && authorization === `Bearer ${legacySecret}`) {
    return true;
  }

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, GITHUB_JWKS, {
      issuer: GITHUB_OIDC_ISSUER,
      audience: GITHUB_OIDC_AUDIENCE,
    });

    return (
      payload.repository === GITHUB_REPOSITORY &&
      payload.repository_id === GITHUB_REPOSITORY_ID &&
      payload.repository_visibility === "public" &&
      payload.ref === GITHUB_BRANCH &&
      (payload.event_name === "schedule" ||
        payload.event_name === "workflow_dispatch")
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!(await geautoriseerd(request))) {
    return NextResponse.json(
      { fout: "Niet geautoriseerd." },
      { status: 401 },
    );
  }

  try {
    const resultaat = await verstuurDienstHerinneringen();

    return NextResponse.json({
      ok: true,
      ...resultaat,
    });
  } catch (error) {
    console.error("Dienstherinneringen mislukt:", error);

    return NextResponse.json(
      {
        fout: "Dienstherinneringen konden niet worden verwerkt.",
      },
      { status: 500 },
    );
  }
}
