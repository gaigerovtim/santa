import { STATUS_LABELS } from "@/lib/admin-data";
import type { OrderStatusName } from "@/lib/order-status";

const TONE: Record<OrderStatusName, string> = {
  created: "border-line text-muted",
  preview_generating: "border-line text-muted",
  preview_ready: "border-garland/40 text-garland",
  paid: "border-garland/60 text-garland",
  generating: "border-garland/60 text-garland",
  review: "border-santa/70 bg-santa/15 text-text",
  delivered: "border-success/50 text-success",
  expired: "border-line text-muted",
  needs_help: "border-danger/60 bg-danger/10 text-danger",
  refunded: "border-line text-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const s = status as OrderStatusName;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE[s] ?? ""}`}>
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}
