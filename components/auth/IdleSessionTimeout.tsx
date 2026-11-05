"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_KEY = "clevers:last-activity";
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

export default function IdleSessionTimeout() {
  const router = useRouter();

  useEffect(() => {
    let logoutTimer: ReturnType<typeof setTimeout> | undefined;
    let lastHeartbeat = 0;
    let loggingOut = false;

    const getLastActivity = () => {
      const stored = Number(window.localStorage.getItem(ACTIVITY_KEY));
      return Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    };

    const logoutForInactivity = async () => {
      if (loggingOut) return;
      loggingOut = true;
      try {
        await fetch("/api/logout", { method: "POST", cache: "no-store" });
      } finally {
        router.replace("/login?reason=timeout");
        router.refresh();
      }
    };

    const scheduleLogout = () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      const remaining = TIMEOUT_MS - (Date.now() - getLastActivity());
      if (remaining <= 0) {
        void logoutForInactivity();
        return;
      }
      logoutTimer = setTimeout(() => void logoutForInactivity(), remaining);
    };

    const registerActivity = () => {
      const now = Date.now();
      window.localStorage.setItem(ACTIVITY_KEY, String(now));
      scheduleLogout();

      if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeat = now;
        void fetch("/api/session/activity", {
          method: "POST",
          cache: "no-store",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }).then((response) => {
          if (response.status === 401) void logoutForInactivity();
        }).catch(() => {
          // De lokale time-out blijft actief wanneer de verbinding tijdelijk wegvalt.
        });
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACTIVITY_KEY) scheduleLogout();
    };

    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    events.forEach((event) => window.addEventListener(event, registerActivity, { passive: true }));
    window.addEventListener("storage", handleStorage);
    scheduleLogout();

    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      events.forEach((event) => window.removeEventListener(event, registerActivity));
      window.removeEventListener("storage", handleStorage);
    };
  }, [router]);

  return null;
}
