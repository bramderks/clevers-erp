import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, CalendarDays, Palmtree, WalletCards } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";

export default async function AppProfielPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/profiel");
  }

  if (!gebruiker.medewerker?.id) {
    redirect("/app");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-sm text-slate-300">Mijn profiel</p>
          <h1 className="mt-1 text-2xl font-bold">{gebruiker.naam}</h1>
          <p className="mt-2 text-sm text-slate-300">{gebruiker.email}</p>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          {[
            { href: "/app/planning", label: "Mijn planning", icon: CalendarDays },
            { href: "/app/verloning", label: "Mijn verloning", icon: WalletCards },
            { href: "/app/vakantie", label: "Vakantieplanning", icon: Palmtree },
            { href: "/app", label: "Meldingen beheren", icon: Bell },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href + label}
              href={href}
              className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0"
            >
              <Icon size={20} className="text-slate-500" />
              <span className="font-medium text-slate-900">{label}</span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
