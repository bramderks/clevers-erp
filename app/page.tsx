import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { controleerToken } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    await controleerToken(token);
  } catch {
    redirect("/login");
  }

  redirect("/dashboard");
}