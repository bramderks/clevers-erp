import Logo from "./Logo";
import Navigation from "./Navigation";

import { app } from "@/lib/app";
import { theme } from "@/lib/theme";
import { getCurrentUser } from "@/lib/auth";

export default async function Sidebar() {
  const gebruiker =
    await getCurrentUser();

  const naam =
    gebruiker?.naam ?? "Gast";

  const rol =
    gebruiker?.rollen[0]?.rol.naam ??
    "Gebruiker";

  const initialen =
    naam
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((deel) =>
        deel.charAt(0).toUpperCase(),
      )
      .join("") || "G";

  return (
    <aside
      className="hidden h-screen flex-col lg:flex"
      style={{
        width: theme.layout.sidebarWidth,
        background: `linear-gradient(
          180deg,
          ${theme.colors.sidebar.background} 0%,
          ${theme.colors.sidebar.secondary} 100%
        )`,
      }}
    >
      <div className="px-5">
        <Logo />

        <div
          className="mt-5 rounded-2xl p-5"
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
                theme.colors.sidebar.muted,
            }}
          >
            Actieve vestiging
          </p>

          <h3
            className="mt-2 text-lg font-semibold"
            style={{
              color:
                theme.colors.sidebar.text,
            }}
          >
            {app.defaultVestiging}
          </h3>

          <p
            className="mt-1 text-sm"
            style={{
              color:
                theme.colors.sidebar.muted,
            }}
          >
            Clevers IJsbar
          </p>
        </div>
      </div>

      <div className="mt-8 flex-1 overflow-y-auto px-5">
        <Navigation />
      </div>

      <div className="px-5 pb-6">
        <div
          className="rounded-2xl p-4"
          style={{
            background:
              "rgba(255,255,255,.06)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold"
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
                    theme.colors.sidebar.text,
                }}
              >
                {naam}
              </p>

              <p
                className="truncate text-sm"
                style={{
                  color:
                    theme.colors.sidebar.muted,
                }}
              >
                {rol}
              </p>
            </div>
          </div>

          <div
            className="mt-4 border-t pt-4 text-xs"
            style={{
              borderColor:
                "rgba(255,255,255,.08)",
              color:
                theme.colors.sidebar.muted,
            }}
          >
            <div className="flex justify-between">
              <span>Versie</span>

              <strong>
                {app.version}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}