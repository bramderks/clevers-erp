import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardClock,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
  Building2,
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
        title: "Mijn beschikbaarheid",
        href: "/profiel/beschikbaarheid",
        icon: ClipboardClock,
        permission: permissions.planning.view,
        medewerkerOnly: true,
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
        title: "Instellingen",
        href: "/instellingen",
        icon: Settings,
        permission: permissions.instellingen.view,
      },
    ],
  },
] as const;