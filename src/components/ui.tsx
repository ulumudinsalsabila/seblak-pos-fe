import { LoaderCircle } from "lucide-react";
import { clsx } from "clsx";
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-[#796c63]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
export function Loading({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center gap-2 text-[#796c63]">
      <LoaderCircle className="animate-spin" size={20} />
      {label}
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-10 text-center text-[#796c63]">{children}</div>;
}
export function StatusBadge({ status }: { status: string }) {
  const good = ["PAID", "ACTIVE"].includes(status);
  return (
    <span
      className={clsx(
        "badge",
        good ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
      )}
    >
      {status}
    </span>
  );
}
export function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
      {error instanceof Error ? error.message : "Terjadi kesalahan"}
    </div>
  );
}
