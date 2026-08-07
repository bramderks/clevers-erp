"use client";

import { useFormContext } from "react-hook-form";

import FormField from "./FormField";

type Option = {
  value: string;
  label: string;
};

type Props = {
  name: string;
  label: string;
  options: Option[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
};

export default function FormSelect({
  name,
  label,
  options,
  placeholder,
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
      label={label}
      hint={hint}
      required={required}
      error={error?.message ? String(error.message) : undefined}
    >
      <select
        id={name}
        disabled={disabled}
        {...register(name)}
        className={[
          "w-full rounded-xl border bg-white px-4 py-3 text-slate-900 transition",
          "focus:outline-none focus:ring-2",
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 focus:border-cyan-500 focus:ring-cyan-200",
          disabled
            ? "cursor-not-allowed bg-slate-100"
            : "",
        ].join(" ")}
      >
        {placeholder && (
          <option value="">
            {placeholder}
          </option>
        )}

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}