import Link from "next/link";
import Card from "@/components/ui/Card";

export default function QuickActions() {
  const acties = [
    { naam: "Nieuwe vestiging", href: "/vestigingen" },
    { naam: "Nieuwe medewerker", href: "/medewerkers" },
    { naam: "Planning", href: "/planning" },
    { naam: "Nieuwe bestelling", href: "/bestellingen" },
  ];

  return (
    <Card>
      <h2 className="mb-5 text-xl font-semibold">
        Snelle acties
      </h2>

      <div className="grid gap-3">
        {acties.map((actie) => (
          <Link
            key={actie.naam}
            href={actie.href}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#A8D8D8] hover:bg-[#A8D8D8]/20"
          >
            {actie.naam}
          </Link>
        ))}
      </div>
    </Card>
  );
}