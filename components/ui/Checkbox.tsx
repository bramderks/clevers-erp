import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
};

export default function Checkbox({
  label,
  description,
  className = "",
  id,
  ...props
}: Props) {
  const inputId = id ?? props.name ?? label;

  return (
    <label
      htmlFor={inputId}
      className="flex cursor-pointer items-start gap-3"
    >
      <input
        id={inputId}
        type="checkbox"
        className={[
          "mt-1 h-5 w-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500",
          className,
        ].join(" ")}
        {...props}
      />

      <div>
        <p className="font-medium text-slate-900">
          {label}
        </p>

        {description && (
          <p className="text-sm text-slate-500">
            {description}
          </p>
        )}
      </div>
    </label>
  );
}