import { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export default function Input({
  label,
  className = "",
  ...props
}: Props) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        {...props}
        className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#8FCFD0] focus:ring-2 focus:ring-[#A8D8D8] ${className}`}
      />
    </div>
  );
}