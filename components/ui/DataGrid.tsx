import type { ReactNode } from "react";

type Column<T> = {
  key: keyof T | string;
  title: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T) => ReactNode;
};

type DataGridProps<T> = {
  columns: Column<T>[];
  data: T[];
  empty?: ReactNode;
};

export default function DataGrid<T>({
  columns,
  data,
  empty,
}: DataGridProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        {empty ?? "Geen gegevens gevonden."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  style={{
                    width: column.width,
                  }}
                  className={[
                    "border-b border-slate-200 px-6 py-4 text-sm font-semibold text-slate-600",
                    column.align === "center"
                      ? "text-center"
                      : column.align === "right"
                        ? "text-right"
                        : "text-left",
                  ].join(" ")}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((row, index) => (
              <tr
                key={index}
                className="transition hover:bg-slate-50"
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={[
                      "border-b border-slate-100 px-6 py-4",
                      column.align === "center"
                        ? "text-center"
                        : column.align === "right"
                          ? "text-right"
                          : "text-left",
                    ].join(" ")}
                  >
                    {column.render
                      ? column.render(row)
                      : String(
                          row[column.key as keyof T] ?? "",
                        )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}