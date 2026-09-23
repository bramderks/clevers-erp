import * as XLSX from "xlsx";

export type NieuweMedewerkerImportRij = {
  rij: number;
  voornaam: string;
  achternaam: string;
  email: string;
};

export type NieuweMedewerkerImportFout = {
  rij: number;
  melding: string;
};

function normaliseerKolom(waarde: unknown) {
  return String(waarde ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-\s]+/g, "");
}

function waarde(waarde: unknown) {
  return String(waarde ?? "").trim();
}

export async function leesNieuweMedewerkersBestand(bestand: File) {
  const buffer = Buffer.from(await bestand.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { rijen: [], fouten: [{ rij: 1, melding: "Het Excel-bestand bevat geen werkblad." }] };
  }

  const worksheet = workbook.Sheets[sheetName];
  const bereik = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:C1");
  const headers: string[] = [];

  for (let c = bereik.s.c; c <= bereik.e.c; c++) {
    const cel = worksheet[XLSX.utils.encode_cell({ r: bereik.s.r, c })];
    headers.push(normaliseerKolom(cel?.v));
  }

  const vereiste = ["voornaam", "achternaam", "email"];
  const ontbrekend = vereiste.filter((kolom) => !headers.includes(kolom));

  if (ontbrekend.length) {
    return {
      rijen: [],
      fouten: [{
        rij: 1,
        melding: `De kolom(men) ${ontbrekend.join(", ")} ontbreekt. Gebruik exact: voornaam, achternaam, email.`,
      }],
    };
  }

  const bron = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: true,
  });

  const rijen: NieuweMedewerkerImportRij[] = [];
  const fouten: NieuweMedewerkerImportFout[] = [];

  bron.forEach((item, index) => {
    const rij = index + 2;
    const genormaliseerd: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(item)) {
      genormaliseerd[normaliseerKolom(key)] = val;
    }

    const voornaam = waarde(genormaliseerd.voornaam);
    const achternaam = waarde(genormaliseerd.achternaam);
    const email = waarde(genormaliseerd.email).toLowerCase();

    if (!voornaam || !achternaam || !email) {
      fouten.push({ rij, melding: "Voornaam, achternaam en e-mailadres zijn verplicht." });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fouten.push({ rij, melding: `Ongeldig e-mailadres: ${email}.` });
      return;
    }

    rijen.push({ rij, voornaam, achternaam, email });
  });

  if (!rijen.length && !fouten.length) {
    fouten.push({ rij: 1, melding: "Het bestand bevat geen medewerkers." });
  }

  return { rijen, fouten };
}
