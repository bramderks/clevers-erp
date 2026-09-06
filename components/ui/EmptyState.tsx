import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  action,
}: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-10 py-16 text-center">
      <h2 className="text-xl font-semibold">
        {title}
      </h2>

      <p className="mx-auto mt-3 max-w-lg text-slate-500">
        {description}
      </p>

      {action && (
        <div className="mt-8">
          {action}
        </div>
      )}
    </div>
  );
}
