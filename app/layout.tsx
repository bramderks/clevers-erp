import type { Metadata } from "next";
import { Geist } from "next/font/google";

import "./globals.css";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

import { getCurrentUser } from "@/lib/auth";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clevers ERP",
  description: "Professioneel ERP voor ijssalons",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function RootLayout({
  children,
}: RootLayoutProps) {
  const gebruiker = await getCurrentUser();

  const topbarGebruiker = gebruiker
    ? {
        naam: gebruiker.naam,
        rollen: Array.from(
          new Set(
            gebruiker.organisaties.map(
              (relatie) => relatie.rol.naam,
            ),
          ),
        ),
      }
    : {
        naam: "Gast",
        rollen: [],
      };

  return (
    <html lang="nl">
      <body className={geist.className}>
        <div className="flex min-h-screen">
          <Sidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar gebruiker={topbarGebruiker} />

            <main className="flex-1 overflow-auto p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}