"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const handleLogout = async () => {
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/logout",
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Uitloggen is mislukt.",
        );
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <LogOut size={17} />

      <span>
        {loading
          ? "Uitloggen..."
          : "Uitloggen"}
      </span>
    </button>
  );
}