import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kalenderDatumUTC, lokaleDatumSleutel, formatDienstTijd, nederlandseDatumTijd } from "@/lib/planning/tijd";

export const dynamic = "force-dynamic";

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatIcsDate(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function combineDateAndTime(datum: Date, tijd: Date) {
  return nederlandseDatumTijd(
    lokaleDatumSleutel(datum),
    formatDienstTijd(tijd),
  );
}
