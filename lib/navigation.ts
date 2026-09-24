import {
  LayoutDashboard,
  UserRound,
  Users,
  CalendarDays,
  ClipboardClock,
  WalletCards,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
  Building2,
  ScrollText,
} from "lucide-react";

import { permissions } from "@/lib/permissions";

export const navigation = [
  {
    group: "Algemeen",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: permissions.dashboard.view,
      },
      {
        title: "Mijn profiel",
        href: "/profiel",
        icon: UserRound,
        medewerkerOnly: true,
      },
    ],
  },

  {
    group: "Personeel",
    items: [
      {
        title: "Medewerkers",
        href: "/medewerkers",
        icon: Users,
        permission: permissions.medewerkers.view,
      },

      {
        title: "Planning",
        href: "/planning",
        icon: CalendarDays,
        permission: permissions.planning.view,
      },

      {
        title: "Open diensten",
        href: "/planning/open-diensten",
        icon: ClipboardClock,
        ownerOnly: true,
      },

      {
        title: "Mijn beschikbaarheid",
        href: "/profiel/beschikbaarheid",
        icon: ClipboardClock,
        medewerkerOnly: true,
      },

      {
        title: "Mijn verloning",
        href: "/mijn-verloning",
        icon: WalletCards,
        medewerkerOnly: true,
      },

      {
        title: "Verloning",
        href: "/verloning",
        icon: WalletCards,
        ownerOnly: true,
      },
    ],
  },

  {
    group: "Voorraad",
    items: [
      {
        title: "Producten",
        href: "/producten",
        icon: Package,
        permission: permissions.producten.view,
      },

      {
        title: "Voorraad",
        href: "/voorraad",
        icon: Boxes,
        permission: permissions.voorraad.view,
      },

      {
        title: "Bestellingen",
        href: "/bestellingen",
        icon: ShoppingCart,
        permission: permissions.bestellingen.view,
      },

      {
        title: "Leveringen",
        href: "/leveringen",
        icon: Truck,
        permission: permissions.leveringen.view,
      },
    ],
  },

  {
    group: "Analyse",
    items: [
      {
        title: "Rapportages",
        href: "/rapportages",
        icon: BarChart3,
        permission: permissions.rapportages.view,
      },
    ],
  },

  {
    group: "Beheer",
    items: [
      {
        title: "Vestigingen",
        href: "/vestigingen",
        icon: Building2,
        ownerOnly: true,
      },

      {
        title: "Auditlog",
        href: "/audit",
        icon: ScrollText,
        ownerOnly: true,
      },

      {
        title: "Instellingen",
        href: "/instellingen",
        icon: Settings,
        permission: permissions.instellingen.view,
      },
    ],
  },
] as const;