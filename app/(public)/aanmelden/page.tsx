import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

import AanmeldForm from "@/modules/medewerkers/aanmelden/components/AanmeldForm";

export const metadata = {
  title: "Medewerker aanmelden | Clevers ERP",
};

export default function AanmeldenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <div className="w-full max-w-2xl">
        <Card>
          <PageHeader
            title="Werken bij Clevers"
            subtitle="Vul hieronder je gegevens in om je aan te melden als nieuwe medewerker."
          />

          <AanmeldForm />
        </Card>
      </div>
    </main>
  );
}