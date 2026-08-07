import Link from "next/link";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

export default function AanmeldenSuccesPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-12">
      <Card className="w-full max-w-2xl text-center">
        <PageHeader
          title="Aanmelding ontvangen"
          subtitle="Bedankt voor je aanmelding bij Clevers."
        />

        <div className="mt-8 space-y-4 text-slate-600">
          <p>
            Je aanmelding is succesvol ontvangen.
          </p>

          <p>
            Een beheerder beoordeelt jouw gegevens en vult je
            dienstverband aan.
          </p>

          <p>
            Zodra je account is geactiveerd ontvang je automatisch
            een e-mail en kun je direct inloggen.
          </p>
        </div>

        <div className="mt-10">
          <Link href="/login">
            <Button>
              Naar inloggen
            </Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}