import { prisma } from "@/lib/prisma";
import { absoluteUrl, verstuurMail, webAppUrl } from "@/lib/mail";

type MedewerkerUpdateData = {
  personeelsnummer?: string | null; aanhef?: "DHR" | "MEVR" | "ANDERS" | "GEEN_OPGAVE"; voornaam?: string; tussenvoegsel?: string | null; achternaam?: string; roepnaam?: string | null; geboortedatum?: Date; email?: string; telefoon?: string; contractType?: "OPROEP" | "VAST" | null; contractUren?: number | null; uurloon?: number | null; datumInDienst?: Date | null; datumUitDienst?: Date | null;
};
type FindAllOptions = { organisatieIds?: string[]; vestigingIds?: string[]; includeInactive?: boolean };
function uniekeIds(ids: string[]) { return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim()))); }

export const medewerkerRepository = {
  async findAll(options: FindAllOptions = {}) {
    const { organisatieIds, vestigingIds, includeInactive = false } = options;
    const heeftOrganisatieFilter = organisatieIds !== undefined;
    const heeftVestigingFilter = vestigingIds !== undefined;

    // Een geactiveerde nieuwe medewerker kan tijdelijk nog geen vestiging hebben.
    // De uitnodiging koppelt het dossier wél aan de organisatie. Neem daarom
    // gebruikte uitnodigingen mee wanneer er geen vestigingsfilter actief is.
    let geactiveerdeUitnodigingEmails: string[] = [];
    if (heeftOrganisatieFilter && !heeftVestigingFilter && (organisatieIds?.length ?? 0) > 0) {
      const uitnodigingen = await prisma.medewerkerUitnodiging.findMany({
        where: {
          organisatieId: { in: organisatieIds ?? [] },
          gebruiktOp: { not: null },
        },
        select: { email: true },
      });
      geactiveerdeUitnodigingEmails = uitnodigingen.map((uitnodiging) => uitnodiging.email.trim().toLowerCase());
    }

    const vestigingVoorwaarde = {
      vestigingen: {
        some: {
          ...(heeftOrganisatieFilter
            ? { vestiging: { organisatieId: { in: organisatieIds ?? [] } } }
            : {}),
          ...(heeftVestigingFilter
            ? { vestigingId: { in: vestigingIds ?? [] } }
            : {}),
        },
      },
    };

    const statusVoorwaarde = includeInactive ? {} : { actief: true };

    const where =
      heeftOrganisatieFilter || heeftVestigingFilter
        ? heeftOrganisatieFilter && !heeftVestigingFilter
          ? {
              AND: [
                statusVoorwaarde,
                {
                  OR: [
                    vestigingVoorwaarde,
                    ...(geactiveerdeUitnodigingEmails.length > 0
                      ? [{ email: { in: geactiveerdeUitnodigingEmails } }]
                      : []),
                  ],
                },
              ],
            }
          : { ...statusVoorwaarde, ...vestigingVoorwaarde }
        : statusVoorwaarde;

    return prisma.medewerker.findMany({
      where,
      include: { status: true, vestigingen: { include: { vestiging: true }, orderBy: { hoofdvestiging: "desc" } }, rollen: { include: { rol: true }, orderBy: { rol: { naam: "asc" } } }, tags: { include: { tag: true }, orderBy: { tag: { volgorde: "asc" } } }, beschikbaarheden: { orderBy: [{ datum: "asc" }, { begintijd: "asc" }] }, vakantieAanvragen: { orderBy: [{ startDatum: "asc" }, { eindDatum: "asc" }], include: { vestiging: true } }, diensten: { include: { dienst: { include: { week: true, tags: { include: { tag: true }, orderBy: { tag: { volgorde: "asc" } } } } } }, orderBy: { dienst: { datum: "asc" } } }, verloningsRegels: { include: { verloningsPeriode: true, vestiging: true }, orderBy: { verloningsPeriode: { periodeStart: "desc" } } } },
      orderBy: [{ achternaam: "asc" }, { voornaam: "asc" }],
    });
  },
  async findById(id: string) {
    return prisma.medewerker.findUnique({ where: { id }, include: { systeemGebruiker: { select: { id: true, naam: true, email: true, actief: true, laatsteLoginOp: true } }, status: true, vestigingen: { include: { vestiging: true }, orderBy: { hoofdvestiging: "desc" } }, rollen: { include: { rol: true }, orderBy: { rol: { naam: "asc" } } }, tags: { include: { tag: true }, orderBy: { tag: { volgorde: "asc" } } }, beschikbaarheden: { orderBy: [{ datum: "asc" }, { begintijd: "asc" }] }, vakantieAanvragen: { include: { vestiging: true }, orderBy: [{ startDatum: "desc" }, { eindDatum: "desc" }] }, diensten: { include: { dienst: { include: { week: true, tags: { include: { tag: true }, orderBy: { tag: { volgorde: "asc" } } } } } }, orderBy: { dienst: { datum: "asc" } } }, verloningsRegels: { include: { verloningsPeriode: true, vestiging: true }, orderBy: { verloningsPeriode: { periodeStart: "desc" } } } } });
  },
  async update(id: string, data: MedewerkerUpdateData) { return prisma.medewerker.update({ where: { id }, data: { ...(data.personeelsnummer !== undefined && { personeelsnummer: data.personeelsnummer }), ...(data.aanhef !== undefined && { aanhef: data.aanhef }), ...(data.voornaam !== undefined && { voornaam: data.voornaam }), ...(data.tussenvoegsel !== undefined && { tussenvoegsel: data.tussenvoegsel }), ...(data.achternaam !== undefined && { achternaam: data.achternaam }), ...(data.roepnaam !== undefined && { roepnaam: data.roepnaam }), ...(data.geboortedatum !== undefined && { geboortedatum: data.geboortedatum }), ...(data.email !== undefined && { email: data.email }), ...(data.telefoon !== undefined && { telefoon: data.telefoon }), ...(data.contractType !== undefined && { contractType: data.contractType }), ...(data.contractUren !== undefined && { contractUren: data.contractUren }), ...(data.uurloon !== undefined && { uurloon: data.uurloon }), ...(data.datumInDienst !== undefined && { datumInDienst: data.datumInDienst }), ...(data.datumUitDienst !== undefined && { datumUitDienst: data.datumUitDienst }) } }); },
  async updateStatus(id: string, statusId: string, actief?: boolean) {
    return prisma.$transaction(async (tx) => {
      const medewerker = await tx.medewerker.update({ where: { id }, data: { statusId, ...(actief !== undefined && { actief }) }, select: { id: true, systeemGebruikerId: true } });
      if (actief !== undefined && medewerker.systeemGebruikerId) {
        await tx.systeemGebruiker.update({ where: { id: medewerker.systeemGebruikerId }, data: { actief } });
      }
      return tx.medewerker.findUniqueOrThrow({ where: { id } });
    });
  },
  async setActivatie(id: string, statusId: string, geactiveerdDoor: string) {
    return prisma.$transaction(async (tx) => {
      const medewerker = await tx.medewerker.update({ where: { id }, data: { statusId, actief: true, geactiveerdOp: new Date(), geactiveerdDoor }, select: { id: true, systeemGebruikerId: true } });
      if (medewerker.systeemGebruikerId) {
        await tx.systeemGebruiker.update({ where: { id: medewerker.systeemGebruikerId }, data: { actief: true } });
      }
      return tx.medewerker.findUniqueOrThrow({ where: { id } });
    });
  },
  async setVestigingen(medewerkerId: string, vestigingIds: string[], hoofdvestigingId: string) {
    const ids = uniekeIds(vestigingIds); if (!ids.length) throw new Error("Een medewerker moet aan minimaal één vestiging gekoppeld zijn."); if (!ids.includes(hoofdvestigingId)) throw new Error("De hoofdvestiging moet ook aan de medewerker gekoppeld zijn.");
    return prisma.$transaction(async (tx) => { await tx.medewerkerVestiging.deleteMany({ where: { medewerkerId } }); await tx.medewerkerVestiging.createMany({ data: ids.map((vestigingId) => ({ medewerkerId, vestigingId, hoofdvestiging: vestigingId === hoofdvestigingId })) }); return tx.medewerkerVestiging.findMany({ where: { medewerkerId }, include: { vestiging: true }, orderBy: { hoofdvestiging: "desc" } }); });
  },
  async setRollen(medewerkerId: string, rolIds: string[]) {
    const ids = uniekeIds(rolIds);
    const rollen = await prisma.$transaction(async (tx) => {
      await tx.medewerkerRol.deleteMany({ where: { medewerkerId } });
      if (ids.length) await tx.medewerkerRol.createMany({ data: ids.map((rolId) => ({ medewerkerId, rolId })) });
      return tx.medewerkerRol.findMany({ where: { medewerkerId }, include: { rol: true }, orderBy: { rol: { naam: "asc" } } });
    });

    const medewerker = await prisma.medewerker.findUnique({ where: { id: medewerkerId }, include: { systeemGebruiker: true } });
    if (!medewerker) return rollen;

    if (ids.length > 0) {
      const status = await prisma.status.findUnique({ where: { module_code: { module: "MEDEWERKER", code: "ACTIEF" } } });
      await prisma.medewerker.update({ where: { id: medewerkerId }, data: { actief: true, ...(status ? { statusId: status.id } : {}) } });
      if (medewerker.systeemGebruikerId) await prisma.systeemGebruiker.update({ where: { id: medewerker.systeemGebruikerId }, data: { actief: true } });

      if (medewerker.systeemGebruiker && medewerker.systeemGebruiker.actief === false) {
        const app = webAppUrl();
        const erp = absoluteUrl("/login");
        await verstuurMail({
          to: medewerker.email,
          subject: "Je Clevers ERP-toegang is actief",
          text: `Beste ${medewerker.voornaam},\n\nJe toegang tot Clevers ERP is nu actief.\n\nOpen de medewerkersomgeving: ${app}\n\nLog in met je e-mailadres en het wachtwoord dat je bij de activatie hebt gekozen.\n\nMaak van Clevers een app op je telefoon:\n- iPhone/iPad: open de link in Safari, tik op de deelknop en kies “Zet op beginscherm”.\n- Android: open de link in Chrome, tik op het menu (⋮) en kies “Toevoegen aan startscherm” of “App installeren”.\n\nVoor de volledige ERP-omgeving: ${erp}\n\nMet vriendelijke groet,\nClevers`,
          html: `<p>Beste ${medewerker.voornaam},</p><p>Je <strong>Clevers ERP-toegang is nu actief</strong>.</p><p><a href="${app}"><strong>Open de medewerkersomgeving</strong></a></p><p>Log in met je e-mailadres en het wachtwoord dat je bij de activatie hebt gekozen.</p><p><strong>Maak van Clevers een app op je telefoon</strong></p><ul><li><strong>iPhone/iPad:</strong> open de link in Safari, tik op de deelknop en kies <strong>Zet op beginscherm</strong>.</li><li><strong>Android:</strong> open de link in Chrome, tik op het menu (⋮) en kies <strong>Toevoegen aan startscherm</strong> of <strong>App installeren</strong>.</li></ul><p>Voor de volledige ERP-omgeving kun je <a href="${erp}">hier inloggen</a>.</p><p>Met vriendelijke groet,<br>Clevers</p>`,
        });
      }
    } else {
      await prisma.medewerker.update({ where: { id: medewerkerId }, data: { actief: false } });
      if (medewerker.systeemGebruikerId) await prisma.systeemGebruiker.update({ where: { id: medewerker.systeemGebruikerId }, data: { actief: false } });
    }
    return rollen;
  },
  async setTags(medewerkerId: string, tagIds: string[]) {
    const ids = uniekeIds(tagIds); return prisma.$transaction(async (tx) => { await tx.medewerkerTag.deleteMany({ where: { medewerkerId } }); if (ids.length) await tx.medewerkerTag.createMany({ data: ids.map((tagId) => ({ medewerkerId, tagId })) }); return tx.medewerkerTag.findMany({ where: { medewerkerId }, include: { tag: true }, orderBy: { tag: { volgorde: "asc" } } }); });
  },
};
