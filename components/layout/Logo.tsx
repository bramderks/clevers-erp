import Link from "next/link";

import { app } from "@/lib/app";
import { theme } from "@/lib/theme";

type LogoProps = {
  compact?: boolean;
};

export default function Logo({
  compact = false,
}: LogoProps) {
  if (compact) {
    return (
      <Link
        href="/dashboard"
        className="flex h-12 w-12 items-center justify-center rounded-2xl transition hover:scale-105"
        style={{
          background: theme.colors.primary,
        }}
      >
        <span
          className="text-xl font-bold"
          style={{
            color: theme.colors.text.primary,
          }}
        >
          C
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-4"
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-md"
        style={{
          background: theme.colors.primary,
        }}
      >
        <span
          className="text-2xl font-bold"
          style={{
            color: theme.colors.text.primary,
          }}
        >
          C
        </span>
      </div>

      <div>
        <h1
          className="text-xl font-bold tracking-tight"
          style={{
            color: theme.colors.sidebar.text,
          }}
        >
          {app.name}
        </h1>

        <p
          className="text-sm"
          style={{
            color: theme.colors.sidebar.muted,
          }}
        >
          voor Clevers {app.defaultVestiging}
        </p>
      </div>
    </Link>
  );
}