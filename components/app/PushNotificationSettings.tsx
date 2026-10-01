"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

function base64UrlNaarUint8Array(waarde: string) {
  const padding = "=".repeat((4 - (waarde.length % 4)) % 4);
  const base64 = (waarde + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (karakter) => karakter.charCodeAt(0));
}

export default function PushNotificationSettings() {
  const [ondersteund, setOndersteund] = useState(false);
  const [toestemming, setToestemming] =
    useState<NotificationPermission | "unknown">("unknown");
  const [ingeschakeld, setIngeschakeld] = useState(false);
  const [bezig, setBezig] = useState(true);
  const [melding, setMelding] = useState<string | null>(null);
  const [testBezig, setTestBezig] = useState(false);
  const [emailAan, setEmailAan] = useState(true);
  const [emailBezig, setEmailBezig] = useState(true);

  useEffect(() => {
    async function laad() {
      const beschikbaar =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      setOndersteund(beschikbaar);

      try {
        const emailResponse = await fetch("/api/instellingen/meldingen", { credentials: "include" });
        if (emailResponse.ok) {
          const emailData = await emailResponse.json();
          setEmailAan(emailData.emailMeldingenAan !== false);
        }
      } finally {
        setEmailBezig(false);
      }

      if (!beschikbaar) {
        setBezig(false);
        return;
      }

      const huidigeToestemming = Notification.permission;
      setToestemming(huidigeToestemming);

      if (huidigeToestemming === "granted") {
        const registratie = await navigator.serviceWorker.ready;
        const subscription =
          await registratie.pushManager.getSubscription();
        setIngeschakeld(Boolean(subscription));
      }

      setBezig(false);
    }

    void laad();
  }, []);

  async function inschakelen() {
    if (!ondersteund || bezig) return;

    setBezig(true);
    setMelding(null);

    try {
      const resultaat = await Notification.requestPermission();
      setToestemming(resultaat);

      if (resultaat !== "granted") {
        setMelding(
          resultaat === "denied"
            ? "Meldingen zijn door je browser geblokkeerd. Je kunt dit aanpassen in de browserinstellingen."
            : "Toestemming voor meldingen is niet gegeven.",
        );
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("VAPID public key ontbreekt.");
      }

      const registratie = await navigator.serviceWorker.ready;
      const bestaande =
        await registratie.pushManager.getSubscription();

      const subscription =
        bestaande ??
        (await registratie.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            base64UrlNaarUint8Array(vapidPublicKey),
        }));

      const response = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error("Pushmeldingen konden niet worden opgeslagen.");
      }

      setIngeschakeld(true);
      setMelding("Meldingen zijn ingeschakeld op dit apparaat.");
    } catch (error) {
      setMelding(
        error instanceof Error
          ? error.message
          : "Meldingen konden niet worden ingeschakeld.",
      );
    } finally {
      setBezig(false);
    }
  }

  async function uitschakelen() {
    if (!ondersteund || bezig) return;

    setBezig(true);
    setMelding(null);

    try {
      const registratie = await navigator.serviceWorker.ready;
      const subscription =
        await registratie.pushManager.getSubscription();

      if (subscription) {
        const response = await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        if (!response.ok) {
          throw new Error("Pushmeldingen konden niet worden uitgeschakeld.");
        }

        await subscription.unsubscribe();
      }

      setIngeschakeld(false);
      setMelding("Meldingen zijn uitgeschakeld op dit apparaat.");
    } catch (error) {
      setMelding(
        error instanceof Error
          ? error.message
          : "Meldingen konden niet worden uitgeschakeld.",
      );
    } finally {
      setBezig(false);
    }
  }

  async function wijzigEmailMeldingen() {
    const nieuweWaarde = !emailAan;
    setEmailBezig(true);
    setMelding(null);
    try {
      const response = await fetch("/api/instellingen/meldingen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emailMeldingenAan: nieuweWaarde }),
      });
      if (!response.ok) throw new Error("E-mailmeldingen konden niet worden aangepast.");
      setEmailAan(nieuweWaarde);
      setMelding(nieuweWaarde ? "E-mailmeldingen zijn ingeschakeld." : "E-mailmeldingen zijn uitgeschakeld.");
    } catch (error) {
      setMelding(error instanceof Error ? error.message : "E-mailmeldingen konden niet worden aangepast.");
    } finally {
      setEmailBezig(false);
    }
  }

  async function testPush() {
    if (testBezig || !ingeschakeld) return;

    setTestBezig(true);
    setMelding(null);

    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.fout ?? "Testmelding kon niet worden verstuurd.",
        );
      }

      setMelding("Testmelding verstuurd.");
    } catch (error) {
      setMelding(
        error instanceof Error
          ? error.message
          : "Testmelding kon niet worden verstuurd.",
      );
    } finally {
      setTestBezig(false);
    }
  }

  if (bezig) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />
        Instellingen controleren...
      </div>
    );
  }

  if (!ondersteund) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
        Deze browser ondersteunt geen pushmeldingen. E-mailmeldingen blijven gewoon beschikbaar.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">E-mailmeldingen</p>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              E-mail staat standaard aan. Zo mis je belangrijke meldingen ook als
              je geen pushmeldingen op je telefoon of computer hebt ingesteld.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void wijzigEmailMeldingen()}
            disabled={emailBezig}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${emailAan ? "bg-emerald-600" : "bg-slate-300"} disabled:cursor-wait disabled:opacity-60`}
            aria-label={emailAan ? "E-mailmeldingen uitschakelen" : "E-mailmeldingen inschakelen"}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${emailAan ? "left-6" : "left-1"}`} />
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Je kunt e-mailmeldingen altijd zelf uitschakelen via deze instelling.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className={[
            "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold",
            ingeschakeld
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          {ingeschakeld ? <Bell size={17} /> : <BellOff size={17} />}
          {ingeschakeld ? "Meldingen ingeschakeld" : "Meldingen uitgeschakeld"}
        </div>

        {ingeschakeld ? (
          <>
            <button
              type="button"
              onClick={() => void uitschakelen()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Meldingen uitschakelen
            </button>
            <button
              type="button"
              onClick={() => void testPush()}
              disabled={testBezig}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-wait disabled:opacity-60"
            >
              {testBezig ? "Testen..." : "Test pushmelding"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void inschakelen()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Meldingen inschakelen
          </button>
        )}
      </div>

      {toestemming === "denied" && !ingeschakeld && (
        <p className="text-sm text-amber-700">
          Je browser blokkeert meldingen. Zet meldingen voor erp.iselto.nl
          eerst weer aan via de site-instellingen van je browser.
        </p>
      )}

      {melding && (
        <p className="text-sm text-slate-600" role="status">
          {melding}
        </p>
      )}

      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Pushmeldingen</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          Push is optioneel en werkt alleen als je dit op je apparaat en in je
          browser toestaat. Gebruik je Clevers op meerdere apparaten, dan stel
          je pushmeldingen per apparaat afzonderlijk in.
        </p>
      </div>
    </div>
  );
}
