import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AuditPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) redirect("/login");

  const eigenaar = await isEigenaar();

  if (!eigenaar) {
    redirect("/dashboard");
  }

  const logs = await prisma.auditLog.findMany({
    take: 200,
    orderBy: { aangemaaktOp: "desc" },
    include: {
      systeemGebruiker: {
        select: { naam: true, email: true },
      },
    },
  });

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Eigenaar</p>
        <h1 className="text-2xl font-bold text-slate-900">Auditlog</h1>
        <p className="mt-1 text-sm text-slate-600">
          Geschiedenis van belangrijke acties en wijzigingen in Clevers ERP.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {logs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nog geen auditregels beschikbaar.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <article key={log.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {log.module} · {log.actie}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {log.systeemGebruiker?.naam ?? "Systeem"} ·{" "}
                      {new Intl.DateTimeFormat("nl-NL", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(log.aangemaaktOp)}
                    </p>
                  </div>
                  {log.recordId && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      {log.recordId}
                    </span>
                  )}
                </div>
                {log.details && (
                  <pre className="mt-4 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <Link href="/dashboard" className="inline-flex text-sm font-semibold text-slate-700">
        ← Terug naar dashboard
      </Link>
    </main>
  );
}
