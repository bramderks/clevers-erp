import type { ReactNode } from "react";

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export default function Section({
  title,
  subtitle,
  children,
}: Props) {
  return (
    <section className="space-y-5">
      {(title || subtitle) && (
        <div>
          {title && (
            <h2 className="text-xl font-semibold">
              {title}
            </h2>
          )}

          {subtitle && (
            <p className="mt-1 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {children}
    </section>
  );
}