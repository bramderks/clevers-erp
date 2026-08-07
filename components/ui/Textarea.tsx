import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export default function Textarea({
  label,
  error,
  hint,
  className = "",
  id,
  ...props
}: Props) {
  const inputId = id ?? props.name ?? label;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <textarea
        id={inputId}
        {...props}
        className={[
          "min-h-32 w-full rounded-xl border bg-white px-4 py-3 text-slate-900 transition",
          "resize-y focus:outline-none focus:ring-2",
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 focus:border-cyan-500 focus:ring-cyan-200",
          className,
        ].join(" ")}
      />

      {hint && !error && (
        <p className="text-xs text-slate-500">
          {hint}
        </p>
      )}

      {error && (
        <p className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}