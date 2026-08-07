"use client";

import { Bell, ChevronDown, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { defaultPage, pageTitles } from "@/lib/pageTitles";
import { theme } from "@/lib/theme";

export default function Topbar() {
  const pathname = usePathname();

  const page =
    pageTitles[pathname as keyof typeof pageTitles] ?? defaultPage;

  const vandaag = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <header
      className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b bg-white px-8"
      style={{
        borderColor: theme.colors.border,
      }}
    >
      <div className="flex items-center gap-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {page.title}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {page.subtitle}
          </p>
        </div>

        <div className="hidden xl:flex">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              placeholder="Zoeken..."
              className="w-96 rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-12 outline-none transition focus:border-[#A8D8D8] focus:bg-white"
            />

            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded bg-slate-200 px-2 py-1 text-xs text-slate-600">
              Ctrl K
            </kbd>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden text-right lg:block">
          <p className="font-medium text-slate-900">
            {vandaag}
          </p>

          <p className="text-xs text-slate-500">
            Clevers Nijmegen
          </p>
        </div>

        <button className="relative rounded-xl p-3 transition hover:bg-slate-100">
          <Bell size={20} />

          <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500" />
        </button>

        <button className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:bg-slate-50">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full font-bold"
            style={{
              background: theme.colors.primary,
            }}
          >
            B
          </div>

          <div className="text-left">
            <div className="font-semibold text-slate-900">
              Bram Derks
            </div>

            <div className="text-xs text-slate-500">
              Super Admin
            </div>
          </div>

          <ChevronDown size={18} />
        </button>
      </div>
    </header>
  );
}