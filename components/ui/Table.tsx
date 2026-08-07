import { ReactNode } from "react";

export function Table({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full">
        {children}
      </table>
    </div>
  );
}

export function THead({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <thead className="bg-slate-100">
      {children}
    </thead>
  );
}

export function TBody({
  children,
}: {
  children: ReactNode;
}) {
  return <tbody>{children}</tbody>;
}