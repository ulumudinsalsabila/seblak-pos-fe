"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ErrorNotice } from "@/components/ui";
import { useBranding } from "@/components/branding-provider";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!loading && user)
      router.replace(
        user.role === "SUPER_ADMIN"
          ? "/admin"
          : user.role === "OWNER" || user.role === "MANAGER"
            ? "/dashboard"
            : user.role === "KITCHEN"
              ? "/kitchen"
              : "/pos",
      );
  }, [loading, user, router]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const signedIn = await login(email, password);
      router.replace(
        signedIn.role === "SUPER_ADMIN"
          ? "/admin"
          : signedIn.role === "OWNER" || signedIn.role === "MANAGER"
            ? "/dashboard"
            : signedIn.role === "KITCHEN"
              ? "/kitchen"
              : "/pos",
      );
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
      <section className="relative hidden overflow-hidden bg-[#0f172a] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="flex items-center gap-3 font-black">
          <span
            className="grid h-12 w-40 place-items-center rounded-2xl bg-white bg-contain bg-center bg-no-repeat"
            style={
              branding.logoUrl
                ? { backgroundImage: `url(${branding.logoUrl})` }
                : undefined
            }
          >
            {!branding.logoUrl && <Flame />}
          </span>{" "}
          {branding.storeName}
        </div>
        <div>
          <p className="mb-4 text-sm font-bold tracking-[.3em] text-indigo-300">
            JUALAN · TUMBUH · TERUKUR
          </p>
          <h1 className="max-w-xl text-6xl font-black leading-[1.02]">
            Semua outlet,
            <br />
            satu kendali.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
            Kelola penjualan, tim, transaksi, dan laporan setiap merchant
            dalam satu platform yang siap berkembang.
          </p>
        </div>
        <p className="text-sm text-slate-400">
          DagoraApp · Multi Outlet Commerce
        </p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="card w-full max-w-md p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <span
              className="inline-grid h-12 w-40 place-items-center rounded-2xl bg-white bg-contain bg-center bg-no-repeat text-white"
              style={
                branding.logoUrl
                  ? { backgroundImage: `url(${branding.logoUrl})` }
                  : undefined
              }
            >
              {!branding.logoUrl && <Flame />}
            </span>
          </div>
          <p className="text-sm font-black tracking-[.2em] text-[var(--brand)]">
            SELAMAT DATANG
          </p>
          <h2 className="mt-2 text-3xl font-black">Masuk ke kasir</h2>
          <p className="mt-2 text-sm text-[#796c63]">
            Gunakan akun owner atau cashier yang aktif.
          </p>
          <div className="mt-8 space-y-5">
            <label>
              <span className="label">EMAIL</span>
              <input
                className="field"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              <span className="label">PASSWORD</span>
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            {error !== undefined && <ErrorNotice error={error} />}
            <button
              className="btn-primary flex w-full items-center justify-center gap-2"
              disabled={pending || loading}
            >
              {pending && <LoaderCircle className="animate-spin" size={18} />}
              Masuk
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
