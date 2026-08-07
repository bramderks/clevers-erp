"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");

  const [loading, setLoading] = useState(false);
  const [fout, setFout] = useState("");

  async function inloggen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
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

      const data = await response.json();

      if (!response.ok) {
        setFout(data.message ?? "Inloggen mislukt.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setFout("Er is een onverwachte fout opgetreden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={inloggen}
      className="space-y-5"
    >
      <Input
        label="E-mailadres"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <Input
        label="Wachtwoord"
        name="password"
        type="password"
        autoComplete="current-password"
        value={wachtwoord}
        onChange={(e) => setWachtwoord(e.target.value)}
        required
      />

      {fout && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fout}
        </div>
      )}

      <Button
        type="submit"
        fullWidth
        disabled={loading}
      >
        {loading ? "Bezig met inloggen..." : "Inloggen"}
      </Button>
    </form>
  );
}