import Card from "@/components/ui/Card";

export default function SystemStatus() {
  return (
    <Card>

      <h2 className="mb-5 text-xl font-semibold">
        Systeemstatus
      </h2>

      <div className="space-y-3">

        <Status naam="Database" status="Online" />

        <Status naam="API" status="Online" />

        <Status naam="ERP" status="Actief" />

      </div>

    </Card>
  );
}

function Status({
  naam,
  status,
}: {
  naam: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">

      <span>{naam}</span>

      <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
        {status}
      </span>

    </div>
  );
}