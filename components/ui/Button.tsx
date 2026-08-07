import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "ghost";

type Size =
  | "sm"
  | "md"
  | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900",

  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus:ring-slate-300",

  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600",

  danger:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600",

  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-slate-300",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-5 py-3 text-sm",
  lg: "px-6 py-3.5 text-base",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}