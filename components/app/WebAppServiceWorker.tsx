"use client";

import { useEffect } from "react";

export default function WebAppServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((error) => {
        console.error(
          "Clevers service worker kon niet worden geregistreerd:",
          error,
        );
      });
  }, []);

  return null;
}
