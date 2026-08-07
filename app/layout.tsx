import type { Metadata } from "next";
import { Geist } from "next/font/google";

import "./globals.css";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

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

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html
      lang="nl"
      suppressHydrationWarning
    >
      <body className={geist.className}>
        <div className="flex min-h-screen bg-slate-100">
          <Sidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />

            <main className="flex-1 overflow-auto p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}