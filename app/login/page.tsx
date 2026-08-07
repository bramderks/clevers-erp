"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState("");

  async function inloggen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLaden(true);
    setFout("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          wachtwoord,
        }),
      });

      if (!response.ok) {
        setFout("Onjuiste gebruikersnaam of wachtwoord.");
        setLaden(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setFout("Er is een fout opgetreden.");
      setLaden(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7F8]">
      <Card className="w-full max-w-md">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-800">
            Clevers ERP
          </h1>

          <p className="mt-2 text-slate-500">
            Log in met je account
          </p>
        </div>

        <form
          onSubmit={inloggen}
          className="space-y-5"
        >
          <Input
            label="E-mailadres"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <Input
            label="Wachtwoord"
            type="password"
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            autoComplete="current-password"
            required
          />

          {fout && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {fout}
            </div>
          )}

          <Button
            type="submit"
            disabled={laden}
            className="w-full"
          >
            {laden ? "Bezig met inloggen..." : "Inloggen"}
          </Button>
        </form>

      </Card>
    </main>
  );
}