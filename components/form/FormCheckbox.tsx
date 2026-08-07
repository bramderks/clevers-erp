"use client";

import { useFormContext } from "react-hook-form";

import FormField from "./FormField";

type Props = {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
};

export default function FormCheckbox({
  name,
  label,
  hint,
  required = false,
  disabled = false,
}: Props) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const error = errors[name];

  return (
    <FormField
      id={name}
      label=""
      hint={hint}
      required={required}
      error={error?.message ? String(error.message) : undefined}
    >
      <label
        htmlFor={name}
        className="flex cursor-pointer items-start gap-3"
      >
        <input
          id={name}
          type="checkbox"
          disabled={disabled}
          {...register(name)}
          className={[
            "mt-1 h-5 w-5 rounded border-slate-300 text-cyan-600",
            "focus:ring-2 focus:ring-cyan-500",
            disabled
              ? "cursor-not-allowed opacity-60"
              : "",
          ].join(" ")}
        />

        <span className="text-sm text-slate-700">
          {label}

          {required && (
            <span className="ml-1 text-red-500">*</span>
          )}
        </span>
      </label>
    </FormField>
  );
}