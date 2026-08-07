import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
  IceCreamCone,
} from "lucide-react";

export const navigation = [
  {
    group: "Algemeen",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
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
      },
      {
        title: "Planning",
        href: "/planning",
        icon: CalendarDays,
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
      },
      {
        title: "Voorraad",
        href: "/voorraad",
        icon: Boxes,
      },
      {
        title: "Bestellingen",
        href: "/bestellingen",
        icon: ShoppingCart,
      },
      {
        title: "Leveringen",
        href: "/leveringen",
        icon: Truck,
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
      },
    ],
  },

  {
    group: "Beheer",
    items: [
      {
        title: "Instellingen",
        href: "/instellingen",
        icon: Settings,
      },
    ],
  },
] as const;