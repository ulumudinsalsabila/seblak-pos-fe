import type { StocktakeStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { stocktakeStatusLabel } from "../inventory-ui";

const statusStyle: Record<StocktakeStatus, string> = {
  COUNTING: "border-sky-200 bg-sky-50 text-sky-700",
  REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  POSTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-border bg-muted text-muted-foreground",
};

export function StocktakeStatusBadge({ status }: { status: StocktakeStatus }) {
  return <span className={cn("inline-block rounded-full border px-2.5 py-1 text-xs font-bold", statusStyle[status])}>{stocktakeStatusLabel[status]}</span>;
}
