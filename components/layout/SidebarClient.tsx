"use client";

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

  const gebruikerstype =
    isEigenaar
      ? "Eigenaar"
      : isTeamleider
        ? "Teamleider"
        : isMedewerker
          ? "Medewerker"
          : rol;

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
          <Logo
            compact={!hovered}
          />
        </div>

        {/* Navigatie */}
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
              {/* Initialen */}
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

              {/* Naam + rol */}
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
                    {gebruikerstype}
                  </p>
                </div>
              )}
            </div>

            {/* Versie */}
            {hovered && (
              <div
                className="mt-4 border-t pt-4 text-xs"
                style={{
                  borderColor:
                    "rgba(255,255,255,.08)",
                  color:
                    theme.colors
                      .sidebar
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