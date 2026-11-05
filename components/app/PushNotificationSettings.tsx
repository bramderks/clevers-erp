"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

function base64UrlNaarUint8Array(waarde: string) {
  const padding = "=".repeat((4 - (waarde.length % 4)) % 4);
  const base64 = (waarde + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (karakter) => karakter.charCodeAt(0));
}

function wachtOpServiceWorker(): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("De Clevers-serviceworker is niet gestart. Sluit de app volledig af en open deze opnieuw.")),
      10000,
    );
    navigator.serviceWorker.ready.then(
      (registratie) => { window.clearTimeout(timeout); resolve(registratie); },
      (error) => { window.clearTimeout(timeout); reject(error); },
    );
  });
}
export default function PushNotificationSettings() {
  const [ondersteund, setOndersteund] = useState(false);
  const [toestemming, setToestemming] =
    useState<NotificationPermission | "unknown">("unknown");
  const [ingeschakeld, setIngeschakeld] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [testBezig, setTestBezig] = useState(false);
  const [emailAan, setEmailAan] = useState(true);
  const [emailBezig, setEmailBezig] = useState(true);

  useEffect(() => {
    let actief = true;

    async function laad() {
      const beschikbaar =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      if (actief) setOndersteund(beschikbaar);

      // Persoonlijke e-mailinstellingen laden onafhankelijk van push.
      try {
        const emailResponse = await fetch("/api/instellingen/meldingen", {
          credentials: "include",
          cache: "no-store",
        });
        if (!emailResponse.ok) {
          throw new Error(
            emailResponse.status === 401
              ? "Je sessie is verlopen. Log opnieuw in."
              : "E-mailinstellingen konden niet worden geladen.",
          );
        }
        const emailData = await emailResponse.json();
        if (actief) setEmailAan(emailData.emailMeldingenAan !== false);
      } catch (error) {
        if (actief) {
          setMelding(
            error instanceof Error
              ? error.message
              : "E-mailinstellingen konden niet worden geladen.",
          );
        }
      } finally {
        if (actief) setEmailBezig(false);
      }

      // Pushstatus krijgt maximaal 3 seconden. Sommige mobiele browsers
      // laten Service Worker-API's anders onbeperkt hangen.
      try {
        if (beschikbaar) {
          const huidigeToestemming = Notification.permission;
          if (actief) setToestemming(huidigeToestemming);

          if (huidigeToestemming === "granted") {
            const controle = async () => {
              const registratie =
                await navigator.serviceWorker.getRegistration("/");
              if (!registratie) return false;
              const subscription =
                await registratie.pushManager.getSubscription();
              return Boolean(subscription);
            };

            const timeout = new Promise<never>((_, reject) => {
              window.setTimeout(
                () => reject(new Error("controle duurt te lang")),
                3000,
              );
            });
            const status = await Promise.race([controle(), timeout]);
            if (actief) setIngeschakeld(status);
          }
        }
      } catch (error) {
        if (actief) {
          setMelding(
            error instanceof Error && error.message === "controle duurt te lang"
              ? "Pushstatus is tijdelijk niet beschikbaar. Je e-mailinstellingen werken gewoon."
              : error instanceof Error
                ? `Pushstatus kon niet worden gecontroleerd: ${error.message}`
                : "Pushstatus kon niet worden gecontroleerd.",
          );
        }
      } finally {
        if (actief) setBezig(false);
      }
    }

    void laad();
    return () => {
      actief = false;
    };
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

      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const registratie = await wachtOpServiceWorker();
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
      setMelding("Meldingen zijn naar dit apparaat overgezet. Een eerder gekoppelde telefoon ontvangt geen pushmeldingen meer.");
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
      const registratie = await wachtOpServiceWorker();
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

      {ondersteund ? (
        <>
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
                        disabled={bezig}
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
                      disabled={bezig}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                    >
                      {bezig ? "Bezig met inschakelen..." : "Meldingen inschakelen"}
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
                    Pushmeldingen zijn gekoppeld aan één apparaat per account. Schakel
                    meldingen op een nieuwe telefoon in om ze naar dat toestel over te
                    zetten. Het vorige toestel ontvangt daarna geen pushmeldingen meer.
                  </p>
                </div>
        </>
      ) : (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
          Deze browser ondersteunt geen pushmeldingen. Je persoonlijke e-mailinstellingen blijven gewoon beschikbaar.
        </div>
      )}
    </div>
  );
}
