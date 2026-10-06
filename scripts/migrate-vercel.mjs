import { execFileSync } from "node:child_process";
import { Client } from "pg";

const OWNER_PROFILE_MIGRATION =
  "20260916203000_create_owner_employee_profiles";



if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production" && process.env.DATABASE_URL) {
  const target=[["Jessica Derks","2026-09-02","0900","1800",8.5],["Jessica Derks","2026-09-03","0900","1700",7.5],["Jessica Derks","2026-09-05","0900","1400",4.75],["Jessica Derks","2026-09-06","0900","1400",4.75],["Bram Derks","2026-09-01","1400","2215",7.75],["Bram Derks","2026-09-04","0900","1400",4.75],["Bram Derks","2026-09-06","1400","2215",7.75],["Andrea de Bock - Berghmans","2026-09-01","0900","1400",4.75],["Andrea de Bock - Berghmans","2026-09-04","1400","2215",7.75],["Pleun Kamps","2026-09-05","1400","2200",7.5],["Lisa Bergs","2026-09-06","1400","2230",8],["Maureen Houkes","2026-09-05","1400","2200",7.5],["Pleun Schenk","2026-09-04","1800","2215",4.25],["Pleun Schenk","2026-09-06","1800","2215",4.25],["Julia Leenders","2026-09-01","1800","2215",4.25],["Julia Leenders","2026-09-03","1800","2215",4.25],["Lotte Trilsbeek","2026-09-06","1400","1800",4],["Maud Broeren","2026-09-06","1800","2215",4.25],["Taylor Weijers","2026-09-02","1800","2215",4.25],["Mauro Markovic","2026-09-06","1800","2100",3],["Isa Derks","2026-09-04","1800","2100",3],["Jayro Peters","2026-09-02","1800","2215",4.25],["Jayro Peters","2026-09-03","1700","2215",5.25],["Millie Kempenaar","2026-09-05","1800","2200",4],["Jessica Derks","2026-09-09","1130","2100",9],["Jessica Derks","2026-09-10","1130","1700",5.5],["Bram Derks","2026-09-08","1130","1700",5.5],["Bram Derks","2026-09-13","1130","2045",8.75],["Andrea de Bock - Berghmans","2026-09-07","1130","1700",5.5],["Andrea de Bock - Berghmans","2026-09-11","1130","2100",9],["Pleun Kamps","2026-09-12","1130","2100",9],["Lisa Bergs","2026-09-13","1700","2115",4.25],["Pleun Schenk","2026-09-11","1730","2100",3.5],["Pleun Schenk","2026-09-13","1700","2045",3.75],["Sayanora Amadmoesri","2026-09-10","1700","2100",4],["Coosje Helsen","2026-09-07","1700","2130",4.5],["Coosje Helsen","2026-09-12","1400","2100",6.5],["Julia Leenders","2026-09-08","1700","2045",3.75],["Maud Broeren","2026-09-13","1800","2045",2.75],["Taylor Weijers","2026-09-09","1800","2100",3],["Isa Derks","2026-09-11","1800","2100",3],["Jayro Peters","2026-09-07","1700","2130",4.5],["Jayro Peters","2026-09-08","1700","2045",3.75],["Jayro Peters","2026-09-10","1700","2100",4],["Jessica Derks","2026-09-16","1130","2100",9],["Jessica Derks","2026-09-20","1130","2115",9.25],["Bram Derks","2026-09-15","1130","2130",9.5],["Bram Derks","2026-09-17","1130","2100",9],["Andrea de Bock - Berghmans","2026-09-14","1130","1700",5.5],["Andrea de Bock - Berghmans","2026-09-18","1130","2100",9],["Pleun Kamps","2026-09-19","1130","2045",8.75],["Maureen Houkes","2026-09-19","1400","1700",3],["Sayanora Amadmoesri","2026-09-19","1700","2045",3.75],["Coosje Helsen","2026-09-14","1700","2115",4.25],["Lotte Trilsbeek","2026-09-15","1700","2100",4],["Lotte Trilsbeek","2026-09-20","1400","1800",4],["Maud Broeren","2026-09-17","1700","2100",4],["Maud Broeren","2026-09-20","1700","2115",4.25],["Taylor Weijers","2026-09-16","1730","2100",3.5],["Isa Derks","2026-09-18","1700","2100",4],["Jayro Peters","2026-09-14","1700","2115",4.25],["Jessica Derks","2026-09-23","1130","2130",9.5],["Jessica Derks","2026-09-27","1130","2130",9.5],["Bram Derks","2026-09-22","1130","1700",5.5],["Bram Derks","2026-09-24","1130","2100",9],["Andrea de Bock - Berghmans","2026-09-21","1130","1700",5.5],["Andrea de Bock - Berghmans","2026-09-22","1700","2045",3.75],["Andrea de Bock - Berghmans","2026-09-25","1130","2100",9],["Pleun Kamps","2026-09-26","1130","2130",9.5],["Sayanora Amadmoesri","2026-09-24","1700","2100",4],["Coosje Helsen","2026-09-21","1700","2100",4],["Julia Leenders","2026-09-25","1700","2100",4],["Lotte Trilsbeek","2026-09-27","1400","1800",4],["Maud Broeren","2026-09-22","1700","2045",3.75],["Maud Broeren","2026-09-27","1700","2100",4],["Taylor Weijers","2026-09-23","1700","2130",4.5],["Jayro Peters","2026-09-21","1700","2100",4],["Millie Kempenaar","2026-09-26","1700","2130",4.5],["Jessica Derks","2026-09-30","1130","2100",9],["Bram Derks","2026-09-29","1130","2100",9],["Andrea de Bock - Berghmans","2026-09-28","1100","1700",6],["Coosje Helsen","2026-09-28","1700","2100",4],["Julia Leenders","2026-09-29","1700","2100",4],["Isa Derks","2026-09-30","1800","2100",3],["Jayro Peters","2026-09-28","1700","2100",4],["Millie Kempenaar","2026-09-30","1700","2100",4]];
  const client=new Client({connectionString:process.env.DATABASE_URL}); await client.connect();
  try { await client.query("BEGIN");
    const vest=(await client.query(`SELECT "id" FROM "Vestiging" WHERE "naam"='Nijmegen' ORDER BY "actief" DESC LIMIT 1`)).rows[0]; if(!vest) throw new Error("Nijmegen ontbreekt");
    const em=(await client.query(`SELECT m."id",concat_ws(' ',m."voornaam",m."tussenvoegsel",m."achternaam") AS naam FROM "Medewerker" m`)).rows;
    const ids=new Map(em.map(x=>[x.naam,x.id]));
    const grouped=new Map(); for(const x of target){ if(!ids.has(x[0])) throw new Error("Ontbrekende medewerker: "+x[0]); const k=ids.get(x[0])+"|"+x[1]; grouped.set(k,x); }
    const current=(await client.query(`SELECT u."id",u."medewerkerId",to_char(u."datum",'YYYY-MM-DD') AS datum FROM "UrenRegistratie" u WHERE u."vestigingId"=$1 AND u."datum">=$2 AND u."datum"<$3 ORDER BY u."datum"`,[vest.id,"2026-09-01","2026-10-01"])).rows;
    const used=new Set(); let updated=0,deleted=0,created=0;
    for(const x of current){ const k=x.medewerkerId+"|"+x.datum; const t=grouped.get(k); if(!t){await client.query(`DELETE FROM "UrenRegistratie" WHERE "id"=$1`,[x.id]); deleted++; continue;} if(used.has(k)){await client.query(`DELETE FROM "UrenRegistratie" WHERE "id"=$1`,[x.id]); deleted++; continue;} used.add(k); const [hh1,mm1]=[t[2].slice(0,2),t[2].slice(2)]; const [hh2,mm2]=[t[3].slice(0,2),t[3].slice(2)]; const start=new Date(t[1]+"T"+hh1+":"+mm1+":00+02:00"); const end=new Date(t[1]+"T"+hh2+":"+mm2+":00+02:00"); const pause=Math.round((end-start)/60000-t[4]*60); await client.query(`UPDATE "UrenRegistratie" SET "werkelijkeBegintijd"=$1,"werkelijkeEindtijd"=$2,"pauzeMinuten"=$3,"gewerkteUren"=$4,"status"='DEFINITIEF',"gecontroleerdOp"=COALESCE("gecontroleerdOp",NOW()) WHERE "id"=$5`,[start,end,pause,t[4],x.id]); updated++; }
    for(const t of target){const mid=ids.get(t[0]),k=mid+"|"+t[1]; if(used.has(k)) continue; const bez=(await client.query(`SELECT db."id" FROM "DienstBezetting" db JOIN "Dienst" d ON d."id"=db."dienstId" WHERE db."medewerkerId"=$1 AND d."datum">=$2 AND d."datum"<$3 ORDER BY d."begintijd" LIMIT 1`,[mid,t[1],new Date(new Date(t[1]+"T00:00:00+02:00").getTime()+86400000).toISOString()])).rows[0]; if(!bez) throw new Error("Geen dienstbezetting voor "+t[0]+" "+t[1]); const [hh1,mm1]=[t[2].slice(0,2),t[2].slice(2)]; const [hh2,mm2]=[t[3].slice(0,2),t[3].slice(2)]; const start=new Date(t[1]+"T"+hh1+":"+mm1+":00+02:00"),end=new Date(t[1]+"T"+hh2+":"+mm2+":00+02:00"); const pause=Math.round((end-start)/60000-t[4]*60); await client.query(`INSERT INTO "UrenRegistratie" ("id","dienstBezettingId","medewerkerId","vestigingId","datum","werkelijkeBegintijd","werkelijkeEindtijd","pauzeMinuten","gewerkteUren","status","aangemaaktOp","gewijzigdOp") VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,'DEFINITIEF',NOW(),NOW())`,[bez.id,mid,vest.id,new Date(t[1]+"T00:00:00+02:00"),start,end,pause,t[4]]); created++; }
    const p=(await client.query(`SELECT "id" FROM "VerloningsPeriode" WHERE "jaar"=2026 AND "maand"=9`)).rows[0]; if(p){await client.query(`DELETE FROM "VerloningsRegel" WHERE "verloningsPeriodeId"=$1`,[p.id]); await client.query(`DELETE FROM "VerloningsControle" WHERE "verloningsPeriodeId"=$1`,[p.id]); const sums=await client.query(`SELECT "medewerkerId",COUNT(*)::int dagen,SUM("gewerkteUren")::numeric(10,2) uren FROM "UrenRegistratie" WHERE "vestigingId"=$1 AND "datum">=$2 AND "datum"<$3 GROUP BY "medewerkerId"`,[vest.id,"2026-09-01","2026-10-01"]); for(const s of sums.rows){const n=(await client.query(`SELECT concat_ws(' ',"voornaam","tussenvoegsel","achternaam") naam FROM "Medewerker" WHERE "id"=$1`,[s.medewerkerId])).rows[0].naam; await client.query(`INSERT INTO "VerloningsRegel" ("id","verloningsPeriodeId","medewerkerId","vestigingId","medewerkerNaam","gewerkteDagen","gewerkteUren","aangemaaktOp","gewijzigdOp") VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,NOW(),NOW())`,[p.id,s.medewerkerId,vest.id,n,s.dagen,s.uren]); await client.query(`INSERT INTO "VerloningsControle" ("id","verloningsPeriodeId","medewerkerId","status") VALUES (gen_random_uuid(),$1,$2,'OPEN')`,[p.id,s.medewerkerId]);} await client.query(`UPDATE "VerloningsPeriode" SET "status"='KLAAR',"gegenereerdOp"=NOW(),"gecontroleerdDoorId"=NULL,"gecontroleerdOp"=NULL WHERE "id"=$1`,[p.id]);}
    await client.query("COMMIT"); console.log("SEPTEMBER_HERSTEL_GEREED="+JSON.stringify({target:target.length,updated,deleted,created}));
  } catch(e){await client.query("ROLLBACK"); throw e;} finally{await client.end();}
}

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
