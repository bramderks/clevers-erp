"use client";

import type { ReactNode } from "react";
import {
  FormProvider,
  type DefaultValues,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";

type Props<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  onSubmit: SubmitHandler<TFieldValues>;
  children: ReactNode;
  className?: string;
};

export default function Form<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  children,
  className = "space-y-6",
}: Props<TFieldValues>) {
  return (
    <FormProvider {...form}>
      <form
        noValidate
        className={className}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {children}
      </form>
    </FormProvider>
  );
}