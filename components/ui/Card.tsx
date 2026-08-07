import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
};

export default function Card({
  children,
  className = "",
  title,
  description,
  actions,
}: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {(title || description || actions) && (
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-start md:justify-between">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
            )}

            {description && (
              <p className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      <div className="p-6">
        {children}
      </div>
    </section>
  );
}