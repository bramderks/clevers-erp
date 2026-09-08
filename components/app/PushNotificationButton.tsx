"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

export default function PushNotificationButton() {
  const [ondersteund, setOndersteund] = useState(false);
  const [toestemming, setToestemming] =
    useState<NotificationPermission | "unknown">("unknown");

  useEffect(() => {
    const beschikbaar =
      "Notification" in window &&
      "serviceWorker" in navigator;

    setOndersteund(beschikbaar);

    if (beschikbaar) {
      setToestemming(Notification.permission);
    }
  }, []);

  async function schakelIn() {
    if (!ondersteund) return;

    const resultaat =\n      await Notification.requestPermission();\n\n    setToestemming(resultaat);\n\n    if (resultaat !== "granted") return;\n\n    const registratie =\n      await navigator.serviceWorker.ready;\n\n    const subscription =\n      await registratie.pushManager.subscribe({\n        userVisibleOnly: true,\n        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,\n      });\n\n    await fetch("/api/push/subscription", {\n      method: "POST",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify(subscription),\n    });
  }

  if (!ondersteund || toestemming === "denied") {
    return null;
  }

  if (toestemming === "granted") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
        <Bell size={15} />
        Meldingen toegestaan
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={schakelIn}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
    >
      <BellOff size={15} />
      Meldingen inschakelen
    </button>
  );
}
