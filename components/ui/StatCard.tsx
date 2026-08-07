import Card from "./Card";

type Props = {
  title: string;
  value: string | number;
  color?: string;
};

export default function StatCard({
  title,
  value,
  color = "#A8D8D8",
}: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>

          <h2 className="mt-2 text-4xl font-bold text-slate-800">
            {value}
          </h2>
        </div>

        <div
          className="h-16 w-16 rounded-2xl"
          style={{ backgroundColor: color }}
        />
      </div>
    </Card>
  );
}