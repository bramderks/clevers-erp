import type { ReactNode } from "react";

type PageLayoutProps = {
  children: ReactNode;
};

export default function PageLayout({
  children,
}: PageLayoutProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-8">
      {children}
    </div>
  );
}