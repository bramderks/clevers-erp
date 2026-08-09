"use client";

type Vestiging = {
  id: string;
  naam: string;
};

type PlanningVestigingSelectProps = {
  vestigingen: Vestiging[];
  vestigingId: string;
  onChange: (vestigingId: string) => void;
};

export default function PlanningVestigingSelect({
  vestigingen,
  vestigingId,
  onChange,
}: PlanningVestigingSelectProps) {
  if (vestigingen.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          Er is geen toegankelijke vestiging beschikbaar.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="planning-vestiging"
        className="block text-sm font-medium text-gray-900"
      >
        Vestiging
      </label>

      <select
        id="planning-vestiging"
        value={vestigingId}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900"
      >
        {vestigingen.map((vestiging) => (
          <option
            key={vestiging.id}
            value={vestiging.id}
          >
            {vestiging.naam}
          </option>
        ))}
      </select>
    </div>
  );
}