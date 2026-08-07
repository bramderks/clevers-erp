import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function FormRow({
  children,
}: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {children}
    </div>
  );
}