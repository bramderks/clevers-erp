"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
  ClipboardClock,
  Home,
  UserRound,
} from "lucide-react";

const items = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/planning", label: "Planning", icon: CalendarDays },
  { href: "/app/taken", label: "Taken", icon: CheckSquare },
  {
    href: "/app/beschikbaarheid",
    label: "Beschikbaar",
    icon: ClipboardClock,
  },
  { href: "/app/profiel", label: "Profiel", icon: UserRound },
];

export default function WebAppBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-3 z-[100] mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl"
      style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}
      aria-label="Webapp navigatie"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const actief =
            item.href === "/app"
              ? pathname === "/app"
              : pathname === item.href ||
                pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={actief ? "page" : undefined}
              className={
                "flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition " +
                (actief
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")
              }
            >
              <Icon size={22} strokeWidth={actief ? 2.5 : 2} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
