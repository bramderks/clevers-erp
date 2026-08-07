import "./globals.css";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Clevers ERP",
  description: "Clevers ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className="bg-[#F5F7F8] text-[#2F2F2F]">
        <div className="flex min-h-screen">

          {/* Sidebar */}

          <aside className="flex w-72 flex-col bg-[#A8D8D8]">

            {/* Logo */}

            <div className="flex h-28 items-center justify-center bg-white shadow-sm">

              <Image
                src="/logo.png"
                alt="Clevers IJsbar"
                width={220}
                height={60}
                priority
              />

            </div>

            {/* Menu */}

            <nav className="flex-1 space-y-2 p-5">

              <MenuItem href="/" text="Dashboard" />
              <MenuItem href="/vestigingen" text="Vestigingen" />
              <MenuItem href="/gebruikers" text="Gebruikers" />
              <MenuItem href="/medewerkers" text="Medewerkers" />
              <MenuItem href="/planning" text="Planning" />
              <MenuItem href="/producten" text="Producten" />
              <MenuItem href="/bestellingen" text="Bestellingen" />
              <MenuItem href="/voorraad" text="Voorraad" />
              <MenuItem href="/instellingen" text="Instellingen" />

            </nav>

            {/* Footer */}

            <div className="border-t border-white/40 p-5 text-sm text-[#2F2F2F]/70">
              Clevers ERP v1.0
            </div>

          </aside>

          {/* Rechterzijde */}

          <div className="flex flex-1 flex-col">

            {/* Header */}

            <header className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-10">

              <h1 className="text-2xl font-semibold">
                Clevers ERP
              </h1>

              <div className="flex items-center gap-4">

                <div className="h-10 w-10 rounded-full bg-[#A8D8D8]" />

              </div>

            </header>

            {/* Content */}

            <main className="flex-1 p-10">

              {children}

            </main>

          </div>

        </div>
      </body>
    </html>
  );
}

function MenuItem({
  href,
  text,
}: {
  href: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="
        block
        rounded-xl
        px-4
        py-3
        font-medium
        text-[#2F2F2F]
        transition-all
        duration-200
        hover:bg-white
        hover:shadow-md
      "
    >
      {text}
    </Link>
  );
}