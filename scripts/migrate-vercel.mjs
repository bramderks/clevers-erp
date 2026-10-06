import { execFileSync } from "node:child_process";
import { Client } from "pg";

const OWNER_PROFILE_MIGRATION =
  "20260916203000_create_owner_employee_profiles";



// Tijdelijke eenmalige herstelactie september 2026 Nijmegen.
// Wordt na succesvolle productie-uitvoering verwijderd.
const SEPTEMBER_HERSTEL = true;

async function herstelSeptember2026() {
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "production" || !process.env.DATABASE_URL) return;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const crypto = await import("node:crypto");
  const diensten = [{"date":"2026-09-02","start":"09:00","end":"18:00","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-03","start":"09:00","end":"17:00","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-05","start":"09:00","end":"14:00","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-06","start":"09:00","end":"14:00","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-01","start":"14:00","end":"22:15","tag":"Leidinggevende","names":["Bram Derks"]},{"date":"2026-09-04","start":"09:00","end":"14:00","tag":"Leidinggevende","names":["Bram Derks"]},{"date":"2026-09-06","start":"14:00","end":"22:15","tag":"Leidinggevende","names":["Bram Derks"]},{"date":"2026-09-01","start":"09:00","end":"14:00","tag":"Leidinggevende","names":["Andrea de Bock"]},{"date":"2026-09-04","start":"14:00","end":"22:15","tag":"Leidinggevende","names":["Andrea de Bock"]},{"date":"2026-09-05","start":"14:00","end":"22:00","tag":"Leidinggevende","names":["Pleun Kamps"]},{"date":"2026-09-05","start":"14:00","end":"22:00","tag":"Handijs","names":["Maureen Houkes"]},{"date":"2026-09-04","start":"18:00","end":"22:15","tag":"Handijs","names":["Pleun Schenk"]},{"date":"2026-09-06","start":"18:00","end":"22:15","tag":"Handijs","names":["Pleun Schenk","Maud Broeren"]},{"date":"2026-09-01","start":"18:00","end":"22:15","tag":"Handijs","names":["Julia Leenders"]},{"date":"2026-09-03","start":"18:00","end":"22:15","tag":"Handijs","names":["Julia Leenders"]},{"date":"2026-09-06","start":"14:00","end":"18:00","tag":"Handijs","names":["Lotte Trilsbeek"]},{"date":"2026-09-04","start":"18:00","end":"21:00","tag":"Handijs","names":["Isa Derks"]},{"date":"2026-09-02","start":"18:00","end":"22:15","tag":"Leidinggevende","names":["Jayro Peters"]},{"date":"2026-09-03","start":"17:00","end":"22:15","tag":"Leidinggevende","names":["Jayro Peters"]},{"date":"2026-09-05","start":"18:00","end":"22:00","tag":"Handijs","names":["Millie Kempenaar"]},{"date":"2026-09-09","start":"11:30","end":"21:00","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-10","start":"11:30","end":"17:00","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-08","start":"11:30","end":"17:00","tag":"Leidinggevende","names":["Bram Derks"]},{"date":"2026-09-13","start":"11:30","end":"20:45","tag":"Leidinggevende","names":["Bram Derks"]},{"date":"2026-09-07","start":"11:30","end":"17:00","tag":"Leidinggevende","names":["Andrea de Bock"]},{"date":"2026-09-11","start":"11:30","end":"21:00","tag":"Leidinggevende","names":["Andrea de Bock"]},{"date":"2026-09-12","start":"11:30","end":"21:00","tag":"Leidinggevende","names":["Pleun Kamps"]},{"date":"2026-09-11","start":"17:30","end":"21:00","tag":"Handijs","names":["Pleun Schenk"]},{"date":"2026-09-13","start":"17:00","end":"20:45","tag":"Handijs","names":["Pleun Schenk"]},{"date":"2026-09-10","start":"17:00","end":"21:00","tag":"Handijs","names":["Sayanora Amadmoesri"]},{"date":"2026-09-07","start":"17:00","end":"21:30","tag":"Handijs","names":["Coosje Helsen"]},{"date":"2026-09-12","start":"14:00","end":"21:00","tag":"Handijs","names":["Coosje Helsen"]},{"date":"2026-09-08","start":"17:00","end":"20:45","tag":"Handijs","names":["Julia Leenders"]},{"date":"2026-09-13","start":"18:00","end":"20:45","tag":"Handijs","names":["Maud Broeren"]},{"date":"2026-09-11","start":"18:00","end":"21:00","tag":"Handijs","names":["Isa Derks"]},{"date":"2026-09-07","start":"17:00","end":"21:30","tag":"Leidinggevende","names":["Jayro Peters"]},{"date":"2026-09-08","start":"17:00","end":"20:45","tag":"Leidinggevende","names":["Jayro Peters"]},{"date":"2026-09-10","start":"17:00","end":"21:00","tag":"Leidinggevende","names":["Jayro Peters"]},{"date":"2026-09-16","start":"11:30","end":"21:00","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-20","start":"11:30","end":"21:15","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-15","start":"11:30","end":"21:30","tag":"Leidinggevende","names":["Bram Derks"]},{"date":"2026-09-17","start":"11:30","end":"21:00","tag":"Leidinggevende","names":["Bram Derks"]},{"date":"2026-09-14","start":"11:30","end":"17:00","tag":"Leidinggevende","names":["Andrea de Bock"]},{"date":"2026-09-18","start":"11:30","end":"21:00","tag":"Leidinggevende","names":["Andrea de Bock"]},{"date":"2026-09-19","start":"11:30","end":"20:45","tag":"Leidinggevende","names":["Pleun Kamps"]},{"date":"2026-09-19","start":"14:00","end":"17:00","tag":"Handijs","names":["Maureen Houkes"]},{"date":"2026-09-19","start":"17:00","end":"20:45","tag":"Handijs","names":["Sayanora Amadmoesri"]},{"date":"2026-09-14","start":"17:00","end":"21:15","tag":"Handijs","names":["Coosje Helsen"]},{"date":"2026-09-15","start":"17:00","end":"21:00","tag":"Handijs","names":["Lotte Trilsbeek"]},{"date":"2026-09-20","start":"14:00","end":"18:00","tag":"Handijs","names":["Lotte Trilsbeek"]},{"date":"2026-09-17","start":"17:00","end":"21:00","tag":"Handijs","names":["Maud Broeren"]},{"date":"2026-09-20","start":"17:00","end":"21:15","tag":"Handijs","names":["Maud Broeren"]},{"date":"2026-09-18","start":"17:00","end":"21:00","tag":"Handijs","names":["Isa Derks"]},{"date":"2026-09-14","start":"17:00","end":"21:15","tag":"Leidinggevende","names":["Jayro Peters"]},{"date":"2026-09-23","start":"11:30","end":"21:30","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-27","start":"11:30","end":"21:30","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-22","start":"11:30","end":"17:00","tag":"Leidinggevende","names":["Bram Derks"]},{"date":"2026-09-24","start":"11:30","end":"21:00","tag":"Leidinggevende","names":["Bram Derks"]},{"date":"2026-09-21","start":"11:30","end":"17:00","tag":"Leidinggevende","names":["Andrea de Bock"]},{"date":"2026-09-22","start":"17:00","end":"20:45","tag":"Leidinggevende","names":["Andrea de Bock"]},{"date":"2026-09-25","start":"11:30","end":"21:00","tag":"Leidinggevende","names":["Andrea de Bock"]},{"date":"2026-09-26","start":"11:30","end":"21:30","tag":"Leidinggevende","names":["Pleun Kamps"]},{"date":"2026-09-24","start":"17:00","end":"21:00","tag":"Handijs","names":["Sayanora Amadmoesri"]},{"date":"2026-09-21","start":"17:00","end":"21:00","tag":"Handijs","names":["Coosje Helsen"]},{"date":"2026-09-25","start":"17:00","end":"21:00","tag":"Handijs","names":["Julia Leenders"]},{"date":"2026-09-27","start":"14:00","end":"18:00","tag":"Handijs","names":["Lotte Trilsbeek"]},{"date":"2026-09-22","start":"17:00","end":"20:45","tag":"Handijs","names":["Maud Broeren"]},{"date":"2026-09-27","start":"17:00","end":"21:00","tag":"Handijs","names":["Maud Broeren"]},{"date":"2026-09-21","start":"17:00","end":"21:00","tag":"Leidinggevende","names":["Jayro Peters"]},{"date":"2026-09-26","start":"17:00","end":"21:30","tag":"Handijs","names":["Millie Kempenaar"]},{"date":"2026-09-30","start":"11:30","end":"21:00","tag":"Leidinggevende","names":["Jessica Derks"]},{"date":"2026-09-29","start":"11:30","end":"21:00","tag":"Leidinggevende","names":["Bram Derks"]},{"date":"2026-09-28","start":"11:00","end":"17:00","tag":"Leidinggevende","names":["Andrea de Bock"]},{"date":"2026-09-28","start":"17:00","end":"21:00","tag":"Handijs","names":["Coosje Helsen"]},{"date":"2026-09-29","start":"17:00","end":"21:00","tag":"Handijs","names":["Julia Leenders"]},{"date":"2026-09-30","start":"18:00","end":"21:00","tag":"Handijs","names":["Isa Derks"]},{"date":"2026-09-28","start":"17:00","end":"21:00","tag":"Leidinggevende","names":["Jayro Peters"]},{"date":"2026-09-30","start":"17:00","end":"21:00","tag":"Handijs","names":["Millie Kempenaar"]}];
  const leiders = new Set(["Bram Derks","Jessica Derks","Andrea de Bock","Jayro Peters","Pleun Kamps"]);
  function fullName(row) { return [row.voornaam,row.tussenvoegsel,row.achternaam].filter(Boolean).join(" "); }
  function dt(date,time) { return new Date(date+"T"+time+":00+02:00"); }
  function worked(start,end) {
    const mins=(end-start)/60000, startMin=start.getHours()*60+start.getMinutes(), endMin=end.getHours()*60+end.getMinutes();
    let pause=0;
    if(startMin<720) pause=endMin<=840?15:(mins>360?30:0);
    else if(startMin<1020) pause=endMin<=1080?0:30;
    else pause=0;
    return {pause, hours:(mins-pause)/60};
  }
  await client.connect();
  try {
    await client.query("BEGIN");
    const vest = await client.query(`SELECT "id" FROM "Vestiging" WHERE "naam"='Nijmegen' ORDER BY "actief" DESC LIMIT 1`);
    if (!vest.rowCount) throw new Error("Vestiging Nijmegen niet gevonden.");
    const vestigingId=vest.rows[0].id;
    const tagsRes=await client.query(`SELECT "id","naam" FROM "Tag" WHERE "naam" IN ('Leidinggevende','Handijs')`);
    const tagId=new Map(tagsRes.rows.map(r=>[r.naam,r.id]));
    if(!tagId.has("Leidinggevende")||!tagId.has("Handijs")) throw new Error("Tags Leidinggevende en/of Handijs ontbreken.");
    const empRes=await client.query(`SELECT m."id",m."voornaam",m."tussenvoegsel",m."achternaam" FROM "Medewerker" m JOIN "MedewerkerVestiging" mv ON mv."medewerkerId"=m."id" WHERE mv."vestigingId"=$1`,[vestigingId]);
    const emp=new Map();
    for(const row of empRes.rows) emp.set(fullName(row),row.id);
    for(const d of diensten) for(const n of d.names){
      const id=emp.get(n) || (n==="Andrea de Bock" ? emp.get("Andrea de Bock - Berghmans") : undefined);
      if(!id) throw new Error("Medewerker niet gevonden: "+n);
      d.medewerkerId=id;
    }
    const weeks=new Map();
    for(const w of [36,37,38,39,40]){
      const q=await client.query(`SELECT "id" FROM "Week" WHERE "vestigingId"=$1 AND "jaar"=2026 AND "weeknummer"=$2`,[vestigingId,w]);
      if(!q.rowCount) throw new Error("Week niet gevonden: "+w);
      weeks.set(w,q.rows[0].id);
    }
    const existing=await client.query(`SELECT count(*)::int AS count FROM "Dienst" d JOIN "Week" w ON w."id"=d."weekId" WHERE w."vestigingId"=$1 AND d."datum">=$2 AND d."datum"<$3`,[vestigingId,"2026-09-01T00:00:00+02:00","2026-10-01T00:00:00+02:00"]);
    const oldCount=existing.rows[0].count;
    await client.query(`DELETE FROM "Dienst" d USING "Week" w WHERE d."weekId"=w."id" AND w."vestigingId"=$1 AND d."datum">=$2 AND d."datum"<$3`,[vestigingId,"2026-09-01T00:00:00+02:00","2026-10-01T00:00:00+02:00"]);
    const perMed=new Map();
    let createdServices=0, createdBezettingen=0;
    for(const d of diensten){
      const weekNo=new Date(d.date+"T12:00:00+02:00").getDay()===0 ? 0 : null;
      const isoWeek = (()=>{ const x=new Date(d.date+"T12:00:00+02:00"); const day=x.getDay()||7; x.setDate(x.getDate()+4-day); const y=x.getFullYear(); const jan4=new Date(y,0,4); const janDay=jan4.getDay()||7; return Math.ceil((((x-jan4)/86400000)+janDay-1)/7); })();
      const weekId=weeks.get(isoWeek);
      if(!weekId) throw new Error("Geen week voor "+d.date+" (week "+isoWeek+")");
      const dienstId=crypto.randomUUID();
      const begin=dt(d.date,d.start), end=dt(d.date,d.end);
      await client.query(`INSERT INTO "Dienst" ("id","weekId","datum","begintijd","eindtijd","aangemaaktOp","gewijzigdOp") VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,[dienstId,weekId,begin,begin,end]);
      await client.query(`INSERT INTO "DienstTag" ("id","dienstId","tagId","aantal") VALUES ($1,$2,$3,1)`,[crypto.randomUUID(),dienstId,tagId.get(d.tag)]);
      for(const n of d.names){
        const medewerkerId=d.medewerkerId || emp.get(n);
        const bezId=crypto.randomUUID();
        await client.query(`INSERT INTO "DienstBezetting" ("id","dienstId","medewerkerId","status","aangemaaktOp","gewijzigdOp") VALUES ($1,$2,$3,'GEWERKT',NOW(),NOW())`,[bezId,dienstId,medewerkerId]);
        const calc=worked(begin,end);
        await client.query(`INSERT INTO "UrenRegistratie" ("id","dienstBezettingId","medewerkerId","vestigingId","datum","taak","werkelijkeBegintijd","werkelijkeEindtijd","pauzeMinuten","gewerkteUren","status","aangemaaktOp","gewijzigdOp") VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9,'DEFINITIEF',NOW(),NOW())`,[crypto.randomUUID(),bezId,medewerkerId,vestigingId,begin,begin,end,calc.pause,calc.hours]);
        const key=medewerkerId;
        const cur=perMed.get(key)||{days:new Set(),hours:0,name:n};
        cur.days.add(d.date); cur.hours+=calc.hours; perMed.set(key,cur); createdBezettingen++;
      }
      createdServices++;
    }
    const period=await client.query(`SELECT "id" FROM "VerloningsPeriode" WHERE "jaar"=2026 AND "maand"=9 LIMIT 1`);
    if(period.rowCount){
      const pid=period.rows[0].id;
      await client.query(`DELETE FROM "VerloningsRegel" WHERE "verloningsPeriodeId"=$1`,[pid]);
      await client.query(`DELETE FROM "VerloningsControle" WHERE "verloningsPeriodeId"=$1`,[pid]);
      for(const [medewerkerId,v] of perMed){
        const medewerkerNaam=v.name;
        await client.query(`INSERT INTO "VerloningsRegel" ("id","verloningsPeriodeId","medewerkerId","vestigingId","medewerkerNaam","gewerkteDagen","gewerkteUren","aangemaaktOp","gewijzigdOp") VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,[crypto.randomUUID(),pid,medewerkerId,vestigingId,medewerkerNaam,v.days.size,Number(v.hours.toFixed(2))]);
        await client.query(`INSERT INTO "VerloningsControle" ("id","verloningsPeriodeId","medewerkerId","status") VALUES ($1,$2,$3,'OPEN')`,[crypto.randomUUID(),pid,medewerkerId]);
      }
      await client.query(`UPDATE "VerloningsPeriode" SET "status"='KLAAR',"gegenereerdOp"=NOW(),"gecontroleerdDoorId"=NULL,"gecontroleerdOp"=NULL WHERE "id"=$1`,[pid]);
    }
    const total=await client.query(`SELECT COUNT(*)::int AS registrations, SUM("gewerkteUren")::numeric(10,2) AS hours, COUNT(DISTINCT ("medewerkerId","datum"))::int AS days FROM "UrenRegistratie" WHERE "vestigingId"=$1 AND "datum">=$2 AND "datum"<$3`,[vestigingId,"2026-09-01T00:00:00+02:00","2026-10-01T00:00:00+02:00"]);
    await client.query("COMMIT");
    console.log(JSON.stringify({herstel:"geslaagd",oldServices:oldCount,createdServices,createdBezettingen,registrations:Number(total.rows[0].registrations),hours:Number(total.rows[0].hours),employeeDays:Number(total.rows[0].days)}));
  } catch(e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { await client.end(); }
}

if (SEPTEMBER_HERSTEL) await herstelSeptember2026();

if (process.env.VERCEL === "1") {
  // The first production rollout of the owner-profile migration failed after
  // partially entering Prisma's migration table. Recover only that known
  // failed migration so the corrected migration can be retried normally.
  if (process.env.DATABASE_URL) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    try {
      await client.connect();

      const result = await client.query(
        `SELECT 1
         FROM "_prisma_migrations"
         WHERE "migration_name" = $1
           AND "finished_at" IS NULL
           AND "rolled_back_at" IS NULL
         LIMIT 1`,
        [OWNER_PROFILE_MIGRATION],
      );

      if (result.rowCount > 0) {
        execFileSync(
          "npx",
          ["prisma", "migrate", "resolve", "--rolled-back", OWNER_PROFILE_MIGRATION],
          {
            stdio: "inherit",
            env: process.env,
          },
        );
      }
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
}
