"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigation } from "@/lib/navigation";
import { theme } from "@/lib/theme";

export default function Navigation() {
  const pathname = usePathname();

  return (
    <div className="space-y-8">
      {navigation.map((group) => (
        <section key={group.group}>
          <h3
            className="mb-3 px-4 text-xs font-semibold uppercase tracking-[0.18em]"
            style={{
              color: theme.colors.sidebar.group,
            }}
          >
            {group.group}
          </h3>

          <nav className="space-y-1.5">
            {group.items.map((item) => {
              const Icon = item.icon;

              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200"
                  style={{
                    background: active
                      ? theme.colors.sidebar.activeBackground
                      : "transparent",

                    color: active
                      ? theme.colors.sidebar.activeText
                      : theme.colors.sidebar.text,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background =
                        theme.colors.sidebar.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <div
                    className="h-6 w-1 rounded-full transition-all"
                    style={{
                      background: active
                        ? theme.colors.primary
                        : "transparent",
                    }}
                  />

                  <Icon size={20} />

                  <span className="flex-1 text-sm font-medium">
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </nav>
        </section>
      ))}
    </div>
  );
}