import Logo from "./Logo";
import Navigation from "./Navigation";

import { app } from "@/lib/app";
import { theme } from "@/lib/theme";

export default function Sidebar() {
  return (
    <aside
      className="hidden h-screen flex-col lg:flex"
      style={{
        width: theme.layout.sidebarWidth,
        background: `linear-gradient(180deg,
          ${theme.colors.sidebar.background} 0%,
          ${theme.colors.sidebar.secondary} 100%)`,
      }}
    >
      <div className="px-7 pt-8 pb-6">
        <Logo />
      </div>

      <div className="px-5">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "rgba(255,255,255,.08)",
            backdropFilter: "blur(12px)",
          }}
        >
          <p
            className="text-xs uppercase tracking-[0.18em]"
            style={{
              color: theme.colors.sidebar.muted,
            }}
          >
            Actieve vestiging
          </p>

          <h3
            className="mt-2 text-lg font-semibold"
            style={{
              color: theme.colors.sidebar.text,
            }}
          >
            {app.defaultVestiging}
          </h3>

          <p
            className="mt-1 text-sm"
            style={{
              color: theme.colors.sidebar.muted,
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
            background: "rgba(255,255,255,.06)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold"
              style={{
                background: theme.colors.primary,
                color: "#1F2937",
              }}
            >
              B
            </div>

            <div className="flex-1">
              <p
                className="font-semibold"
                style={{
                  color: theme.colors.sidebar.text,
                }}
              >
                Bram Derks
              </p>

              <p
                className="text-sm"
                style={{
                  color: theme.colors.sidebar.muted,
                }}
              >
                Super Admin
              </p>
            </div>
          </div>

          <div
            className="mt-4 pt-4 text-xs"
            style={{
              borderTop: "1px solid rgba(255,255,255,.08)",
              color: theme.colors.sidebar.muted,
            }}
          >
            <div className="flex justify-between">
              <span>Versie</span>

              <strong>{app.version}</strong>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}