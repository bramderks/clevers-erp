"use client";

import { useEffect, useState, type ReactNode } from "react";

type Props = {
  storageKey: string;
  title: string;
  description?: string;
  count?: number;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
};

export default function DashboardCollapsibleCard({
  storageKey,
  title,
  description,
  count,
  children,
  className = "",
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    try {
      const opgeslagen = window.localStorage.getItem(
        `clevers-dashboard-card:${storageKey}`,
      );
      if (opgeslagen !== null) {
        setOpen(opgeslagen !== "closed");
      }
    } catch {
      // De kaart blijft bruikbaar als localStorage niet beschikbaar is.
    } finally {
      setGeladen(true);
    }
  }, [storageKey]);

  function toggle() {
    const nieuweStatus = !open;
    setOpen(nieuweStatus);

    try {
      window.localStorage.setItem(
        `clevers-dashboard-card:${storageKey}`,
        nieuweStatus ? "open" : "closed",
      );
    } catch {
      // Geen probleem: alleen het onthouden van de voorkeur mislukt.
    }
  }

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`dashboard-card-${storageKey}`}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50/70"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {typeof count === "number" && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {count}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>

        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ↓
        </span>
      </button>

      <div
        id={`dashboard-card-${storageKey}`}
        hidden={!open}
        className={geladen || open ? "" : "hidden"}
      >
        <div className="border-t border-slate-200 p-6">
          {children}
        </div>
      </div>
    </section>
  );
}
