import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
};

export default function PageToolbar({
  title,
  actions,
  filters,
}: Props) {
  return (
    <div className="space-y-6">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>{title}</div>

          {actions && (
            <div className="flex items-center gap-3">
              {actions}
            </div>
          )}
        </div>
      )}

      {filters && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {filters}
        </div>
      )}
    </div>
  );
}