import type { ReactNode } from "react";

type PageActionsProps = {
  children: ReactNode;
};

export default function PageActions({
  children,
}: PageActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {children}
    </div>
  );
}