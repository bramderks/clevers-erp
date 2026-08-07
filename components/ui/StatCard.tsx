import type { ReactNode } from "react";

import Card from "./Card";

type Props = {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
}: Props) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {title}
          </p>

          <h2 className="mt-2 text-4xl font-bold">
            {value}
          </h2>

          {subtitle && (
            <p className="mt-2 text-sm text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {icon && (
          <div className="rounded-xl bg-[#EAF7F7] p-3">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}