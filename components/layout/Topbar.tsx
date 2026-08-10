"use client";

import {
  Bell,
  ChevronDown,
  LogOut,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  defaultPage,
  pageTitles,
} from "@/lib/pageTitles";
import { theme } from "@/lib/theme";

type TopbarGebruiker = {
  naam: string;
  rollen: string[];
};

type TopbarProps = {
  gebruiker: TopbarGebruiker;
};

export default function Topbar({
  gebruiker,
}: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [
    uitloggenBezig,
    setUitloggenBezig,
  ] = useState(false);

  const menuRef =
    useRef<HTMLDivElement | null>(null);

  const page =
    pageTitles[
      pathname as keyof typeof pageTitles
    ] ?? defaultPage;

  const vandaag =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    ).format(new Date());

  const eersteRol =
    gebruiker.rollen[0] ??
    "Gebruiker";

  const initialen =
    gebruiker.naam
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((deel) =>
        deel
          .charAt(0)
          .toUpperCase(),
      )
      .join("") || "G";

  useEffect(() => {
    function sluitMenu(
      event: MouseEvent,
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node,
        )
      ) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener(
        "mousedown",
        sluitMenu,
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        sluitMenu,
      );
    };
  }, [menuOpen]);

  useEffect(() => {
    function escapeMenu(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener(
        "keydown",
        escapeMenu,
      );
    }

    return () => {
      document.removeEventListener(
        "keydown",
        escapeMenu,
      );
    };
  }, [menuOpen]);

  async function handleLogout() {
    if (uitloggenBezig) {
      return;
    }

    setUitloggenBezig(true);

    try {
      const response =
        await fetch("/api/logout", {
          method: "POST",
          credentials: "include",
        });

      if (!response.ok) {
        throw new Error(
          "Uitloggen is mislukt.",
        );
      }

      setMenuOpen(false);

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error(
        "Uitloggen mislukt:",
        error,
      );

      setUitloggenBezig(false);
    }
  }

  return (
    <header
      className="sticky top-0 z-40 flex h-[76px] shrink-0 items-center justify-between border-b bg-white px-4 lg:px-8"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      {/* Linkerkant */}
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold text-slate-900">
          {page.title}
        </h1>

        <p className="mt-1 hidden text-sm text-slate-500 sm:block">
          {page.subtitle}
        </p>
      </div>

      {/* Midden */}
      <div className="hidden xl:flex">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            placeholder="Zoeken..."
            className="w-80 rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-12 outline-none transition focus:border-[#A8D8D8] focus:bg-white"
          />

          <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded bg-slate-200 px-2 py-1 text-xs text-slate-600">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* Rechterkant */}
      <div className="flex items-center gap-3 lg:gap-5">
        <div className="hidden text-right lg:block">
          <p className="font-medium capitalize text-slate-900">
            {vandaag}
          </p>

          <p className="text-xs text-slate-500">
            Clevers Nijmegen
          </p>
        </div>

        {/* Meldingen */}
        <button
          type="button"
          aria-label="Meldingen"
          className="relative rounded-xl p-3 transition hover:bg-slate-100"
        >
          <Bell size={20} />

          <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500" />
        </button>

        {/* Gebruikersmenu */}
        <div
          ref={menuRef}
          className="relative"
        >
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() =>
              setMenuOpen(
                (waarde) => !waarde,
              )
            }
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
              menuOpen
                ? "border-slate-300 bg-slate-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold"
              style={{
                background:
                  theme.colors.primary,
              }}
            >
              {initialen}
            </div>

            <div className="hidden text-left sm:block">
              <div className="max-w-[160px] truncate font-semibold text-slate-900">
                {gebruiker.naam}
              </div>

              <div className="text-xs text-slate-500">
                {eersteRol}
              </div>
            </div>

            <ChevronDown
              size={18}
              className={`transition-transform ${
                menuOpen
                  ? "rotate-180"
                  : ""
              }`}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] z-[100] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
            >
              {/* Gebruiker */}
              <div className="border-b border-slate-100 px-3 py-3">
                <p className="truncate font-semibold text-slate-900">
                  {gebruiker.naam}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {eersteRol}
                </p>
              </div>

              {/* Acties */}
              <div className="py-1">
                <Link
                  href="/profiel"
                  role="menuitem"
                  onClick={() =>
                    setMenuOpen(
                      false,
                    )
                  }
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <User
                    size={18}
                    className="text-slate-400"
                  />

                  <span>
                    Profiel
                  </span>
                </Link>

                <button
                  type="button"
                  role="menuitem"
                  onClick={
                    handleLogout
                  }
                  disabled={
                    uitloggenBezig
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut
                    size={18}
                    className="text-slate-400"
                  />

                  <span>
                    {uitloggenBezig
                      ? "Uitloggen..."
                      : "Uitloggen"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}