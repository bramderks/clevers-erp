export const theme = {
  app: {
    name: "Clevers ERP",
    subtitle: "Professioneel beheer voor ijssalons",
  },

  colors: {
    primary: "#A8D8D8",
    primaryHover: "#8FCFD0",
    primaryLight: "#EAF7F7",

    sidebar: {
      background: "#475569",
      secondary: "#526173",
      hover: "#5E7085",
      border: "#64748B",

      text: "#F8FAFC",
      muted: "#CBD5E1",

      activeBackground: "#FFFFFF",
      activeText: "#1F2937",

      group: "#E2E8F0",
    },

    background: "#F8FAFC",

    card: "#FFFFFF",

    border: "#E2E8F0",

    text: {
      primary: "#1F2937",
      secondary: "#64748B",
      light: "#94A3B8",
    },

    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#0EA5E9",
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },

  layout: {
    sidebarWidth: 290,
    topbarHeight: 76,
    pagePadding: 32,
  },
} as const;