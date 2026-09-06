"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigation } from "@/lib/navigation";
import { theme } from "@/lib/theme";

type NavigationIcon = ComponentType<{
  size?: number;
  className?: string;
}>;

type NavigationItem = {
  title: string;
  href: string;
  icon: NavigationIcon;
  permission?: string;
  ownerOnly?: boolean;
  medewerkerOnly?: boolean;
};

type NavigationGroup = {
  group: string;
  items: readonly NavigationItem[];
};

type NavigationProps = {
  permissions: string[];
  isEigenaar: boolean;
  isMedewerker?: boolean;
  ingeklapt: boolean;
};

export default function Navigation({
  permissions,
  isEigenaar,
  isMedewerker = false,
  ingeklapt,
}: NavigationProps) {
  const pathname = usePathname();

  function heeftToegang(
    item: NavigationItem,
  ) {
    /*
     * Beschikbaarheid is alleen bedoeld voor
     * teamleiders en medewerkers.
     *
     * Een eigenaar beheert de planning en
     * hoeft zelf geen beschikbaarheid op te geven.
     */
    if (
      item.href ===
        "/profiel/beschikbaarheid" &&
      isEigenaar
    ) {
      return false;
    }

    if (item.ownerOnly) {
      return isEigenaar;
    }

    if (item.medewerkerOnly && !isMedewerker) {
      return false;
    }

    if (!item.permission) {
      return true;
    }

    return permissions.includes(
      item.permission,
    );
  }

  return (
    <div className="space-y-7">
      {(navigation as readonly NavigationGroup[]).map(
        (group) => {
          const zichtbareItems =
            group.items.filter(
              (item) =>
                heeftToegang(item),
            );

          if (
            zichtbareItems.length === 0
          ) {
            return null;
          }

          return (
            <section
              key={group.group}
            >
              {!ingeklapt && (
                <h3
                  className="mb-3 px-4 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{
                    color:
                      theme.colors
                        .sidebar
                        .group,
                  }}
                >
                  {group.group}
                </h3>
              )}

              <nav className="space-y-1.5">
                {zichtbareItems.map(
                  (item) => {
                    const Icon =
                      item.icon;

                    const active =
                      pathname ===
                        item.href ||
                      pathname.startsWith(
                        `${item.href}/`,
                      );

                    return (
                      <Link
                        key={
                          item.href
                        }
                        href={
                          item.href
                        }
                        title={
                          ingeklapt
                            ? item.title
                            : undefined
                        }
                        className={`group flex items-center rounded-xl py-3 transition-all duration-200 ${
                          ingeklapt
                            ? "justify-center px-2"
                            : "gap-3 px-4"
                        }`}
                        style={{
                          background:
                            active
                              ? theme
                                  .colors
                                  .sidebar
                                  .activeBackground
                              : "transparent",
                          color:
                            active
                              ? theme
                                  .colors
                                  .sidebar
                                  .activeText
                              : theme
                                  .colors
                                  .sidebar
                                  .text,
                        }}
                      >
                        <div
                          className="h-6 w-1 shrink-0 rounded-full transition-all"
                          style={{
                            background:
                              active
                                ? theme
                                    .colors
                                    .primary
                                : "transparent",
                          }}
                        />

                        <Icon
                          size={20}
                        />

                        {!ingeklapt && (
                          <span className="flex-1 text-sm font-medium">
                            {
                              item.title
                            }
                          </span>
                        )}
                      </Link>
                    );
                  },
                )}
              </nav>
            </section>
          );
        },
      )}
    </div>
  );
}