import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clevers",
    short_name: "Clevers",
    description: "Clevers medewerkers-app",
    start_url: "/app",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#0f172a",
    lang: "nl",
  };
}
