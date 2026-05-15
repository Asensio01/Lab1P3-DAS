import { cn } from "@/lib/utils";

type Status = "open" | "closed" | "error" | "connecting";

const statusStyles: Record<Status, string> = {
  open: "bg-mint/20 text-mint border-mint/30",
  closed: "bg-white/10 text-white/70 border-white/20",
  error: "bg-ember/20 text-ember border-ember/30",
  connecting: "bg-sky/20 text-sky border-sky/30"
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]",
        statusStyles[status]
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {status}
    </span>
  );
}
