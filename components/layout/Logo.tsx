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
        className="flex h-16 w-16 items-center justify-center transition-opacity hover:opacity-90"
      >
        <img
          src="/ijs-logo-transparent.png"
          alt="Clevers"
          width={96}
          height={96}
          className="h-16 w-16 object-contain"
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
          width={180}
          height={48}
          className="h-12 w-auto max-w-[180px] object-contain"
        />
      </div>
    </Link>
  );
}