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
  { href: "/dashboard", label: "Taken", icon: CheckSquare },
  {
    href: "/app/beschikbaarheid",
    label: "Beschikbaar",
    icon: ClipboardClock,
  },
  { href: "/profiel", label: "Profiel", icon: UserRound },
];

export default function WebAppBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Webapp navigatie"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
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
                "flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition " +
                (actief
                  ? "text-slate-950"
                  : "text-slate-400 hover:text-slate-700")
              }
            >
              <Icon size={21} strokeWidth={actief ? 2.5 : 2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
