import Button from "./Button";

type Props = {
  saving?: boolean;
};

export default function SaveBar({
  saving = false,
}: Props) {
  return (
    <div className="sticky bottom-6 z-20 mt-8 flex justify-end rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
      <Button
        type="submit"
        disabled={saving}
      >
        {saving ? "Opslaan..." : "Opslaan"}
      </Button>
    </div>
  );
}