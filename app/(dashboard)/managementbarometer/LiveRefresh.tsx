"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LiveRefresh() {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
      setUpdatedAt(new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 7000);
    return () => window.clearInterval(interval);
  }, [router]);

  return <span className="text-xs text-slate-500">Live · automatisch bijgewerkt elke 7 seconden{updatedAt ? " · laatst " + updatedAt : ""}</span>;
}
