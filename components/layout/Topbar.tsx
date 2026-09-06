"use client";

import {
  Bell,
  Check,
  ChevronDown,
  LogOut,
  Search,
  User,
  X,
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

type Taak = {
  id: string;
  type: string;
  categorie: string;
  titel: string;
  omschrijving: string;
  aangemaaktOp: string;
  actie: string;
  gegevens: Record<string, unknown>;
};

type TopbarProps = {
  gebruiker: TopbarGebruiker;
};

function formatteerDatum(datum: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
  }).format(new Date(datum));
}

function formatteerTijd(datum: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(datum));
}

export default function Topbar({
  gebruiker,
}: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [takenOpen, setTakenOpen] =
    useState(false);

  const [taken, setTaken] =
    useState<Taak[]>([]);

  const [
    takenLaden,
    setTakenLaden,
  ] = useState(false);

  const [
    taakBezig,
    setTaakBezig,
  ] = useState<string | null>(null);

  const [taakFout, setTaakFout] =
    useState<string | null>(null);

  const [
    uitloggenBezig,
    setUitloggenBezig,
  ] = useState(false);

  const menuRef =
    useRef<HTMLDivElement | null>(null);

  const takenRef =
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

  async function laadTaken(
    stil = false,
  ) {
    try {
      if (!stil) {
        setTakenLaden(true);
      }

      const response = await fetch(
        "/api/taken",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      if (Array.isArray(data)) {
        setTaken(data);
      }
    } catch (error) {
      console.error(
        "Fout bij ophalen taken:",
        error,
      );
    } finally {
      if (!stil) {
        setTakenLaden(false);
      }
    }
  }

  useEffect(() => {
    let actief = true;

    async function laadTakenEersteKeer() {
      if (!actief) {
        return;
      }

      await laadTaken();
    }

    void laadTakenEersteKeer();

    const interval =
      window.setInterval(() => {
        if (actief) {
          void laadTaken(true);
        }
      }, 30000);

    return () => {
      actief = false;
      window.clearInterval(
        interval,
      );
    };
  }, []);

  useEffect(() => {
    function sluitMenu(
      event: MouseEvent,
    ) {
      const target =
        event.target as Node;

      if (
        menuRef.current &&
        !menuRef.current.contains(
          target,
        )
      ) {
        setMenuOpen(false);
      }

      if (
        takenRef.current &&
        !takenRef.current.contains(
          target,
        )
      ) {
        setTakenOpen(false);
      }
    }

    if (
      menuOpen ||
      takenOpen
    ) {
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
  }, [
    menuOpen,
    takenOpen,
  ]);

  useEffect(() => {
    function escapeMenu(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setTakenOpen(false);
      }
    }

    if (
      menuOpen ||
      takenOpen
    ) {
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
  }, [
    menuOpen,
    takenOpen,
  ]);

  async function verwerkTaak(
    taak: Taak,
    actie:
      | "ACCEPTEREN"
      | "AFWIJZEN"
      | "GOEDKEUREN",
  ) {
    try {
      setTaakBezig(taak.id);
      setTaakFout(null);

      const ruilverzoekId =
        taak.gegevens
          .ruilverzoekId;

      if (
        typeof ruilverzoekId !==
        "string"
      ) {
        throw new Error(
          "Het ruilverzoek kon niet worden gevonden.",
        );
      }

      const response = await fetch(
        "/api/planning/ruilen",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            ruilverzoekId,
            actie,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De taak kon niet worden uitgevoerd.",
        );
      }

      setTaken(
        (huidigeTaken) =>
          huidigeTaken.filter(
            (huidigeTaak) =>
              huidigeTaak.id !==
              taak.id,
          ),
      );

      router.refresh();

      await laadTaken(true);
    } catch (error) {
      console.error(
        "Fout bij uitvoeren taak:",
        error,
      );

      setTaakFout(
        error instanceof Error
          ? error.message
          : "De taak kon niet worden uitgevoerd.",
      );
    } finally {
      setTaakBezig(null);
    }
  }

  async function handleLogout() {
    if (uitloggenBezig) {
      return;
    }

    setUitloggenBezig(true);

    try {
      const response =
        await fetch(
          "/api/logout",
          {
            method: "POST",
            credentials: "include",
          },
        );

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

  function bepaalActieLabel(
    taak: Taak,
  ) {
    switch (taak.actie) {
      case "RUIL_ACCEPTEREN":
        return "Accepteren";

      case "RUIL_GOEDKEUREN":
        return "Goedkeuren";

      default:
        return "Uitvoeren";
    }
  }

  function kanAccepteren(
    taak: Taak,
  ) {
    return (
      taak.actie ===
      "RUIL_ACCEPTEREN"
    );
  }

  function kanGoedkeuren(
    taak: Taak,
  ) {
    return (
      taak.actie ===
      "RUIL_GOEDKEUREN"
    );
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
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
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

        {/* Taken */}
        <div
          ref={takenRef}
          className="relative"
        >
          <button
            type="button"
            aria-label="Taken"
            aria-expanded={takenOpen}
            onClick={() => {
              setTakenOpen(
                (waarde) => !waarde,
              );
              setMenuOpen(false);
              setTaakFout(null);

              if (!takenOpen) {
                void laadTaken();
              }
            }}
            className={`relative rounded-xl p-3 transition ${
              takenOpen
                ? "bg-slate-100"
                : "hover:bg-slate-100"
            }`}
          >
            <Bell size={20} />

            {taken.length > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {taken.length > 9
                  ? "9+"
                  : taken.length}
              </span>
            )}
          </button>

          {takenOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-[390px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Header */}
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">
                      Taken
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Acties die nog uitgevoerd moeten worden
                    </p>
                  </div>

                  {taken.length > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600">
                      {taken.length} open
                    </span>
                  )}
                </div>
              </div>

              {/* Takenlijst */}
              <div className="max-h-[460px] overflow-y-auto">
                {takenLaden ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-500">
                    Taken laden...
                  </div>
                ) : taken.length ===
                  0 ? (
                  <div className="px-4 py-10 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                      <Check
                        size={20}
                        className="text-green-600"
                      />
                    </div>

                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Alles gedaan
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Er staan geen openstaande taken.
                    </p>
                  </div>
                ) : (
                  taken.map((taak) => {
                    const datum =
                      typeof taak
                        .gegevens
                        .datum ===
                      "string"
                        ? taak
                            .gegevens
                            .datum
                        : null;

                    const begintijd =
                      typeof taak
                        .gegevens
                        .begintijd ===
                      "string"
                        ? taak
                            .gegevens
                            .begintijd
                        : null;

                    const eindtijd =
                      typeof taak
                        .gegevens
                        .eindtijd ===
                      "string"
                        ? taak
                            .gegevens
                            .eindtijd
                        : null;

                    const bezig =
                      taakBezig ===
                      taak.id;

                    return (
                      <div
                        key={taak.id}
                        className="border-b border-slate-100 px-4 py-4 last:border-b-0"
                      >
                        <div className="flex gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                            <Bell
                              size={16}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {taak.titel}
                                </p>

                                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                  {
                                    taak.categorie
                                  }
                                </p>
                              </div>

                              <span className="shrink-0 text-[10px] text-slate-400">
                                {formatteerDatum(
                                  taak.aangemaaktOp,
                                )}
                              </span>
                            </div>

                            <p className="mt-2 text-xs leading-5 text-slate-600">
                              {taak.omschrijving}
                            </p>

                            {datum && (
                              <p className="mt-2 text-xs text-slate-500">
                                {formatteerDatum(
                                  datum,
                                )}
                                {begintijd &&
                                  ` · ${formatteerTijd(
                                    begintijd,
                                  )}`}
                                {eindtijd &&
                                  ` – ${formatteerTijd(
                                    eindtijd,
                                  )}`}
                              </p>
                            )}

                            {taakFout &&
                              bezig && (
                                <p className="mt-2 text-xs font-medium text-red-600">
                                  {taakFout}
                                </p>
                              )}

                            <div className="mt-3 flex flex-wrap gap-2">
                              {kanAccepteren(
                                taak,
                              ) && (
                                <button
                                  type="button"
                                  disabled={
                                    bezig
                                  }
                                  onClick={() =>
                                    void verwerkTaak(
                                      taak,
                                      "ACCEPTEREN",
                                    )
                                  }
                                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {bezig
                                    ? "Bezig..."
                                    : bepaalActieLabel(
                                        taak,
                                      )}
                                </button>
                              )}

                              {kanGoedkeuren(
                                taak,
                              ) && (
                                <button
                                  type="button"
                                  disabled={
                                    bezig
                                  }
                                  onClick={() =>
                                    void verwerkTaak(
                                      taak,
                                      "GOEDKEUREN",
                                    )
                                  }
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {bezig
                                    ? "Bezig..."
                                    : bepaalActieLabel(
                                        taak,
                                      )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profielmenu */}
        <div
          ref={menuRef}
          className="relative"
        >
          <button
            type="button"
            aria-label="Profielmenu"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen(
                (waarde) => !waarde,
              );
              setTakenOpen(false);
            }}
            className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-slate-100"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C7E5E5] text-sm font-bold text-slate-700">
              {initialen}
            </div>

            <div className="hidden text-left md:block">
              <p className="text-sm font-semibold text-slate-900">
                {gebruiker.naam}
              </p>

              <p className="text-xs text-slate-500">
                {eersteRol}
              </p>
            </div>

            <ChevronDown
              size={16}
              className={`hidden text-slate-400 transition-transform md:block ${
                menuOpen
                  ? "rotate-180"
                  : ""
              }`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-100 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">
                  {gebruiker.naam}
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  {eersteRol}
                </p>
              </div>

              <div className="p-2">
                <Link
                  href="/profiel"
                  onClick={() =>
                    setMenuOpen(false)
                  }
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <User size={17} />
                  Mijn profiel
                </Link>

                <button
                  type="button"
                  disabled={
                    uitloggenBezig
                  }
                  onClick={() =>
                    void handleLogout()
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut size={17} />
                  {uitloggenBezig
                    ? "Uitloggen..."
                    : "Uitloggen"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
