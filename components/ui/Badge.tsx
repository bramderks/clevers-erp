import type { ReactNode } from "react";

type Variant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info";

type BadgeProps = {
  children: ReactNode;
  variant?: Variant;
};

const variants: Record<Variant, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-cyan-100 text-cyan-700",
};

export default function Badge({
  children,
  variant = "default",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        variants[variant],
      ].join(" ")}
    >
      {children}
    </span>
  );
}