"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

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
};

export default function SidebarClient({
  naam,
  rol,
  initialen,
  permissions,
  isEigenaar,
}: SidebarClientProps) {
  const pathname = usePathname();

  const [hovered, setHovered] =
    useState(false);

  return (
    <aside
      className="relative z-50 hidden h-screen w-[82px] shrink-0 lg:block"
      onMouseEnter={() =>
        setHovered(true)
      }
      onMouseLeave={() =>
        setHovered(false)
      }
    >
      <div
        className="absolute left-0 top-0 flex h-screen flex-col overflow-hidden border-r border-white/5 shadow-xl"
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
        {/* Logo */}
        <div
          className={`flex h-[76px] shrink-0 items-center ${
            hovered
              ? "px-5"
              : "justify-center px-3"
          }`}
        >
          <div
            className={`overflow-hidden ${
              hovered
                ? "w-full"
                : "w-[42px]"
            }`}
          >
            <Logo />
          </div>
        </div>

        {/* Actieve vestiging */}
        <div
          className={`shrink-0 transition-all duration-150 ${
            hovered
              ? "mx-4 opacity-100"
              : "mx-3 h-0 overflow-hidden opacity-0"
          }`}
        >
          <div
            className="rounded-2xl p-5"
            style={{
              background:
                "rgba(255,255,255,.08)",
              backdropFilter:
                "blur(12px)",
            }}
          >
            <p
              className="text-xs uppercase tracking-[0.18em]"
              style={{
                color:
                  theme.colors.sidebar
                    .muted,
              }}
            >
              Actieve vestiging
            </p>

            <h3
              className="mt-2 text-lg font-semibold"
              style={{
                color:
                  theme.colors.sidebar
                    .text,
              }}
            >
              {app.defaultVestiging}
            </h3>

            <p
              className="mt-1 text-sm"
              style={{
                color:
                  theme.colors.sidebar
                    .muted,
              }}
            >
              Clevers IJsbar
            </p>
          </div>
        </div>

        {/* Navigatie */}
        <div
          className={`mt-8 flex-1 overflow-y-auto ${
            hovered
              ? "px-5"
              : "px-3"
          }`}
        >
          <Navigation
            permissions={
              permissions
            }
            isEigenaar={
              isEigenaar
            }
            ingeklapt={!hovered}
          />
        </div>

        {/* Gebruiker */}
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
                    theme.colors
                      .primary,
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
                        theme.colors
                          .sidebar
                          .text,
                    }}
                  >
                    {naam}
                  </p>

                  <p
                    className="truncate text-sm"
                    style={{
                      color:
                        theme.colors
                          .sidebar
                          .muted,
                    }}
                  >
                    {rol}
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
  );
}