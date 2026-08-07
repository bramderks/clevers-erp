"use client";

import { useState } from "react";

export default function NieuweVestigingForm() {
  const [code, setCode] = useState("");
  const [naam, setNaam] = useState("");
  const [laden, setLaden] = useState(false);

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();

    setLaden(true);

    const response = await fetch("/api/vestigingen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        naam,
      }),
    });

    setLaden(false);

    if (!response.ok) {
      alert("Opslaan mislukt.");
      return;
    }

    setCode("");
    setNaam("");

    window.location.reload();
  }

  return (
    <form
      onSubmit={opslaan}
      className="space-y-4 rounded-xl border bg-white p-6 shadow-sm"
    >
      <h2 className="text-xl font-semibold">
        Nieuwe vestiging
      </h2>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Code
        </label>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          className="w-full rounded-lg border px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Naam
        </label>

        <input
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          required
          className="w-full rounded-lg border px-3 py-2"
        />
      </div>

      <button
        disabled={laden}
        className="rounded-lg bg-black px-5 py-2 text-white"
      >
        {laden ? "Opslaan..." : "Vestiging opslaan"}
      </button>
    </form>
  );
}