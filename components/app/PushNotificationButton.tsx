"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

function base64UrlNaarUint8Array(waarde: string) {
  const padding = "=".repeat((4 - (waarde.length % 4)) % 4);
  const base64 = (waarde + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (karakter) => karakter.charCodeAt(0));
}

export default function PushNotificationButton() {
  const [ondersteund, setOndersteund] = useState(false);
  const [toestemming, setToestemming] =
    useState<NotificationPermission | "unknown">("unknown");
  const [testBezig, setTestBezig] = useState(false);
  const [testMelding, setTestMelding] = useState<string | null>(null);

  useEffect(() => {
    const beschikbaar =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setOndersteund(beschikbaar);

    if (beschikbaar) {
      setToestemming(Notification.permission);
    }
  }, []);

  async function subscriptionOpslaan() {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      throw new Error("VAPID public key ontbreekt.");
    }

    const registratie = await navigator.serviceWorker.ready;

    const bestaandeSubscription =
      await registratie.pushManager.getSubscription();

    const subscription =
      bestaandeSubscription ??
      (await registratie.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlNaarUint8Array(vapidPublicKey),
      }));

    const response = await fetch("/api/push/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      throw new Error("Push subscription kon niet worden opgeslagen.");
    }
  }

  async function schakelIn() {
    if (!ondersteund) return;

    try {
      const resultaat = await Notification.requestPermission();

      setToestemming(resultaat);

      if (resultaat !== "granted") return;

      await subscriptionOpslaan();
    } catch (error) {
      console.error("Clevers pushmeldingen konden niet worden ingesteld:", error);
    }
  }

  if (!ondersteund || toestemming === "denied") {
    return null;
  }

  async function testPush() {
    if (testBezig) return;

    setTestBezig(true);
    setTestMelding(null);

    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.fout ?? "Testmelding kon niet worden verstuurd.");
      }

      setTestMelding("Testmelding verstuurd.");
    } catch (error) {
      setTestMelding(
        error instanceof Error
          ? error.message
          : "Testmelding kon niet worden verstuurd.",
      );
    } finally {
      setTestBezig(false);
    }
  }

  if (toestemming === "granted") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          <Bell size={15} />
          Meldingen toegestaan
        </span>

        <button
          type="button"
          onClick={() => void testPush()}
          disabled={testBezig}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm disabled:cursor-wait disabled:opacity-60"
        >
          <Bell size={15} />
          {testBezig ? "Testen..." : "Test pushmelding"}
        </button>

        {testMelding && (
          <span className="text-xs text-slate-500">{testMelding}</span>
        )}
      </div>
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
