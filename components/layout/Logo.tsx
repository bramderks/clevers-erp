import Link from "next/link";

type LogoProps = {
  compact?: boolean;
};

export default function Logo({
  compact = false,
}: LogoProps) {
  if (compact) {
    return (
      <Link
        href="/dashboard"
        aria-label="Clevers ERP"
        className="flex h-12 w-12 items-center justify-center transition-opacity hover:opacity-90"
      >
        <img
          src="/ijs-logo-transparent.png"
          alt="Clevers ERP"
          className="h-12 w-12 object-contain"
        />
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard"
      aria-label="Clevers ERP"
      className="flex h-14 w-full items-center justify-start transition-opacity hover:opacity-90"
    >
      <div className="flex h-14 w-[190px] items-center justify-center overflow-hidden rounded-2xl bg-white">
        <img
          src="/logo.png"
          alt="Clevers ERP"
          className="h-12 w-auto object-contain"
        />
      </div>
    </Link>
  );
}