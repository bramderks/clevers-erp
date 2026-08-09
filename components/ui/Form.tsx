import type { FormHTMLAttributes, ReactNode } from "react";

type FormProps = FormHTMLAttributes<HTMLFormElement> & {
  children: ReactNode;
};

export default function Form({
  children,
  className = "",
  ...props
}: FormProps) {
  return (
    <form
      {...props}
      className={[
        "space-y-6",
        className,
      ].join(" ")}
      noValidate
    >
      {children}
    </form>
  );
}