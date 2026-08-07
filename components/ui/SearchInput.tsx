"use client";

import { Search } from "lucide-react";

type Props = {
  value: string;
  onChange(value: string): void;
  placeholder?: string;
};

export default function SearchInput({
  value,
  onChange,
  placeholder = "Zoeken...",
}: Props) {
  return (
    <div className="relative max-w-md">
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
      />

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none transition focus:border-[#A8D8D8]"
      />
    </div>
  );
}