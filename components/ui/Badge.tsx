type Props = {
  children: React.ReactNode;
  color?: "green" | "red" | "orange" | "blue";
};

const kleuren = {
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  blue: "bg-sky-100 text-sky-700",
};

export default function Badge({
  children,
  color = "blue",
}: Props) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${kleuren[color]}`}
    >
      {children}
    </span>
  );
}