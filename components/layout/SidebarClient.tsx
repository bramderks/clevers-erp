"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import Logo from "./Logo";
import Navigation from "./Navigation";

import { app } from "@/lib/app";
import { theme } from "@/lib/theme";

type SidebarClientProps = {
  naam: string;
  rol: string;
  initialen: string;
  permissions: string[];
  isEigenaar: boolean;
  isTeamleider?: boolean;
  isMedewerker?: boolean;
};

export default function SidebarClient({
  naam,
  rol,
  initialen,
  permissions,
  isEigenaar,
  isTeamleider = false,
  isMedewerker = false,
}: SidebarClientProps) {
  const [hovered, setHovered] =
    useState(false);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const gebruikerstype =
    isEigenaar
      ? "Eigenaar"
      : isTeamleider
        ? "Teamleider"
        : isMedewerker
          ? "Medewerker"
          : rol;

  useEffect(() => {
    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    if (mobileOpen) {
      document.addEventListener(
        "keydown",
        handleEscape,
      );

      const oorspronkelijkeOverflow =
        document.body.style.overflow;

      document.body.style.overflow =
        "hidden";

      return () => {
        document.removeEventListener(
          "keydown",
          handleEscape,
        );

        document.body.style.overflow =
          oorspronkelijkeOverflow;
      };
    }

    return undefined;
  }, [mobileOpen]);

  return (
    <>
      {/* =========================================================
       * MOBIELE NAVIGATIE
       * ======================================================= */}

      <button
        type="button"
        aria-label={
          mobileOpen
            ? "Navigatiemenu sluiten"
            : "Navigatiemenu openen"
        }
        aria-expanded={mobileOpen}
        aria-controls="mobiele-navigatie"
        onClick={() =>
          setMobileOpen(
            (waarde) => !waarde,
          )
        }
        className="fixed bottom-5 left-5 z-[70] flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-2xl transition hover:bg-slate-800 active:scale-95 lg:hidden"
      >
        {mobileOpen ? (
          <X size={25} />
        ) : (
          <Menu size={25} />
        )}
      </button>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Navigatiemenu sluiten"
            onClick={() =>
              setMobileOpen(false)
            }
            className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-[1px] lg:hidden"
          />

          <aside
            id="mobiele-navigatie"
            aria-label="Hoofdnavigatie"
            className="fixed inset-y-0 left-0 z-[65] flex w-[min(340px,calc(100vw-44px))] flex-col overflow-hidden bg-slate-950 shadow-2xl lg:hidden"
          >
            <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-white/10 px-5">
              <Logo />

              <button
                type="button"
                aria-label="Navigatiemenu sluiten"
                onClick={() =>
                  setMobileOpen(false)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
              <Navigation
                permissions={permissions}
                isEigenaar={isEigenaar}
                isMedewerker={isMedewerker}
                ingeklapt={false}
                onNavigate={() =>
                  setMobileOpen(false)
                }
              />
            </div>

            <div className="shrink-0 border-t border-white/10 p-5">
              <div
                className="rounded-2xl p-4"
                style={{
                  background:
                    "rgba(255,255,255,.06)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold"
                    style={{
                      background:
                        theme.colors.primary,
                      color: "#1F2937",
                    }}
                  >
                    {initialen}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate font-semibold"
                      style={{
                        color:
                          theme.colors.sidebar
                            .text,
                      }}
                    >
                      {naam}
                    </p>

                    <p
                      className="truncate text-sm"
                      style={{
                        color:
                          theme.colors.sidebar
                            .muted,
                      }}
                    >
                      {gebruikerstype}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-4 flex justify-between border-t pt-4 text-xs"
                  style={{
                    borderColor:
                      "rgba(255,255,255,.08)",
                    color:
                      theme.colors.sidebar
                        .muted,
                  }}
                >
                  <span>
                    Versie
                  </span>

                  <strong>
                    {app.version}
                  </strong>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* =========================================================
       * DESKTOP SIDEBAR
       * ======================================================= */}

      <div
        className="hidden w-[82px] shrink-0 lg:block"
        aria-hidden="true"
      />

      <aside
        className="fixed inset-y-0 left-0 z-50 hidden lg:block"
        onMouseEnter={() =>
          setHovered(true)
        }
        onMouseLeave={() =>
          setHovered(false)
        }
      >
        <div
          className="flex h-screen flex-col overflow-hidden border-r border-white/5 shadow-xl"
          style={{
            width: hovered
              ? theme.layout.sidebarWidth
              : 82,
            background:
              "linear-gradient(180deg, #17202B 0%, #111827 100%)",
            transition:
              "width 180ms ease",
          }}
        >
          <div
            className={`flex h-[76px] shrink-0 items-center ${
              hovered
                ? "px-5"
                : "justify-center px-3"
            }`}
          >
            <Logo
              compact={!hovered}
            />
          </div>

          <div
            className={`min-h-0 flex-1 overflow-y-auto ${
              hovered
                ? "mt-6 px-5"
                : "mt-6 px-3"
            }`}
          >
            <Navigation
              permissions={permissions}
              isEigenaar={isEigenaar}
              isMedewerker={isMedewerker}
              ingeklapt={!hovered}
            />
          </div>

          <div
            className={`shrink-0 pb-6 ${
              hovered
                ? "px-5"
                : "px-3"
            }`}
          >
            <div
              className={`rounded-2xl transition-all ${
                hovered
                  ? "p-4"
                  : "flex justify-center p-3"
              }`}
              style={{
                background:
                  "rgba(255,255,255,.06)",
              }}
              title={
                hovered
                  ? undefined
                  : naam
              }
            >
              <div
                className={`flex items-center ${
                  hovered
                    ? "gap-3"
                    : "justify-center"
                }`}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold"
                  style={{
                    background:
                      theme.colors.primary,
                    color: "#1F2937",
                  }}
                >
                  {initialen}
                </div>

                {hovered && (
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate font-semibold"
                      style={{
                        color:
                          theme.colors.sidebar
                            .text,
                      }}
                    >
                      {naam}
                    </p>

                    <p
                      className="truncate text-sm"
                      style={{
                        color:
                          theme.colors.sidebar
                            .muted,
                      }}
                    >
                      {gebruikerstype}
                    </p>
                  </div>
                )}
              </div>

              {hovered && (
                <div
                  className="mt-4 border-t pt-4 text-xs"
                  style={{
                    borderColor:
                      "rgba(255,255,255,.08)",
                    color:
                      theme.colors.sidebar
                        .muted,
                  }}
                >
                  <div className="flex justify-between">
                    <span>
                      Versie
                    </span>

                    <strong>
                      {app.version}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}