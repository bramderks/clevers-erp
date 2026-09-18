"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function MedewerkerStatusActie({ medewerkerId, actief, naam }: { medewerkerId: string; actief: boolean; naam: string }) {
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState("");

  async function wijzigStatus() {
    const doelActief = !actief;
    const bevestiging = doelActief
      ? "Wil je " + naam + " opnieuw actief maken?"
      : "Wil je " + naam + " inactief zetten? De medewerker blijft bewaard voor historische rapportages, maar kan daarna niet meer worden ingepland of geselecteerd.";
    if (!window.confirm(bevestiging)) return;
    setLaden(true);
    setFout("");
    try {
      const response = await fetch("/api/medewerkers/" + medewerkerId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "status", data: { actief: doelActief } }),
      });
      const data = await response.json();

      if (response.status === 409 && data?.bevestigingVereist && doelActief === false) {
        const doorgaan = window.confirm(
          (data.waarschuwing ?? "Deze medewerker staat nog op toekomstige diensten.") +
            "\n\nWil je de medewerker toch inactief zetten?",
        );
        if (!doorgaan) {
          setLaden(false);
          return;
        }

        const forceResponse = await fetch("/api/medewerkers/" + medewerkerId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section: "status", data: { actief: false, force: true } }),
        });
        const forceData = await forceResponse.json();
        if (!forceResponse.ok) throw new Error(forceData.error ?? "De status kon niet worden gewijzigd.");
        window.location.reload();
        return;
      }

      if (!response.ok) throw new Error(data.error ?? "De status kon niet worden gewijzigd.");
      window.location.reload();
    } catch (error) {
      setFout(error instanceof Error ? error.message : "De status kon niet worden gewijzigd.");
      setLaden(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant={actief ? "secondary" : undefined} onClick={() => void wijzigStatus()} disabled={laden}>
        {laden ? "Opslaan..." : actief ? "Medewerker inactief zetten" : "Medewerker opnieuw activeren"}
      </Button>
      {fout && <p className="text-xs text-red-600">{fout}</p>}
    </div>
  );
}
